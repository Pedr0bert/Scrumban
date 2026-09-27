# Avaliação do Código, Arquitetura Mobile (Flutter) e Bot do Telegram

> **Data:** 27 de Setembro de 2026 · **Base avaliada:** `main` @ `20c2a10` (v4.0.0)

---

## 1. Avaliação do código atual

**Pontos fortes**
- Modularização em ES Modules com responsabilidades claras (`state`, `storage`, `kanban`, `sprints`, `metrics`…).
- Persistência offline-first sólida: IndexedDB com migração/fallback para `localStorage` e validação de schema na importação.
- Modelo de dados simples e serializável (`settings`, `sprints`, `tasks`, `history`) — ótimo contrato para outros clientes (bot, mobile).
- Métricas de fluxo, WIP, ponto de reabastecimento, undo e responsividade mobile já implementados.

**Problemas encontrados** (ordenados por impacto)

| # | Problema | Onde | Impacto |
| :-: | :-- | :-- | :-- |
| 1 | **Backup JSON não inclui imagens.** Elas ficam no store `task_images`, mas `exportarBackupJSON` exporta só o `appState`. Restaurar em outra máquina deixa referências órfãs. | `storage.js` | Perda de dados |
| 2 | **"Limpar dados" não apaga o store de imagens** (fica lixo acumulado no IndexedDB). | `storage.js` → `executarLimpezaTotalDados` | Armazenamento |
| 3 | **XSS no select de projetos**: `<option value="${p}">${p}</option>` sem escape. Um projeto chamado `<img onerror=…>` executava script. **Corrigido neste PR** (necessário, já que agora projetos chegam por fonte remota). | `task-edit.js:26` | Segurança |
| 4 | `escapeHTML` usado dentro de string JS em `onclick="…('${escapeHTML(nome)}')"`: o navegador decodifica `&#39;` antes de executar, então o nome de arquivo de uma imagem pode quebrar/injetar no handler. Trocar por `data-*` + `addEventListener`. | `task-edit.js:372` | Segurança (local) |
| 5 | Tauri com `"csp": null` + 103 handlers `onclick` inline + ~70 funções expostas em `window`. Impede adotar uma CSP restritiva. | `tauri.conf.json`, `index.html`, `main.js` | Segurança / manutenção |
| 6 | `abrirIndexedDB()` abre uma **nova conexão a cada get/set** e nunca fecha. Reusar uma conexão única. | `storage.js` | Performance |
| 7 | Mutações do estado espalhadas por vários módulos (`appState.tasks[i] = …`, `t.order = …`) sem camada de ações e sem `updatedAt`. **É o principal bloqueio para sincronização multi-dispositivo** (ver §3). | vários | Arquitetura |
| 8 | Nenhum teste automatizado. Lógica pura (`calcularStatusPrazo`, métricas, validação de backup, reordenação) é fácil de testar. | — | Qualidade |
| 9 | `js/app.js` (bundle gerado) versionado no git junto com as fontes — diffs duplicados e risco de dessincronizar. Gerar no build/CI. | `package.json` | Manutenção |
| 10 | `saveState()` grava o estado inteiro em IndexedDB **e** `localStorage` a cada alteração; com muitas tarefas o `localStorage` (~5 MB) estoura em silêncio. | `storage.js` | Escala |
| 11 | `confirm()`/`prompt()` nativos em sprints e novo projeto — inconsistentes com o padrão undo/toast e ruins no mobile. | `sprints.js`, `sprint-closure.js`, `task-edit.js` | UX |

---

## 2. Bot do Telegram — implementado neste PR

Segue o plano de `PLANO_CAPTURA_REMOTA_TELEGRAM.md`, ampliado de "só captura" para **acesso remoto** (consultar e mover):

- `telegram-bot/` — Cloudflare Worker + D1 (plano gratuito). Webhook validado por `secret_token`, whitelist de usuário, deduplicação por `update_id`.
- Captura com `#projeto !prioridade ~dificuldade @prazo`, consultas (`/quadro`, `/foco`, `/hoje`, `/atrasadas`, `/buscar`, `/ver`) e ações (`/mover`, `/iniciar`, `/feito`, `/pendentes`, `/desfazer`).
- `js/sync.js` no desktop: importa a fila ao abrir/focar/botão, persiste **antes** do ACK (nada se perde), criação idempotente, e publica um snapshot do quadro (debounce de 8 s após alterações).
- Configuração em **Configurações → Acesso Remoto**; o token fica fora do backup JSON.

Setup e contrato da API: [`telegram-bot/README.md`](telegram-bot/README.md).

---

## 3. App mobile em Flutter

### 3.1 Antes de decidir: Flutter vs. Tauri Mobile

| | **Tauri v2 Mobile** | **Flutter** |
| :-- | :-- | :-- |
| Reuso de código | ~100% (mesmo HTML/JS; já existe layout mobile e gestos touch) | 0% da UI — reescrever ~4.000 linhas de lógica/UI em Dart |
| Tempo até ter APK | dias | semanas |
| Experiência nativa | WebView (boa, mas não 100% nativa) | Nativa, animações e drag-and-drop superiores |
| Manutenção | Uma base | Duas bases (web/desktop + Flutter) |

**Recomendação:** se o objetivo é *ter o Scrumban no celular rápido*, `tauri android init` resolve com o código atual. Se o objetivo é *experiência nativa* (ou aprender Flutter), siga a estrutura abaixo — ela foi pensada para conversar com o mesmo backend do bot.

### 3.2 Stack sugerida

| Camada | Escolha | Motivo |
| :-- | :-- | :-- |
| Estado | **Riverpod** | Testável, sem `BuildContext`, bom para streams do banco |
| Banco local | **Drift** (SQLite) | Offline-first como o desktop; queries reativas; migrações tipadas |
| Modelos | **freezed + json_serializable** | Imutáveis, `copyWith`, JSON idêntico ao backup do desktop |
| Rotas | **go_router** | Deep links (ex.: abrir tarefa por notificação) |
| Rede | **dio** | Interceptor de `Authorization: Bearer`, retry |
| Segredos | **flutter_secure_storage** | Token da API no Keystore/Keychain |
| Quadro | `LongPressDraggable`/`DragTarget` nativos (ou `appflowy_board`) | Reordenação entre colunas |
| Background | **workmanager** | Sincronizar periodicamente |

### 3.3 Estrutura de pastas (feature-first)

```
scrumban_mobile/
├── lib/
│   ├── main.dart
│   ├── app.dart                      # MaterialApp.router, tema terroso claro/escuro
│   ├── core/
│   │   ├── theme/                    # paleta terracota/musgo/linho/grafite
│   │   ├── router/
│   │   └── utils/                    # datas, gerarId (uuid v4 com prefixo "task-")
│   ├── domain/                       # Dart puro, sem Flutter
│   │   ├── models/                   # Task, Subtask, Sprint, HistoryEntry, Settings (freezed)
│   │   ├── enums.dart                # Coluna, Prioridade, Dificuldade (mesmos valores string do JS)
│   │   └── services/                 # prazo.dart, metricas.dart, wip.dart (portados de state.js/metrics.js)
│   ├── data/
│   │   ├── local/                    # Drift: tabelas tasks, sprints, history, outbox
│   │   ├── remote/                   # ScrumbanApi (inbox, snapshot, v2/changes)
│   │   ├── repositories/             # TaskRepository etc. — ÚNICO ponto de mutação
│   │   └── sync/                     # SyncEngine: outbox → push, pull → merge
│   └── features/
│       ├── board/                    # quadro, card, filtros, aba por coluna
│       ├── task/                     # criar/editar, checklist, subtarefas
│       ├── sprints/
│       ├── history/                  # histórico + export Markdown/CSV
│       ├── metrics/
│       ├── capture/                  # captura rápida com a MESMA sintaxe do bot (#, !, ~, @)
│       └── settings/                 # WIP, projetos, conexão remota, backup JSON
└── test/
    ├── fixtures/backup_v4.json       # backup real exportado do desktop
    └── domain/                       # prazo, métricas, parser, round-trip do backup
```

### 3.4 Sincronização em duas fases

**Fase M1 — cliente remoto (usa o backend deste PR, esforço baixo)**
- Lê `GET /api/snapshot` e envia operações para a inbox (adicionar `POST /api/inbox` ao Worker, reaproveitando o formato `create`/`move` que o bot já grava).
- O desktop continua sendo a fonte da verdade — mesmo modelo do bot. Bom para consultar e capturar; não edita offline.

**Fase M2 — offline-first nos dois lados (esforço alto)**
1. **Pré-requisito no desktop (problema #7):** criar uma camada de ações (`criarTarefa`, `moverTarefa`, `editarTarefa`, `excluirTarefa`) que carimba `updatedAt` e grava *tombstones* de exclusão. Hoje as mutações estão espalhadas e isso inviabiliza merge.
2. Worker ganha tabelas por entidade (`tasks`, `sprints`, `history`) com `updated_at` e `deleted`, e as rotas `GET /api/v2/changes?since=<cursor>` e `POST /api/v2/changes`.
3. Resolução de conflito **last-write-wins por tarefa** (`updatedAt`), suficiente para um único usuário com 2–3 dispositivos; `order` é recalculado localmente após o merge.
4. Imagens: upload separado para **R2**, referenciadas por id (resolve também o problema #1).

### 3.5 Contrato compartilhado

- Os modelos Dart devem serializar **exatamente** o JSON do backup do desktop (mesmos nomes de campos e valores: `backlog|todo|progress|testing|done`, `alta|media|baixa`, `trivial…muito_dificil`, datas `YYYY-MM-DD`, ids `task-<uuid>`). Assim o backup JSON funciona nos dois apps.
- Publicar um `schema/scrumban.schema.json` (JSON Schema) derivado de `validarSchemaBackup` e usar o mesmo arquivo de fixture nos testes JS e Dart.

---

## 4. Próximos passos sugeridos

1. Fazer o deploy do bot (`telegram-bot/README.md`) e usar por alguns dias.
2. Corrigir os problemas #1, #2, #4 e #6 (baixo esforço).
3. Decidir entre Tauri Mobile e Flutter (§3.1).
4. Se for Flutter: começar pela Fase M1 + `domain/` com testes; em paralelo, refatorar a camada de ações do desktop (#7) para liberar a Fase M2.
