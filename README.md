# Scrumban Pessoal v4

> Ambiente ágil, offline-first, performático e resiliente baseado no modelo Scrumban voltado para desenvolvimento solo e trabalho autônomo.

---

## ✨ Recursos & Funcionalidades

### 1. Metodologia Scrumban Autêntica para Solo Devs
- **Reordenação Vertical de Cards**: Priorização manual cirúrgica dentro de cada coluna com persistência imediata do índice `order` no IndexedDB.
- **Métricas de Fluxo Ágil**: Rastreamento automático de transição de ciclo de vida (`startedAt` e `completedAt`), calculando **Cycle Time Médio**, **Lead Time Médio** e **Throughput** (tarefas entregues nos últimos 7 e 30 dias).
- **Ponto de Reabastecimento (*Order Point*)**: Alerta discreto na coluna TODO quando a fila estiver esvaziando, incentivando a cadência de fluxo contínuo.
- **Limite WIP com Feedback Enfático**: Alerta visual suave e toast educativo sobre saturação de contexto (*context switching*) caso o limite de itens em *In Progress* seja excedido.
- **Gestão de Ciclos de Sprint & Metas**: Registro de objetivos estratégicos (*Sprint Goal*), notas, datas e progresso de ciclo.
- **Progresso de Sprint Preciso**: Barra de progresso do cabeçalho calculada apenas sobre tarefas comprometidas no ciclo ativo (ignorando itens em ideário no Backlog).
- **Conclusão e Arquivamento de Sprints**: Fluxo de fechamento de ciclo que arquiva as tarefas de *Done* para o histórico e avança para a próxima sprint.

### 2. Gestão de Tarefas, Hierarquia & Prazos
- **Hierarquia de Tarefas (Pai/Filho)**: Suporte a tarefas principais vinculadas a tarefas-pai (`parentId`) e checklist integrado de subtarefas.
- **Controle de Visibilidade no Quadro**: Alternância entre exibir todas as tarefas ou apenas as tarefas-pai na visão Kanban (`subtasksVisibility`).
- **Tracking de Prazos de Entrega (*Due Dates*)**: Detecção automática de vencimento (`1d atrasado`, `Vence hoje`, `Vence amanhã`) com badges visuais.
- **Filtro Rápido de Atrasadas (*Overdue*)**: Botão interativo com contador em tempo real no topo para focar imediatamente em pendências vencidas.
- **Categorização por Projetos**: Segmentação por projetos com cadastro instantâneo de novas categorias diretamente no modal de criação.
- **Sistema de Prioridades Visual**: Badges e bordas semânticas diferenciadas para prioridade Alta (terracota), Média (amarelo) e Baixa (musgo).

### 3. UX, Produtividade & Layout Flexível
- **Visualização Ampla de Colunas (*Modo Foco*)**: Expansão de qualquer coluna para largura total da tela com recolhimento das demais em faixas verticais (`writing-vertical`), facilitando a análise de listas longas com navegação por setas e fechamento via `Esc`.
- **Busca em Tempo Real e Filtros Dinâmicos**: Pesquisa textual instantânea em títulos e notas combinável com filtros de projeto e prioridade.
- **Atalhos Globais de Teclado**: Operação fluida sem mouse:
  - `N`: Nova tarefa
  - `/`: Focar no campo de busca
  - `1`, `2`, `3`, `4`: Alternar entre abas (Quadro, Sprints, Histórico, Configurações)
  - `[`: Recolher / expandir barra lateral
  - `D`: Alternar tema (Dark Mode / Claro)
  - `?`: Abrir modal de ajuda e atalhos
  - `Esc`: Fechar modais abertos e recolher visualização ampla de coluna
- **Exclusão Segura com Desfazer (*Undo Toast*)**: Exclusão instantânea sem janelas de confirmação bloqueantes, com janela de 6 segundos para desfazer com 1 clique.
- **Barra Lateral Retrátil**: Encolhimento suave para 68px (`w-16`) mantendo ícones e tooltips para maximizar a área útil do quadro.
- **Lembrete Preventivo de Backup**: Monitoramento automático com banner suave de aviso preventivo quando decorridos mais de 7 dias da última exportação JSON.

### 4. Acessibilidade Mobile
- **Suporte a Gestos Touch**: Reordenação e movimentação de cards em smartphones e tablets via toque contínuo com feedback visual (*ghost card* e indicador de drop).
- **Layout Responsivo Mobile**: Em telas `< 768px`, a barra lateral transforma-se em um *Drawer* deslizante com menu hambúrguer e overlay escuro.
- **Navegação de Colunas por Abas em Mobile**: Barra seletora horizontal permitindo focar em uma coluna por vez em tela cheia no smartphone (`Todas`, `Backlog`, `TODO`, `In Progress`, `Testing`, `Done`).

### 5. Autonomia, Portabilidade & Relatórios
- **Exportação em Markdown & CSV**: Resumos de sprints concluídas prontos para colar no Obsidian/Notion ou planilhas estruturadas para relatórios e faturamento.
- **100% Offline-First (Sem CDN)**: Folha de estilos do Tailwind compilada e minificada localmente (`css/tailwind.min.css`), sem requisições externas em tempo de execução.
- **Modo Escuro (*Dark Mode*)**: Paleta terrosa refinada sobre fundo carvão/grafite (`#1C1A19`), com persistência e sincronização automática com o sistema operacional.
- **Identidade Visual Própria**: Favicon e ícone vetorial SVG temático (`assets/icon.svg`).

### 6. Armazenamento & Arquitetura Modular
- **Persistência Assíncrona no IndexedDB**: Banco local de alta capacidade (`scrumban_pessoal_db`) com contingência transparente em `localStorage`.
- **Modularização em ES Modules Nativos**: Código decomposto em submódulos especializados em `js/`, todos rigorosamente abaixo de 350 linhas e com separação estrita de responsabilidades.
- **Identificadores Criptograficamente Seguros**: Geração de UUIDs nativos via `crypto.randomUUID()`.
- **Validação Formal de Backup**: Schema validation rigoroso ao importar arquivos JSON.

---

## 📁 Estrutura do Projeto

```
v4/
├── assets/
│   └── icon.svg                      # Ícone vetorial da aplicação (Favicon)
├── css/
│   ├── input.css                     # Arquivo de entrada Tailwind CSS
│   ├── style.css                     # Estilos customizados, Dark Mode e Mobile
│   └── tailwind.min.css              # CSS compilado e minificado localmente
├── js/
│   ├── main.js                       # Ponto de entrada (ES Module) e bootstrap
│   ├── state.js                      # Estado reativo, constantes e utilitários
│   ├── storage.js                    # IndexedDB, persistência e validação de schema
│   ├── kanban.js                     # Renderização de colunas, ordenação e badges
│   ├── drag-drop.js                  # DnD desktop nativo e gestos touch mobile
│   ├── sprints.js                    # Planejamento de sprints e cabeçalho de ciclo
│   ├── sprint-closure.js             # Conclusão de sprint e histórico de entregas
│   ├── metrics.js                    # Lead Time, Cycle Time, Throughput e relatórios
│   ├── task-details.js               # Modal de detalhes e checklist de subtarefas
│   ├── task-edit.js                  # Modal de criação e edição de tarefas
│   ├── config.js                     # Aba de configurações de projeto e limites
│   ├── ui.js                         # Toasts, Undo, navegação de abas e atalhos
│   ├── sidebar.js                    # Sidebar retrátil e drawer móvel
│   ├── theme.js                      # Dark Mode e detecção de tema do sistema
│   └── app.js                        # Bundle unificado gerado via esbuild
├── favicon.svg                       # Favicon raiz do projeto
├── index.html                        # Aplicação web completa
├── package.json                      # Dependências npm e scripts de build
├── plano.md                          # Roadmap executivo com as fases concluídas e planejadas
├── PLANO_DESKTOP_TAURI.md            # Especificação técnica para empacotamento Desktop (Tauri v2)
├── PLANO_CAPTURA_REMOTA_TELEGRAM.md  # Especificação técnica para captura remota via Telegram Bot
├── AVALIACAO_E_SOLUCOES.md           # Diagnóstico técnico de referência arquitetural
└── README.md                         # Documentação oficial do projeto
```

---

## 🚀 Como Executar

A aplicação é **100% offline-first e autônoma**, funcionando de duas formas:

### Opção 1: Execução Direta (Sem Servidor)
Dê um **duplo clique no arquivo `index.html`** ou abra diretamente no seu navegador (`file:///caminho/para/v4/index.html`). O script bundle gerado em `js/app.js` é executado instantaneamente sem restrições de CORS.

### Opção 2: Servidor Local de Desenvolvimento
```bash
# Servidor HTTP nativo do Python:
python3 -m http.server 8000

# Ou via npx:
npx serve .
```
Acesse: [http://localhost:8000/](http://localhost:8000/)

---

## 🛠️ Scripts de Build & Desenvolvimento

O projeto mantém os códigos-fonte modulares em `js/` e compila Tailwind CSS e JS de forma ultrarrápida:

```bash
# Build completo (CSS + JS):
npm run build

# Observar alterações nos módulos JS (hot-bundle em ~20ms):
npm run watch:js

# Observar alterações nos estilos Tailwind:
npm run watch:css

# Recompilar apenas o CSS:
npm run build:css
```

---

## 🔮 Próximas Fases Planejadas

O projeto possui duas expansões detalhadas e arquitetadas prontas para implementação:

1. **Empacotamento Desktop Nativo com Tauri v2 (Fase 4.5):**
   - Transforma a aplicação web em software desktop para Linux/macOS/Windows com consumo de apenas ~35MB de RAM, integrando ícone na bandeja do sistema e notificações nativas.
   - Veja o plano completo em: [`PLANO_DESKTOP_TAURI.md`](PLANO_DESKTOP_TAURI.md).

2. **Captura Remota de Tarefas via Telegram Bot (Fase 5):**
   - Permite adicionar tarefas instantaneamente ao Backlog pelo celular via chatbot no Telegram usando mensagens rápidas com `#projeto`, `!alta` e `@prazo`, com sincronização automática quando o computador for aberto.
   - Veja o plano completo em: [`PLANO_CAPTURA_REMOTA_TELEGRAM.md`](PLANO_CAPTURA_REMOTA_TELEGRAM.md).
