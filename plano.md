# Plano de Ação — Evolução do Scrumban Pessoal

> **Documento de Planejamento Técnico e Executivo**  
> **Versão:** 1.0  
> **Data:** 12 de Setembro de 2026  
> **Base de Referência:** [`AVALIACAO_E_SOLUCOES.md`](file:///home/pedro/Dev/Playground/util/scrumban/teste_producao/AVALIACAO_E_SOLUCOES.md)

---

## 🎯 Objetivo

Evoluir a aplicação **Scrumban Pessoal** de sua base funcional atual para um ambiente de maturidade plena em metodologia Scrumban voltada a trabalho solo e autônomo. O plano é dividido em fases incrementais, garantindo que **cada fase possa ser entregue e testada de forma independente sem quebrar dados existentes** mantidos no IndexedDB ou backups legados.

---

## 🧭 Princípios de Implementação

1. **Zero Regressão de Dados**: Qualquer alteração no schema de tarefas ou sprints deve manter retrocompatibilidade com backups JSON anteriores e com a store atual do IndexedDB.
2. **Performance Sem Reflows**: Preservar o paradigma de atualizações granulares do DOM (`DocumentFragment` e movimentação de nós com `insertBefore` / `appendChild`).
3. **Offline-First Absoluto**: Eliminar qualquer dependência de rede em tempo de execução (CDNs externas).
4. **Entrega Incremental**: Cada ação possui critérios de aceitação objetivos e verificáveis.

---

## 🚀 Fases de Ação

```mermaid
flowchart LR
    Fase1["Fase 1: Correções Críticas & P0\n(Reordenação & Sprint Fix)"] --> Fase2["Fase 2: Essência Scrumban & UX\n(Métricas, Reabastecimento & Atalhos)"]
    Fase2 --> Fase3["Fase 3: Autonomia & Relatórios\n(Offline-first, Markdown & Dark Mode)"]
    Fase3 --> Fase4["Fase 4: Arquitetura & Mobile\n(Modularização ES & Touch)"]
```

---

### 🟢 Fase 1: Correções Críticas & Funcionalidades Centrais (P0) — ✅ CONCLUÍDA

*Meta: Eliminar bugs de visualização de ciclo e habilitar a priorização manual vertical nos cards, fundamental para o método Kanban.*

#### Ação 1.1 — Correção da Seleção da Sprint Passada no Cabeçalho
* **Arquivo Impactado:** [`js/app.js`](file:///home/pedro/Dev/Playground/util/scrumban/teste_producao/js/app.js#L485-L503)
* **Atividades:**
  - Substituir `appState.sprints.find(s => s.status === 'past')` por uma busca que priorize o primeiro registro de `appState.history[0]` ou ordene as sprints passadas por `endDate` decrescente.
  - Assegurar que após o fechamento de múltiplas sprints, o cabeçalho sempre mostre o ciclo imediatamente anterior.
* **Critério de Aceitação:** Ao concluir a Sprint 1 e depois a Sprint 2, o cabeçalho exibe a Sprint 2 como passada, nunca a Sprint 1.

#### Ação 1.2 — Reordenação Vertical de Cards via Drag-and-Drop
* **Arquivos Impactados:** [`js/app.js`](file:///home/pedro/Dev/Playground/util/scrumban/teste_producao/js/app.js#L819-L895), [`css/style.css`](file:///home/pedro/Dev/Playground/util/scrumban/teste_producao/css/style.css)
* **Atividades:**
  - Adicionar o atributo `order: number` às tarefas no modelo de dados.
  - Implementar cálculo de posição vertical no evento `dragover` da coluna, identificando o card imediatamente abaixo do cursor (`e.clientY` via `getBoundingClientRect()`).
  - Inserir marcador visual discreto (linha/indicador de drop) entre os cards durante o arraste.
  - No evento `drop`, utilizar `container.insertBefore(cardEl, proximoCardEl)` e reindexar a propriedade `order` das tarefas afetadas no `appState.tasks`.
  - Salvar no IndexedDB via `saveState()`.
* **Critério de Aceitação:** O usuário consegue arrastar um card para o topo, meio ou final de qualquer coluna, e essa ordem é mantida após recarregar a página (F5) e ao alternar de abas.

#### Ação 1.3 — Destaque Visual e Alerta de Limite WIP Violado
* **Arquivos Impactados:** [`js/app.js`](file:///home/pedro/Dev/Playground/util/scrumban/teste_producao/js/app.js#L572-L591), [`css/style.css`](file:///home/pedro/Dev/Playground/util/scrumban/teste_producao/css/style.css)
* **Atividades:**
  - Quando a contagem de cartões em *In Progress* ultrapassar `appState.settings.wipLimit`, aplicar borda de alerta terracota suave e fundo sutil na coluna inteira.
  - Disparar toast informativo educacional alertando sobre saturação de alternância de contexto (*context switching*).
* **Critério de Aceitação:** Se o limite WIP for 2 e uma 3ª tarefa for movida para *In Progress*, a coluna sinaliza visualmente a sobrecarga de forma instantânea.

#### Ação 1.4 — Retirar Backlog da Barra de Progresso da Sprint Atual *(Novo - da lista de requisitos)*
* **Arquivo Impactado:** [`js/app.js`](file:///home/pedro/Dev/Playground/util/scrumban/teste_producao/js/app.js#L513-L538)
* **Problema:** O cálculo atual da barra de progresso no cabeçalho considera todas as tarefas atribuídas à sprint, incluindo as tarefas que estão na coluna `backlog`. Como o Backlog contém ideias e itens ainda não puxados para o ciclo ativo, 20 ideias no backlog diluem artificialmente o progresso da sprint (ex: 1/23 = 4%), desmotivando o desenvolvedor solo.
* **Atividades:**
  - Filtrar para o cálculo do progresso da sprint apenas as tarefas comprometidas no ciclo: `t.column !== 'backlog'` (isto é, tarefas em `todo`, `progress`, `testing` e `done`).
  - Atualizar o contador e a porcentagem exibidos: `tasksDone / tasksComprometidas`.
  - Tratar o caso de 0 tarefas comprometidas exibindo `0/0 (100%)` ou mensagem neutra.
* **Critério de Aceitação:** Se houver 10 tarefas no Backlog, 2 em TODO e 1 em Done, a barra de progresso exibirá `1/3 (33%)`, desconsiderando as 10 do Backlog.

#### Ação 1.5 — Criação do Ícone da Aplicação (Favicon & Identidade Visual) *(Novo - da lista de requisitos)*
* **Arquivos Impactados:** [`index.html`](file:///home/pedro/Dev/Playground/util/scrumban/teste_producao/index.html), criação de `favicon.svg` ou `assets/icon.svg`
* **Problema:** A aplicação não possui nenhum `favicon` ou ícone configurado no `<head>`. A aba do navegador exibe um ícone genérico cinza ou vazio, e a aplicação perde identidade ao ser adicionada aos favoritos ou empacotada com Tauri.
* **Atividades:**
  - Criar um ícone vetorial SVG minimalista e moderno respeitando a paleta terrosa do projeto (fundo offwhite, linhas geométricas ou representação elegante de colunas/cards em tons terracota `#BD6B58` e musgo `#94A086`).
  - Adicionar as tags `<link rel="icon" type="image/svg+xml" href="assets/icon.svg">` e `<link rel="apple-touch-icon" href="...">` no `<head>` de `index.html`.
* **Critério de Aceitação:** Ao abrir a página no navegador, a aba exibe o novo ícone nítido, temático e sem erros 404 de favicon no console.


---

### 🟢 Fase 2: Essência do Scrumban & Produtividade Solo (P1) — ✅ CONCLUÍDA

*Meta: Implementar as métricas ágeis de fluxo contínuo, gatilho de reabastecimento de tarefas e atalhos de alta produtividade para desenvolvedores.*

#### Ação 2.1 — Rastreamento de Ciclo de Vida e Métricas de Fluxo (Cycle & Lead Time)
* **Arquivos Impactados:** [`index.html`](file:///home/pedro/Dev/Playground/util/scrumban/teste_producao/index.html), [`js/app.js`](file:///home/pedro/Dev/Playground/util/scrumban/teste_producao/js/app.js)
* **Atividades:**
  - Adicionar o campo `startedAt: string (ISO)` gravado na primeira transição da tarefa para a coluna `progress`.
  - Criar função analítica para computar:
    - **Cycle Time Médio**: Diferença em dias entre `startedAt` e `completedAt`.
    - **Lead Time Médio**: Diferença em dias entre `createdAt` e `completedAt`.
    - **Throughput Semanal**: Quantidade de tarefas concluídas nos últimos 7 e 30 dias.
  - Criar um painel compacto no modal de histórico ou em seção expansível na barra lateral com indicadores visuais dessas três métricas.
* **Critério de Aceitação:** Tarefas movidas para *Done* alimentam automaticamente os cálculos de tempo médio de execução e throughput.

#### Ação 2.2 — Ponto de Reabastecimento (*Replenishment Trigger*)
* **Arquivos Impactados:** [`index.html`](file:///home/pedro/Dev/Playground/util/scrumban/teste_producao/index.html), [`js/app.js`](file:///home/pedro/Dev/Playground/util/scrumban/teste_producao/js/app.js)
* **Atividades:**
  - Adicionar configuração `replenishmentLimit` (padrão: 2) nas configurações do app.
  - Se o número de tarefas na coluna `TODO` for menor ou igual ao limite configurado e houver itens no `Backlog`, exibir um aviso discreto: *"Fila de TODO baixa — Puxe novas tarefas do Backlog"*.
* **Critério de Aceitação:** A coluna TODO avisa quando está esvaziando, incentivando a cadência contínua sem depender do fechamento de sprint.

#### Ação 2.3 — Atalhos Globais de Teclado para Solo Dev
* **Arquivo Impactado:** [`js/app.js`](file:///home/pedro/Dev/Playground/util/scrumban/teste_producao/js/app.js)
* **Atividades:**
  - Adicionar listener `keydown` na janela, ignorando eventos quando o foco estiver em `input`, `textarea` ou `select`:
    - Tecla `N`: Abre modal de criação de tarefa.
    - Tecla `/`: Foca imediatamente no campo de busca rápida.
    - Tecla `Esc`: Fecha modais abertos.
    - Teclas `1`, `2`, `3`, `4`: Alternam entre as abas (*Quadro*, *Sprints*, *Histórico*, *Configurações*).
  - Incluir ícone de ajuda com a lista de atalhos no rodapé da barra lateral.
* **Critério de Aceitação:** Todas as 4 abas, busca e criação podem ser operadas exclusivamente via teclado.

#### Ação 2.4 — Exclusão Segura com Mecanismo de Desfazer (*Undo Toast*)
* **Arquivos Impactados:** [`js/app.js`](file:///home/pedro/Dev/Playground/util/scrumban/teste_producao/js/app.js#L170-L226 e L1047-L1070)
* **Atividades:**
  - Substituir a confirmação bloqueante `confirm('Deseja excluir?')` por uma exclusão imediata da UI acompanhada de um toast de ação com botão **"Desfazer"** válido por 6 segundos.
  - Se o usuário clicar em "Desfazer", a tarefa é restaurada na mesma posição e coluna sem perda de dados.
* **Critério de Aceitação:** Usuário exclui acidentalmente uma tarefa e consegue recuperá-la em 1 clique no toast.

#### Ação 2.5 — Possibilidade de Criar Descrição para Sprints (Sprint Goal / Metas) *(Novo - da lista de requisitos)*
* **Arquivos Impactados:** [`index.html`](file:///home/pedro/Dev/Playground/util/scrumban/teste_producao/index.html#L248-L268), [`js/app.js`](file:///home/pedro/Dev/Playground/util/scrumban/teste_producao/js/app.js#L1354-L1470)
* **Problema:** Atualmente o formulário de sprints só permite cadastrar o nome da sprint (`sprintNome`) e as datas. No trabalho de desenvolvimento solo, uma sprint precisa de um objetivo claro e escopo detalhado (*Sprint Goal*), links úteis, critérios de entrega ou notas de contexto que expliquem o propósito do ciclo.
* **Atividades:**
  - Adicionar campo textarea no formulário de sprint: `<textarea id="sprintDescricao" placeholder="Descreva os objetivos principais, critérios de sucesso ou notas desta sprint..."></textarea>`.
  - Salvar `description` no objeto da sprint em `appState.sprints`.
  - Exibir a descrição no card da **Sprint Atual em Andamento** (com opção de ver mais/truncar elegantemente), nos cards de **Sprints Futuras** e no **Histórico de Conclusões**.
  - Garantir retrocompatibilidade com sprints legadas que não possuem o campo `description`.
* **Critério de Aceitação:** O usuário pode planejar uma sprint com nome e descrição detalhada; essa descrição é visível no planejamento, no card da sprint ativa e no registro de fechamento do histórico.

#### Ação 2.6 — Barra Lateral Retrátil & Expansível (Ganho de Espaço Horizontal) *(Novo - solicitação de usabilidade)*
* **Arquivos Impactados:** [`index.html`](file:///home/pedro/Dev/Playground/util/scrumban/v3/index.html), [`css/style.css`](file:///home/pedro/Dev/Playground/util/scrumban/v3/css/style.css), [`js/app.js`](file:///home/pedro/Dev/Playground/util/scrumban/v3/js/app.js)
* **Problema:** Em telas de laptop ou monitores convencionais, as 5 colunas do quadro Kanban precisam de espaço horizontal contínuo para visualização confortável de tarefas. O menu lateral fixo em 240px (`w-60`) ocupava espaço que poderia ser aproveitado para alargar as colunas do quadro.
* **Atividades:**
  - Permitir recolher e expandir o menu lateral através de botão no cabeçalho da sidebar e atalho de teclado global <kbd>[</kbd>.
  - Em modo recolhido (`collapsed`), a barra encolhe suavemente para 68px (`w-16`), centralizando os ícones dos botões de navegação, mantendo tooltips nativos completos e preservando o rodapé compacto.
  - Persistir o estado da barra no `localStorage` (`scrumban_sidebar_collapsed`) para manter a preferência do usuário entre recarregamentos.
* **Critério de Aceitação:** O usuário clica no botão de recolher ou pressiona <kbd>[</kbd>, a barra lateral encolhe suavemente e as colunas do quadro expandem horizontalmente para ocupar todo o espaço liberado.

---

### 🟢 Fase 3: Autonomia, Portabilidade & Relatórios (P2) — ✅ CONCLUÍDA

*Meta: Garantir funcionamento 100% offline, relatórios legíveis para diários de bordo e conforto visual noturno.*

#### Ação 3.1 — Exportação de Fechamento de Sprint em Markdown e CSV
* **Arquivos Impactados:** [`index.html`](file:///home/pedro/Dev/Playground/util/scrumban/teste_producao/index.html), [`js/app.js`](file:///home/pedro/Dev/Playground/util/scrumban/teste_producao/js/app.js#L1570-L1639)
* **Atividades:**
  - Em cada sprint arquivada na aba *Histórico*, adicionar botões:
    - **Copiar Markdown**: Formata o nome da sprint, período e lista de tarefas concluídas com checkbox `- [x]`, pronto para colar no Obsidian, Notion ou issue do GitHub.
    - **Baixar CSV**: Gera e baixa arquivo `.csv` com colunas estruturadas para controle financeiro/faturamento solo.
* **Critério de Aceitação:** 1 clique copia um resumo formatado para a área de transferência com notificação de sucesso.

#### Ação 3.2 — Eliminação da Dependência CDN do Tailwind CSS
* **Arquivos Impactados:** [`index.html`](file:///home/pedro/Dev/Playground/util/scrumban/teste_producao/index.html), diretório [`css/`](file:///home/pedro/Dev/Playground/util/scrumban/teste_producao/css)
* **Atividades:**
  - Gerar folha de estilo compilada e minificada localmente (`css/tailwind.min.css`) contendo todas as classes utilitárias utilizadas no projeto.
  - Remover a tag `<script src="https://cdn.tailwindcss.com">` do `<head>` de `index.html`.
  - Eliminar o warning de console e assegurar carregamento instantâneo mesmo com a placa de rede desativada.
* **Critério de Aceitação:** A aplicação carrega com layout idêntico e sem conexões externas de rede.

#### Ação 3.3 — Modo Escuro (*Dark Mode*) com Paleta Quente
* **Arquivos Impactados:** [`index.html`](file:///home/pedro/Dev/Playground/util/scrumban/teste_producao/index.html), [`css/style.css`](file:///home/pedro/Dev/Playground/util/scrumban/teste_producao/css/style.css), [`js/app.js`](file:///home/pedro/Dev/Playground/util/scrumban/teste_producao/js/app.js)
* **Atividades:**
  - Adicionar suporte à classe `.dark` via CSS custom properties, preservando o contraste dos tons de terracota, musgo e caramelo sobre fundo grafite/carvão (`#1C1A19`).
  - Adicionar botão alternador (Sol / Lua) no rodapé da barra lateral.
  - Salvar preferência de tema no `localStorage` com detecção automática inicial de `prefers-color-scheme`.
* **Critério de Aceitação:** Alternância suave entre tema claro e escuro sem flashes brancos ao recarregar a página.

---

### 🟢 Fase 4: Refatoração Arquitetural & Acessibilidade Mobile (P3) — ✅ CONCLUÍDA

*Meta: Manutenibilidade a longo prazo do código e usabilidade em tablets e smartphones.*

#### Ação 4.1 — Modularização do JavaScript em Módulos ES
* **Arquivos Impactados:** Refatoração de [`js/app.js`](file:///home/pedro/Dev/Playground/util/scrumban/v3/js/app.js) em múltiplos submódulos em `js/`
* **Atividades:**
  - Decompor o arquivo monólito em submódulos ES nativos:
    - `js/state.js`: Gestão de estado reativo, schema e utilitários de ID.
    - `js/storage.js`: IndexedDB, contingência e schema validation.
    - `js/metrics.js`: Métricas de Lead Time, Cycle Time, Throughput e exportação Markdown/CSV.
    - `js/sprints.js`: Cabeçalho de sprints e formulário de planejamento.
    - `js/sprint-closure.js`: Modal de conclusão de sprint e histórico.
    - `js/kanban.js`: Manipulação de colunas, ordenação e limites WIP.
    - `js/drag-drop.js`: Drag and drop nativo desktop e suporte a gestos touch com ghost element.
    - `js/task-details.js`: Modal de detalhes e checklist de subtarefas.
    - `js/task-edit.js`: Modal de criação e edição de tarefas.
    - `js/config.js`: Aba de configurações de projeto e limites.
    - `js/ui.js`: Modais, toasts e navegação de abas.
    - `js/sidebar.js`: Sidebar retrátil e drawer móvel.
    - `js/theme.js`: Dark mode e sincronização de tema.
    - `js/main.js`: Ponto de entrada (`<script type="module" src="js/main.js">`).
* **Critério de Aceitação:** Nenhum arquivo com mais de 350 linhas; separação estrita de responsabilidades.

#### Ação 4.2 — Suporte a Touch e Layout Responsivo para Dispositivos Móveis
* **Arquivos Impactados:** [`index.html`](file:///home/pedro/Dev/Playground/util/scrumban/v3/index.html), [`css/style.css`](file:///home/pedro/Dev/Playground/util/scrumban/v3/css/style.css), [`js/`](file:///home/pedro/Dev/Playground/util/scrumban/v3/js)
* **Atividades:**
  - Adicionar listener de gestos touch para reordenação de cards em celulares/tablets com ghost element e drop indicator.
  - Adicionar barra superior com menu hambúrguer para telas `< 768px` e drawer móvel com backdrop overlay.
  - Adicionar barra de abas de colunas do Kanban (`#kanban-mobile-tabs`) para visualização focada por coluna em telas pequenas.
* **Critério de Aceitação:** O quadro pode ser operado e reordenado confortavelmente em um smartphone.

---

## 📋 Checklist de Execução

- [x] **Fase 1: Correções Críticas & P0**
  - [x] 1.1 Corrigir exibição da sprint anterior no cabeçalho
  - [x] 1.2 Implementar reordenação vertical dos cards com persistência de `order` *(Item da imagem: mudar ordem das tarefas)*
  - [x] 1.3 Implementar feedback visual enfático para limite WIP estourado
  - [x] 1.4 Retirar tarefas do Backlog da barra de progresso da sprint *(Item da imagem: retirar backlog da barra de progressos)*
  - [x] 1.5 Criar e configurar o ícone/favicon da aplicação *(Item da imagem: criar um icone para a aplicacao)*
- [x] **Fase 2: Essência Scrumban & UX (P1)**
  - [x] 2.1 Adicionar `startedAt` e painel de métricas de fluxo (Lead/Cycle Time & Throughput)
  - [x] 2.2 Adicionar gatilho e aviso de reabastecimento na coluna TODO
  - [x] 2.3 Implementar atalhos globais de teclado (`N`, `/`, `Esc`, `1-4`, `[`, `?`)
  - [x] 2.4 Implementar exclusão segura com toast de Desfazer (*Undo*)
  - [x] 2.5 Adicionar campo de descrição/metas para Sprints *(Item da imagem: criar descricao para sprints)*
  - [x] 2.6 Implementar barra lateral retrátil & expansível com atalho `[`
- [x] **Fase 3: Autonomia, Portabilidade & Relatórios (P2)**
  - [x] 3.1 Adicionar exportação de fechamento de sprint em Markdown e CSV
  - [x] 3.2 Compilar CSS localmente e desativar script CDN do Tailwind
  - [x] 3.3 Adicionar Modo Escuro (*Dark Mode*) com alternador na barra lateral
- [x] **Fase 4: Arquitetura & Mobile (P3)**
  - [x] 4.1 Modularizar `app.js` em ES Modules nativos
  - [x] 4.2 Adicionar suporte a touch e layout mobile responsivo
- [ ] **Fase 4.5: Empacotamento Desktop Nativo (Tauri v2)** — 📋 *Planejada / Ambiente Pronto*
  - Detalhamento completo em: [`PLANO_DESKTOP_TAURI.md`](file:///home/pedro/Dev/Playground/util/scrumban/v4/PLANO_DESKTOP_TAURI.md)
- [ ] **Fase 5: Captura Remota de Tarefas (Telegram Bot & Inbox Desacoplada)** — 📋 *Planejada*
  - Detalhamento completo em: [`PLANO_CAPTURA_REMOTA_TELEGRAM.md`](file:///home/pedro/Dev/Playground/util/scrumban/v4/PLANO_CAPTURA_REMOTA_TELEGRAM.md)

---

## 🏁 Status do Projeto

- 🎉 **Fases 1 a 4 concluídas com êxito:** O Scrumban Pessoal v3/v4 está totalmente operacional, 100% offline-first, modularizado em ES Modules com suporte a Dark Mode, gestos touch e layout mobile.
- 📋 **Fase 4.5 (App Desktop Tauri v2):** Planejamento técnico pronto em [`PLANO_DESKTOP_TAURI.md`](file:///home/pedro/Dev/Playground/util/scrumban/v4/PLANO_DESKTOP_TAURI.md). Ambiente Linux verificado (Rust 1.95 e WebKitGTK já instalados).
- 📋 **Fase 5 (Telegram Bot / Inbox Remota):** Planejamento técnico finalizado em [`PLANO_CAPTURA_REMOTA_TELEGRAM.md`](file:///home/pedro/Dev/Playground/util/scrumban/v4/PLANO_CAPTURA_REMOTA_TELEGRAM.md) para execução futura.

