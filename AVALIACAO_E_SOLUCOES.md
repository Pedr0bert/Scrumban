# Diagnóstico, Avaliação e Propostas de Soluções — Scrumban Pessoal

> **Data de Emissão:** 12 de Setembro de 2026  
> **Ambiente:** Teste de Produção (`teste_producao/`)  
> **Foco:** Produtividade solo, cadência contínua, persistência offline-first e resiliência.

---

## 📑 Sumário Executivo

A aplicação **Scrumban Pessoal** apresenta um padrão arquitetural sólido e refinado para o ecossistema Vanilla JS:
- Persistência assíncrona robusta em **IndexedDB** com camada de migração e contingência para `localStorage`;
- Manipulação granular de nós no DOM (`moverCardNoDOM`) reduzindo *reflows* e *repaints*;
- Identificadores UUID nativos seguros via `crypto.randomUUID()`;
- Validação formal de schema na importação de JSON;
- Identidade visual madura, inspirada em tipografia editorial (*Crimson Pro*) e paleta terrosa harmônica.

Contudo, para atingir o estado da arte de uma ferramenta Scrumban para desenvolvedores solo, identificam-se lacunas metodológicas (reordenação de prioridade, métricas de fluxo, ponto de reabastecimento), pontos de atrito técnico (dependência de CDN em produção, monólito JS de ~1900 linhas) e oportunidades de melhoria de usabilidade (touch mobile, atalhos de teclado, histórico com exportação em Markdown e dark mode).

Abaixo detalham-se todos os pontos levantados com seus respectivos diagnósticos técnicos e soluções acionáveis.

---

## 🔍 Parte 1: O Que Está Faltando (Gaps Críticos) & Soluções Propostas

---

### 1. Reordenação Vertical de Cards na Mesma Coluna (Priorização Manual)

#### Diagnóstico
* **Arquivo:** [`js/app.js` (L819-L851 e L870-L893)](file:///home/pedro/Dev/Playground/util/scrumban/teste_producao/js/app.js#L870-L893)
* **Problema:** Ao soltar um card em uma coluna durante o Drag-and-Drop, o sistema invoca `targetContainer.appendChild(cardEl)`. O card é jogado invariavelmente para o final da lista. Além disso, o modelo de dados da tarefa não possui uma propriedade de ordenação (`order` ou `position`). No Kanban/Scrumban autêntico, a posição vertical expressa a prioridade imediata de execução: o desenvolvedor solo deve poder reordenar cards para definir o que será atacado a seguir.

#### Solução Proposta
1. **Adicionar propriedade `order` ao modelo de tarefas**:
   - Cada tarefa deve conter `order: number`. Ao criar uma tarefa, atribuir `order = 0` (ou o menor valor da coluna) para ficar no topo.
2. **Implementar inserção no ponto exato do drop**:
   - No evento `dragover` da coluna, calcular qual elemento está logo abaixo da posição do mouse (`e.clientY`):
   ```javascript
   function obterElementoAbaixoDoMouse(container, y) {
       const cardsNaoArrastados = [...container.querySelectorAll('.card-item:not(.dragging)')];
       return cardsNaoArrastados.reduce((maisProximo, card) => {
           const box = card.getBoundingClientRect();
           const offset = y - box.top - box.height / 2;
           if (offset < 0 && offset > maisProximo.offset) {
               return { offset: offset, element: card };
           } else {
               return maisProximo;
           }
       }, { offset: Number.NEGATIVE_INFINITY }).element;
   }
   ```
3. **Persistir a nova ordem**:
   - No evento `drop`, inserir o nó antes do elemento identificado (`container.insertBefore(cardEl, proximoEl)`).
   - Percorrer os cartões na coluna atualizada e redefinir o índice `order` das tarefas afetadas no `appState.tasks`, chamando `saveState()`.

---

### 2. Métricas de Fluxo Scrumban (Lead Time, Cycle Time & Throughput)

#### Diagnóstico
* **Arquivo:** [`js/app.js` (L1245-L1250, L1528-L1541)](file:///home/pedro/Dev/Playground/util/scrumban/teste_producao/js/app.js#L1245-L1250)
* **Problema:** A aplicação salva `createdAt` ao criar e `completedAt` ao marcar como *Done*. No entanto, não há registro do momento exato em que o trabalho foi iniciado (`startedAt`, transição para *In Progress*), impossibilitando o cálculo das duas métricas essenciais do Scrumban: **Lead Time** (tempo de vida total da ideia) e **Cycle Time** (tempo real de execução). O desenvolvedor solo fica sem visibilidade de gargalos ou da sua velocidade média semanal.

#### Solução Proposta
1. **Rastrear transições de ciclo de vida**:
   - Ao mover para `progress`, se a tarefa ainda não tiver `startedAt`, preencher:
     ```javascript
     if (novaColuna === 'progress' && !tarefa.startedAt) {
         tarefa.startedAt = new Date().toISOString();
     }
     ```
2. **Cálculo de Métricas em Função Dedicada**:
   ```javascript
   function calcularMetricasFluxo() {
       const concluidas = appState.tasks.filter(t => t.column === 'done' && t.completedAt);
       const itensHistorico = appState.history.flatMap(h => h.tasksDelivered || []);
       
       // Cycle Time Médio (em dias): completedAt - startedAt
       const cycleTimes = concluidas
           .filter(t => t.startedAt)
           .map(t => (new Date(t.completedAt) - new Date(t.startedAt)) / (1000 * 60 * 60 * 24));
       const avgCycleTime = cycleTimes.length ? (cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length).toFixed(1) : 'N/A';

       // Throughput Semanal (tarefas entregues nos últimos 7 e 30 dias)
       const agora = Date.now();
       const ultimos7Dias = concluidas.filter(t => (agora - new Date(t.completedAt)) <= 7 * 24 * 60 * 60 * 1000).length;

       return { avgCycleTime, ultimos7Dias, totalConcluidas: concluidas.length + itensHistorico.length };
   }
   ```
3. **Interface Visual**:
   - Adicionar uma seção resumida ou modal *"Métricas & Fluxo"* acessível pela barra lateral, com cards elegantes: *Cycle Time Médio*, *Throughput Semanal* e *Taxa de Entrega no Prazo*.

---

### 3. Ponto de Reabastecimento (*Order Point / Replenishment Trigger*)

#### Diagnóstico
* **Arquivo:** [`index.html` (L183-L194)](file:///home/pedro/Dev/Playground/util/scrumban/teste_producao/index.html#L183-L194), [`js/app.js`](file:///home/pedro/Dev/Playground/util/scrumban/teste_producao/js/app.js)
* **Problema:** No Scrum tradicional o planejamento ocorre a cada 2 semanas; no Scrumban o reabastecimento é puxado por demanda contínua. Quando a coluna **TODO** fica vazia ou abaixo de um patamar mínimo, o desenvolvedor solo perde a cadência contínua ou perde tempo escolhendo o que fazer.

#### Solução Proposta
1. **Configuração de `replenishmentLimit`**:
   - Em `appState.settings`, adicionar `replenishmentLimit: 2` (configurável na aba de Configurações).
2. **Gatilho de Alerta no Quadro**:
   - Na função `atualizarContadoresColunas()`, verificar se `contagemTODO <= replenishmentLimit`:
     ```javascript
     const todoCount = appState.tasks.filter(t => t.column === 'todo').length;
     const alertaReplenish = document.getElementById('alerta-reabastecimento');
     if (todoCount <= (appState.settings.replenishmentLimit || 2) && appState.tasks.filter(t => t.column === 'backlog').length > 0) {
         alertaReplenish?.classList.remove('hidden');
     } else {
         alertaReplenish?.classList.add('hidden');
     }
     ```
3. **Card/Banner Sutil de Reposição**:
   - Exibir na coluna TODO: *"Fila baixa (restam X itens) — Puxe mais tarefas do Backlog para manter o ritmo."*

---

### 4. Suporte a Dispositivos Móveis e Touchscreens

#### Diagnóstico
* **Arquivo:** [`js/app.js` (L854-L893)](file:///home/pedro/Dev/Playground/util/scrumban/teste_producao/js/app.js#L854-L893), [`index.html` (L42, L169)](file:///home/pedro/Dev/Playground/util/scrumban/teste_producao/index.html#L169)
* **Problema:** A API HTML5 Drag and Drop não dispara eventos de toque em smartphones e tablets. Adicionalmente, a barra lateral possui largura fixa de `w-60` (240px) e o container Kanban tem `min-w-[1050px]`, forçando rolagem bidirecional desconfortável em telas menores.

#### Solução Proposta
1. **Suporte a Touch no Drag and Drop**:
   - Adicionar polyfill leve sem dependências ou implementar captura via `touchstart`, `touchmove`, `elementFromPoint(touch.clientX, touch.clientY)` e `touchend`.
   - Alternativamente, intensificar os botões de ação rápida existentes (setas `<` e `>` do card) tornando-os sempre visíveis em telas touch (`@media (pointer: coarse)`).
2. **Layout Responsivo Mobile**:
   - Transformar a barra lateral em uma gaveta retrátil (*Drawer*) acionada por botão hambúrguer flutuante em telas `< 768px`.
   - Adicionar seletor por abas de coluna no mobile (ex: botões rápidos `[Backlog] [TODO] [In Progress] [Done]`) para focar em uma coluna por vez na tela do celular sem rolagem horizontal excessiva.

---

### 5. Atalhos de Teclado (*Power User Solo Dev*)

#### Diagnóstico
* **Arquivo:** [`index.html`](file:///home/pedro/Dev/Playground/util/scrumban/teste_producao/index.html), [`js/app.js`](file:///home/pedro/Dev/Playground/util/scrumban/teste_producao/js/app.js)
* **Problema:** O desenvolvedor precisa recorrer ao mouse para qualquer ação simples (criar tarefa, buscar, alternar abas, fechar detalhes).

#### Solução Proposta
1. **Adicionar Listener Global de Teclado**:
   ```javascript
   window.addEventListener('keydown', (e) => {
       // Ignorar atalhos se o usuário estiver digitando em campos de texto
       const tag = e.target.tagName.toLowerCase();
       if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) {
           if (e.key === 'Escape') e.target.blur();
           return;
       }

       switch (e.key.toLowerCase()) {
           case 'n':
               e.preventDefault();
               abrirModalTarefa();
               break;
           case '/':
               e.preventDefault();
               document.getElementById('buscaRapida')?.focus();
               break;
           case '1':
               mudarAba('view-quadro');
               break;
           case '2':
               mudarAba('view-sprints');
               break;
           case '3':
               mudarAba('view-historico');
               break;
           case '4':
               mudarAba('view-config');
               break;
       }
   });
   ```
2. **Legenda Discreta**:
   - Inserir um botão ou modal de ajuda `?` exibindo os atalhos disponíveis.

---

### 6. Exportação de Relatórios de Fechamento (Markdown e CSV)

#### Diagnóstico
* **Arquivo:** [`js/app.js` (L1570-L1639)](file:///home/pedro/Dev/Playground/util/scrumban/teste_producao/js/app.js#L1570-L1639)
* **Problema:** A exportação atual gera somente um dump JSON do banco inteiro. No dia a dia de um desenvolvedor solo (freelancer ou mantenedor de produto), é necessário colar o resumo das entregas em diários de bordo (Notion, Obsidian, GitHub Discussions) ou gerar uma planilha CSV de entregas para clientes.

#### Solução Proposta
1. **Gerador de Markdown do Histórico**:
   - Para cada sprint fechada no histórico, adicionar um botão *"Copiar em Markdown"*:
   ```javascript
   function gerarMarkdownSprint(hist) {
       let md = `## Sprint: ${hist.sprintName}\n`;
       md += `**Período:** ${formatarData(hist.startDate)} a ${formatarData(hist.endDate)}\n`;
       md += `**Concluída em:** ${formatarData(hist.closedAt?.split('T')[0])}\n\n`;
       md += `### Entregas Realizadas:\n`;
       hist.tasksDelivered.forEach(t => {
           md += `- [x] **${t.title}** (${t.project || 'Geral'}) — Prioridade: ${t.priority.toUpperCase()}\n`;
       });
       return md;
   }
   ```
2. **Exportar CSV de Tarefas Concluídas**:
   - Criar download de arquivo `.csv` formatado com `ID`, `Título`, `Projeto`, `Prioridade`, `Data de Criação` e `Data de Conclusão`.

---

## 🛠️ Parte 2: Onde Pode Melhorar (Refinamentos & Arquitetura) & Soluções Propostas

---

### 7. Eliminar Dependência de CDN do Tailwind CSS (Build Offline-first)

#### Diagnóstico
* **Arquivo:** [`index.html` (L14-L34)](file:///home/pedro/Dev/Playground/util/scrumban/teste_producao/index.html#L14-L34)
* **Problema:** `<script src="https://cdn.tailwindcss.com"></script>` emite um warning de performance em console e torna o carregamento dependente de conexão à internet. Se o desenvolvedor abrir a aplicação offline ou em ambiente local isolado sem cache prévio, a interface quebra totalmente.

#### Solução Proposta
1. **Compilar folha de estilos estática e autocontida**:
   - Instalar Tailwind CLI localmente ou rodar comando de compilação:
     ```bash
     npx tailwindcss -i ./css/input.css -o ./css/tailwind.min.css --minify
     ```
2. **Substituir o script CDN por link CSS local**:
   - No `<head>` de `index.html`:
     ```html
     <link rel="stylesheet" href="css/tailwind.min.css">
     <link rel="stylesheet" href="css/style.css">
     ```
   - Isso zera o tempo de avaliação JS de estilização em tempo de execução e garante funcionamento 100% offline.

---

### 8. Modularização do JavaScript (Decomposição do Monólito de 1865 Linhas)

#### Diagnóstico
* **Arquivo:** [`js/app.js`](file:///home/pedro/Dev/Playground/util/scrumban/teste_producao/js/app.js)
* **Problema:** Mais de 1800 linhas agrupadas em um único arquivo, misturando banco de dados, regras de negócio de sprint, manipulação de cards, formatação e eventos. Dificulta manutenção, criação de testes e reutilização.

#### Solução Proposta
1. **Adotar ES Modules nativos no navegador** (sem necessidade de bundlers complexos):
   ```
   js/
   ├── main.js        # Ponto de entrada, listeners de bootstrap e atalhos
   ├── storage.js     # IndexedDB, localStorage, migração e backup
   ├── state.js       # Definição do appState, schemas e getters/setters
   ├── kanban.js      # Renderização de colunas, cards, drag-and-drop e DOM granular
   ├── sprints.js     # Ciclo de vida das sprints, fechamento e histórico
   ├── ui.js          # Toasts, abas, modais e filtros
   └── utils.js       # escapeHTML, formatação de datas e gerador de IDs
   ```
2. **Chamada no HTML**:
   ```html
   <script type="module" src="js/main.js"></script>
   ```

---

### 9. Resolução de Bug na Seleção da Sprint Passada no Cabeçalho

#### Diagnóstico
* **Arquivo:** [`js/app.js` (L486)](file:///home/pedro/Dev/Playground/util/scrumban/teste_producao/js/app.js#L486)
* **Código Atual:**
  ```javascript
  const pastSprint = appState.sprints.find(s => s.status === 'past');
  ```
* **Problema:** O método `.find()` retorna o primeiro item do array. Conforme novas sprints são concluídas, a sprint antiga continua sendo a primeira da lista, fazendo com que o cabeçalho exiba eternamente a sprint mais velha em vez da recém-finalizada.

#### Solução Proposta
* Obter a sprint passada diretamente do registro mais recente do histórico ou ordenar por data:
  ```javascript
  // Solução robusta: buscar no histórico ou filtrar sprints passadas ordenadas
  const pastSprint = appState.history.length > 0 
      ? { name: appState.history[0].sprintName, endDate: appState.history[0].endDate }
      : appState.sprints.filter(s => s.status === 'past').sort((a, b) => new Date(b.endDate) - new Date(a.endDate))[0];
  ```

---

### 10. Alerta e Destaque Visual para Violação do Limite WIP

#### Diagnóstico
* **Arquivo:** [`js/app.js` (L572-L591)](file:///home/pedro/Dev/Playground/util/scrumban/teste_producao/js/app.js#L572-L591), [`index.html` (L195-L206)](file:///home/pedro/Dev/Playground/util/scrumban/teste_producao/index.html#L195-L206)
* **Problema:** Quando as tarefas em *In Progress* superam o `wipLimit`, apenas o texto do badge muda discretamente de cor (`bg-terracota/20 text-terracota`). A coluna em si permanece normal, sem transmitir ao usuário a sensação de sobrecarga de contexto.

#### Solução Proposta
1. **Adicionar classes reativas na coluna `col-progress`**:
   ```javascript
   function atualizarWipBadge() {
       const progressoTotal = appState.tasks.filter(t => t.column === 'progress').length;
       const limite = appState.settings.wipLimit;
       const colunaProgressEl = document.getElementById('col-progress')?.closest('section');
       
       if (limite > 0 && progressoTotal > limite) {
           colunaProgressEl?.classList.add('border-terracota', 'bg-red-50/20');
           colunaProgressEl?.querySelector('header')?.classList.add('bg-red-100/40');
           mostrarToast(`Atenção: Limite WIP violado (${progressoTotal}/${limite}). Foque em concluir tarefas antes de iniciar novas.`, 'aviso', 5000);
       } else {
           colunaProgressEl?.classList.remove('border-terracota', 'bg-red-50/20');
           colunaProgressEl?.querySelector('header')?.classList.remove('bg-red-100/40');
       }
   }
   ```

---

### 11. Mecanismo de Desfazer (*Undo*) com Notificação Reversível

#### Diagnóstico
* **Arquivo:** [`js/app.js` (L1047-L1070)](file:///home/pedro/Dev/Playground/util/scrumban/teste_producao/js/app.js#L1047-L1070)
* **Problema:** A exclusão de tarefas depende de uma caixa de diálogo nativa `confirm()`. Se o usuário confirmar por distração, a perda é instantânea e requer restauração de backup manual.

#### Solução Proposta
1. **Padrão de Exclusão com Janela de Desfazer**:
   - Remover temporariamente a tarefa do quadro (armazenando-a em uma variável `tarefaExcluidaTemporariamente`).
   - Exibir um toast de sucesso com botão de ação:
     ```javascript
     function excluirTarefaComUndo(taskId) {
         const idx = appState.tasks.findIndex(t => t.id === taskId);
         if (idx === -1) return;
         
         const [tarefaRemovida] = appState.tasks.splice(idx, 1);
         saveState();
         renderizarQuadro();
         fecharModalDetalhes();

         mostrarToastComAcao(
             `Tarefa "${tarefaRemovida.title}" excluída.`,
             'Desfazer',
             () => {
                 appState.tasks.splice(idx, 0, tarefaRemovida);
                 saveState();
                 renderizarQuadro();
                 mostrarToast('Exclusão desfeita!', 'sucesso');
             },
             6000
         );
     }
     ```

---

### 12. Modo Escuro (Dark Mode) com Preservação da Identidade Visual

#### Diagnóstico
* **Arquivo:** [`index.html` (L39)](file:///home/pedro/Dev/Playground/util/scrumban/teste_producao/index.html#L39), [`css/style.css`](file:///home/pedro/Dev/Playground/util/scrumban/teste_producao/css/style.css)
* **Problema:** O fundo fixo `#FAF8F5` e os cartões brancos forçam a vista em ambientes com baixa iluminação, comuns em longas jornadas noturnas de desenvolvedores autônomos.

#### Solução Proposta
1. **Adicionar Paleta Dark no `:root` e classe `.dark`**:
   ```css
   .dark {
       --bg-offwhite: #1C1A19;
       --border-beige: #3A3634;
       --text-dark: #F3EFE9;
       background-color: #171615;
       color: #F3EFE9;
   }
   .dark .bg-white {
       background-color: #242220 !important;
       border-color: #3A3634 !important;
   }
   .dark .bg-offwhite {
       background-color: #1E1C1B !important;
   }
   ```
2. **Toggle na Barra Lateral**:
   - Um botão discreto (Sol / Lua) no rodapé da barra lateral que salva a preferência no `localStorage`.

---

### 13. Retirar Tarefas do Backlog da Barra de Progresso da Sprint

#### Diagnóstico
* **Arquivo:** [`js/app.js` (L513-L538)](file:///home/pedro/Dev/Playground/util/scrumban/teste_producao/js/app.js#L513-L538)
* **Problema:** A fórmula atual de progresso da sprint no cabeçalho considera todas as tarefas atribuídas ao ciclo (`t.sprintId === curSprint.id`), inclusive aquelas que ainda estão na coluna `backlog`. O Backlog funciona como caixa de entrada/ideário; se o desenvolvedor tiver 25 ideias no backlog e concluir 2 de 3 tarefas comprometidas em TODO/Progress, o indicador marcará `2/28 (7%)` em vez de `2/3 (66%)`, gerando sensação ilusória de estagnação.

#### Solução Proposta
1. **Filtrar apenas itens ativos comprometidos com o ciclo**:
   ```javascript
   // Apenas tarefas puxadas para o ciclo ativo (TODO, Progress, Testing, Done)
   const tasksComprometidas = tasksSprint.filter(t => t.column !== 'backlog');
   const tasksDone = tasksComprometidas.filter(t => t.column === 'done').length;
   const totalAtivas = tasksComprometidas.length;
   const percentDone = totalAtivas > 0 ? Math.round((tasksDone / totalAtivas) * 100) : 0;
   ```
2. O progresso passa a espelhar a taxa de execução real do compromisso da sprint.

---

### 14. Criação do Ícone da Aplicação (Favicon & Identidade Visual)

#### Diagnóstico
* **Arquivo:** [`index.html`](file:///home/pedro/Dev/Playground/util/scrumban/teste_producao/index.html)
* **Problema:** Ausência de `favicon` configurado no `<head>`. A aba do navegador exibe o ícone em branco/padrão, e ao fixar a aba ou compilar para Desktop (Tauri) o app não tem identificação visual própria.

#### Solução Proposta
1. Criar um favicon vetorial SVG (`assets/icon.svg`) com visual harmônico com a paleta terrosa (ex: símbolo estilizado de quadro Kanban com acentos em terracota `#BD6B58` e musgo `#94A086`).
2. Declarar `<link rel="icon" type="image/svg+xml" href="assets/icon.svg">` no `<head>` do `index.html`.

---

### 15. Possibilidade de Criar Descrição para Sprints (Sprint Goal / Metas)

#### Diagnóstico
* **Arquivos:** [`index.html` (L248-L268)](file:///home/pedro/Dev/Playground/util/scrumban/teste_producao/index.html#L248-L268), [`js/app.js`](file:///home/pedro/Dev/Playground/util/scrumban/teste_producao/js/app.js#L1354-L1470)
* **Problema:** Sprints possuem apenas título e datas de início/fim. Não há local para registrar o objetivo estratégico do ciclo (*Sprint Goal*), notas de arquitetura ou critérios de sucesso da entrega autônoma.

#### Solução Proposta
1. Adicionar campo `<textarea id="sprintDescricao" placeholder="Objetivo principal, metas ou notas da sprint..."></textarea>` no formulário de sprint.
2. Persistir a propriedade `description` no objeto da sprint em `appState.sprints`.
3. Renderizar o texto da meta no card da Sprint Ativa, nas Sprints Futuras e no registro do Histórico de Conclusões.

---

## 🗺️ Matriz de Prioridade e Roadmap de Execução

| Prioridade | Iniciativa | Categoria | Esforço | Impacto |
| :---: | :--- | :---: | :---: | :---: |
| **P0** | **Reordenação vertical de cards na mesma coluna** *(mudar ordem das tarefas)* | Funcionalidade | Médio | 🔥 Alto |
| **P0** | **Correção da seleção da sprint passada no cabeçalho** | Correção de Bug | Baixo | 🔥 Alto |
| **P0** | **Retirar Backlog da barra de progresso da sprint** | Regra de Negócio | Baixo | 🔥 Alto |
| **P0** | **Criar ícone da aplicação (Favicon SVG)** | Identidade Visual | Baixo | ⚡ Médio |
| **P1** | **Possibilidade de criar descrição para sprints** *(Sprint Goal)* | Funcionalidade | Baixo | ⚡ Alto |
| **P1** | **Atalhos de Teclado (`N`, `/`, `Esc`, `1-4`)** | Produtividade | Baixo | ⚡ Médio-Alto |
| **P1** | **Métricas de Fluxo (Cycle Time, Lead Time & Throughput)** | Scrumban Metodológico | Médio | ⚡ Alto |
| **P1** | **Destaque visual enfático de WIP estourado** | Regra de Negócio | Baixo | ⚡ Médio |
| **P1** | **Ponto de Reabastecimento (*Order Point*)** | Scrumban Metodológico | Baixo | ⚡ Médio |
| **P2** | **Exportação do Histórico em Markdown e CSV** | Produtividade | Baixo | 💡 Médio |
| **P2** | **Compilação local do Tailwind CSS (Sem CDN)** | Performance & Offline | Médio | 💡 Alto |
| **P2** | **Mecanismo de Desfazer (*Undo*) nas Exclusões** | UX / Segurança | Baixo | 💡 Médio |
| **P3** | **Suporte Touch Mobile / Layout Responsivo** | Acessibilidade | Alto | 💡 Médio |
| **P3** | **Modularização do JavaScript em ES Modules** | Arquitetura | Alto | 💡 Médio |
| **P3** | **Modo Escuro (Dark Mode)** | Estética & Conforto | Médio | 💡 Médio |

---

## 📌 Conclusão

A base atual é excelente e já oferece estabilidade e persistência via IndexedDB. Com a integração dos novos requisitos da imagem (reordenação das tarefas, exclusão do backlog da barra de progresso, ícone próprio e descrição de sprints), o projeto dá um salto em clareza operacional, identidade visual e precisão metodológica para desenvolvimento autônomo.
