(() => {
  // js/state.js
  var COLUNAS = ["backlog", "todo", "progress", "testing", "done"];
  var DEFAULT_STATE = {
    settings: {
      wipLimit: 2,
      replenishmentLimit: 2,
      projects: ["Meu Produto", "Freelance / Clientes", "Estudos & R&D", "Administrativo"],
      lastBackupDate: null,
      subtasksVisibility: "all"
      // 'all' (todas no quadro) ou 'parent_only' (apenas tarefas pai no quadro)
    },
    sprints: [],
    tasks: [],
    history: []
  };
  var appState = JSON.parse(JSON.stringify(DEFAULT_STATE));
  function setAppState(novoEstado) {
    appState = novoEstado;
  }
  var PRIORIDADE_CONFIG = {
    alta: { cor: "bg-terracota text-white", label: "Alta Prioridade", border: "border-terracota" },
    media: { cor: "bg-media text-white", label: "M\xE9dia Prioridade", border: "border-media" },
    baixa: { cor: "bg-musgo text-white", label: "Baixa Prioridade", border: "border-musgo" }
  };
  var DIFICULDADE_CONFIG = {
    trivial: { label: "Trivial", corDot: "bg-[#86efac]", hex: "#86efac", border: "border-[#4ade80]" },
    facil: { label: "F\xE1cil", corDot: "bg-[#16a34a]", hex: "#16a34a", border: "border-[#15803d]" },
    media: { label: "M\xE9dia", corDot: "bg-[#facc15]", hex: "#facc15", border: "border-[#eab308]" },
    dificil: { label: "Dif\xEDcil", corDot: "bg-[#ef4444]", hex: "#ef4444", border: "border-[#dc2626]" },
    muito_dificil: { label: "Muito Dif\xEDcil", corDot: "bg-[#991b1b]", hex: "#991b1b", border: "border-[#7f1d1d]" }
  };
  var COLUNA_NOMES = {
    backlog: "Backlog (Entrada)",
    todo: "TODO (Pr\xF3ximas)",
    progress: "In Progress (Em Foco)",
    testing: "Testing (Revis\xE3o)",
    done: "Done (Entregue)"
  };
  var uiFilters = {
    search: "",
    project: "all",
    priority: "all",
    onlyOverdue: false
  };
  function garantirOrdemTarefas() {
    COLUNAS.forEach((col) => {
      const tasksCol = appState.tasks.filter((t) => t.column === col);
      tasksCol.forEach((t, idx) => {
        if (typeof t.order !== "number") {
          t.order = idx;
        }
      });
    });
  }
  function gerarId(prefixo = "") {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      const uuid = crypto.randomUUID();
      return prefixo ? `${prefixo}-${uuid}` : uuid;
    }
    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      bytes[6] = bytes[6] & 15 | 64;
      bytes[8] = bytes[8] & 63 | 128;
      const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
      const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
      return prefixo ? `${prefixo}-${uuid}` : uuid;
    }
    const fallback = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    return prefixo ? `${prefixo}-${fallback}` : fallback;
  }
  function formatarData(dataIso) {
    if (!dataIso) return "";
    try {
      const [ano, mes, dia] = dataIso.split("-");
      return `${dia}/${mes}/${ano}`;
    } catch {
      return dataIso;
    }
  }
  function formatarDataCurta(dataIso) {
    if (!dataIso) return "";
    try {
      const [, mes, dia] = dataIso.split("-");
      return `${dia}/${mes}`;
    } catch {
      return dataIso;
    }
  }
  function escapeHTML(str) {
    if (!str) return "";
    return String(str).replace(
      /[&<>'"]/g,
      (tag) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;"
      })[tag] || tag
    );
  }
  function calcularStatusPrazo(dueDateStr, isDone) {
    if (!dueDateStr) return { status: "none", label: "Sem prazo", badgeText: "", dias: 0 };
    if (isDone) return { status: "done", label: "Conclu\xEDda", badgeText: formatarDataCurta(dueDateStr), dias: 0 };
    const hoje = /* @__PURE__ */ new Date();
    hoje.setHours(0, 0, 0, 0);
    const partes = dueDateStr.split("-");
    if (partes.length !== 3) return { status: "none", label: "Data inv\xE1lida", badgeText: "", dias: 0 };
    const [ano, mes, dia] = partes.map(Number);
    const dataLimite = new Date(ano, mes - 1, dia);
    dataLimite.setHours(0, 0, 0, 0);
    const diffMs = dataLimite.getTime() - hoje.getTime();
    const diffDias = Math.round(diffMs / (1e3 * 60 * 60 * 24));
    if (diffDias < 0) {
      const atraso = Math.abs(diffDias);
      return {
        status: "overdue",
        dias: atraso,
        label: atraso === 1 ? "1 dia de atraso" : `${atraso} dias de atraso`,
        badgeText: atraso === 1 ? "1d atrasado" : `${atraso}d atrasado`,
        fullDate: formatarData(dueDateStr)
      };
    } else if (diffDias === 0) {
      return {
        status: "today",
        dias: 0,
        label: "Vence hoje",
        badgeText: "Hoje",
        fullDate: formatarData(dueDateStr)
      };
    } else if (diffDias === 1) {
      return {
        status: "tomorrow",
        dias: 1,
        label: "Vence amanh\xE3",
        badgeText: "Amanh\xE3",
        fullDate: formatarData(dueDateStr)
      };
    } else {
      return {
        status: "future",
        dias: diffDias,
        label: `Restam ${diffDias} dias`,
        badgeText: formatarDataCurta(dueDateStr),
        fullDate: formatarData(dueDateStr)
      };
    }
  }
  function tarefaVisivelNoQuadro(tarefa) {
    if (appState.settings && appState.settings.subtasksVisibility === "parent_only" && tarefa.parentId) {
      return false;
    }
    return true;
  }
  function tarefaCorrespondeFiltros(tarefa) {
    if (!tarefaVisivelNoQuadro(tarefa)) return false;
    if (uiFilters.onlyOverdue) {
      if (tarefa.column === "done") return false;
      if (calcularStatusPrazo(tarefa.dueDate, false).status !== "overdue") return false;
    }
    if (uiFilters.project !== "all" && tarefa.project !== uiFilters.project) return false;
    if (uiFilters.priority !== "all" && tarefa.priority !== uiFilters.priority) return false;
    if (uiFilters.search.trim()) {
      const termo = uiFilters.search.toLowerCase();
      const matchTitulo = (tarefa.title || "").toLowerCase().includes(termo);
      const matchDesc = (tarefa.description || "").toLowerCase().includes(termo);
      const matchProj = (tarefa.project || "").toLowerCase().includes(termo);
      let matchPai = false;
      if (tarefa.parentId) {
        const pai = appState.tasks.find((t) => t.id === tarefa.parentId);
        if (pai && (pai.title || "").toLowerCase().includes(termo)) {
          matchPai = true;
        }
      }
      if (!matchTitulo && !matchDesc && !matchProj && !matchPai) return false;
    }
    return true;
  }
  function obterDescendentesIds(taskId) {
    const ids = /* @__PURE__ */ new Set();
    function coletar(pId) {
      const filhas = appState.tasks.filter((t) => t.parentId === pId);
      filhas.forEach((f) => {
        ids.add(f.id);
        coletar(f.id);
      });
    }
    coletar(taskId);
    return ids;
  }

  // js/sprints.js
  function calcularProgressoSprint() {
    const tasksComprometidas = appState.tasks.filter((t) => t.column !== "backlog");
    if (tasksComprometidas.length === 0) {
      return {
        totalTarefas: 0,
        tarefasDone: 0,
        progressoEquivalente: 0,
        percentDone: 0,
        totalChecklist: 0,
        checklistDone: 0,
        totalFilhas: 0,
        filhasDone: 0
      };
    }
    const committedParentIds = /* @__PURE__ */ new Set();
    tasksComprometidas.forEach((t) => {
      if (t.parentId) {
        committedParentIds.add(t.parentId);
      }
    });
    const tarefasExecutaveis = tasksComprometidas.filter((t) => !committedParentIds.has(t.id));
    let progressoEquivalente = 0;
    let tarefasDone = 0;
    let totalChecklist = 0;
    let checklistDone = 0;
    let totalFilhas = 0;
    let filhasDone = 0;
    tarefasExecutaveis.forEach((t) => {
      if (t.parentId) {
        totalFilhas++;
        if (t.column === "done") filhasDone++;
      }
      const temChecklist = Array.isArray(t.subtasks) && t.subtasks.length > 0;
      let checklistScore = 0;
      if (temChecklist) {
        const stDone = t.subtasks.filter((s) => s.done).length;
        const stTotal = t.subtasks.length;
        totalChecklist += stTotal;
        checklistDone += stDone;
        checklistScore = stDone / stTotal;
      }
      if (t.column === "done") {
        tarefasDone++;
        progressoEquivalente += 1;
      } else {
        if (temChecklist && checklistScore > 0) {
          progressoEquivalente += checklistScore;
        }
      }
    });
    const totalTarefas = tarefasExecutaveis.length;
    const percentDone = totalTarefas > 0 ? Math.min(100, Math.round(progressoEquivalente / totalTarefas * 100)) : 0;
    return {
      totalTarefas,
      tarefasDone,
      progressoEquivalente,
      percentDone,
      totalChecklist,
      checklistDone,
      totalFilhas,
      filhasDone
    };
  }
  function renderizarHeaderSprints2() {
    let pastSprint = null;
    if (appState.history && appState.history.length > 0) {
      const ultimoHist = appState.history[0];
      pastSprint = appState.sprints.find((s) => s.status === "past" && (s.id === ultimoHist.sprintId || s.name === ultimoHist.sprintName));
      if (!pastSprint) {
        pastSprint = { name: ultimoHist.sprintName, endDate: ultimoHist.endDate };
      }
    }
    if (!pastSprint) {
      const pastSprints = appState.sprints.filter((s) => s.status === "past");
      if (pastSprints.length > 0) {
        pastSprints.sort((a, b) => (b.endDate || "").localeCompare(a.endDate || ""));
        pastSprint = pastSprints[0];
      }
    }
    const curSprint = appState.sprints.find((s) => s.status === "current");
    const nextSprint = appState.sprints.find((s) => s.status === "future");
    const elPast = document.getElementById("header-sprint-past");
    if (elPast) {
      if (pastSprint) {
        elPast.innerHTML = `
                <p class="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-0.5 truncate">Passada</p>
                <h3 class="font-serif text-sm line-through text-gray-500 truncate" title="${escapeHTML(pastSprint.name)}">${escapeHTML(pastSprint.name)}</h3>
            `;
        elPast.classList.remove("hidden");
      } else {
        elPast.classList.add("hidden");
      }
    }
    const elCur = document.getElementById("header-sprint-current");
    if (elCur) {
      if (curSprint) {
        let diasRestantesTxt = "";
        if (curSprint.endDate) {
          diasRestantesTxt = `Termina em ${formatarDataCurta(curSprint.endDate)}`;
        }
        const progresso = calcularProgressoSprint();
        const concluidasStr = Number(progresso.progressoEquivalente.toFixed(1)).toString();
        const percentDone = progresso.percentDone;
        const totalSprint = progresso.totalTarefas;
        let tooltipProgresso = `Progresso da Sprint: ${concluidasStr} de ${totalSprint} tarefas equivalentes (${percentDone}%)`;
        if (progresso.tarefasDone > 0) tooltipProgresso += ` \u2022 ${progresso.tarefasDone} card(s) em Done`;
        if (progresso.totalChecklist > 0) tooltipProgresso += ` \u2022 ${progresso.checklistDone}/${progresso.totalChecklist} itens de checklist`;
        if (progresso.totalFilhas > 0) tooltipProgresso += ` \u2022 ${progresso.filhasDone}/${progresso.totalFilhas} sub-tarefas filhas`;
        elCur.innerHTML = `
                <div class="min-w-0 flex-1">
                    <p class="text-xs font-bold uppercase tracking-wider text-terracota mb-0.5 sm:mb-1 truncate">
                        Atual ${diasRestantesTxt ? "\u2022 " + diasRestantesTxt : ""}
                    </p>
                    <h2 class="font-serif text-xl sm:text-2xl lg:text-3xl font-bold leading-none text-dark truncate" title="${escapeHTML(curSprint.name)}">
                        ${escapeHTML(curSprint.name)}
                    </h2>
                </div>

                <!-- Barra de Progresso Integrada (com Sub-tarefas e Checklists) -->
                <div class="hidden sm:flex flex-col ml-2 sm:ml-3 pl-3 sm:pl-4 border-l border-beige text-xs pb-0.5 shrink-0 cursor-help" title="${tooltipProgresso}">
                    <div class="flex items-center justify-between gap-1 mb-1">
                        <span class="text-gray-500 font-serif leading-none">Progresso</span>
                        <span class="text-[10px] text-musgo font-semibold leading-none">${percentDone}%</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <div class="w-16 sm:w-20 lg:w-24 bg-beige h-2 rounded-full overflow-hidden shrink-0">
                            <div class="bg-musgo h-full transition-all duration-300" style="width: ${percentDone}%"></div>
                        </div>
                        <span class="font-semibold text-dark font-mono text-[11px] whitespace-nowrap">${concluidasStr}/${totalSprint}</span>
                    </div>
                </div>
            `;
      } else {
        elCur.innerHTML = `
                <div class="min-w-0">
                    <p class="text-xs font-bold uppercase tracking-wider text-gray-400 mb-0.5 sm:mb-1 truncate">
                        Nenhuma Sprint Ativa
                    </p>
                    <button onclick="mudarAba('view-sprints')" class="font-serif text-base sm:text-lg lg:text-xl font-bold text-gray-600 hover:text-terracota transition-colors flex items-center gap-1.5 underline decoration-dotted text-left truncate">
                        <span class="truncate">Planejar nova sprint</span>
                        <svg class="w-4 h-4 inline shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                    </button>
                </div>
            `;
      }
    }
    const elNext = document.getElementById("header-sprint-next");
    if (elNext) {
      if (nextSprint) {
        elNext.innerHTML = `
                <p class="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-0.5 truncate">Pr\xF3xima (${formatarDataCurta(nextSprint.startDate)})</p>
                <h3 class="font-serif text-sm text-gray-700 truncate" title="${escapeHTML(nextSprint.name)}">${escapeHTML(nextSprint.name)}</h3>
            `;
        elNext.classList.remove("hidden");
      } else {
        elNext.classList.add("hidden");
      }
    }
  }
  function renderizarAbaSprints2() {
    const container = document.getElementById("sprints-lista-conteudo");
    if (!container) return;
    const cur = appState.sprints.find((s) => s.status === "current");
    const future = appState.sprints.filter((s) => s.status === "future");
    container.innerHTML = "";
    const fragment = document.createDocumentFragment();
    const sprintAtualWrapper = document.createElement("div");
    sprintAtualWrapper.className = "mb-8 p-6 bg-white border-2 border-terracota rounded-sm shadow-sm relative";
    sprintAtualWrapper.innerHTML = `
        <span class="absolute -top-3 left-6 bg-terracota text-white text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm">
            Sprint Atual em Andamento
        </span>
        ${cur ? (() => {
      const prog = calcularProgressoSprint();
      const concluidasStr = Number(prog.progressoEquivalente.toFixed(1)).toString();
      return `
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div class="min-w-0 flex-1">
                    <h3 class="font-serif text-2xl font-bold text-dark mb-1">${escapeHTML(cur.name)}</h3>
                    ${cur.description ? `<p class="sprint-descricao-box text-sm font-sans text-dark mt-2 mb-3 whitespace-pre-line p-3 rounded-sm leading-relaxed">${escapeHTML(cur.description)}</p>` : ""}
                    <p class="text-sm font-sans text-gray-600 mb-3">
                        Per\xEDodo: <strong class="text-dark">${formatarData(cur.startDate)}</strong> at\xE9 <strong class="text-dark">${formatarData(cur.endDate)}</strong>
                    </p>
                    <div class="max-w-md bg-offwhite/80 p-2.5 rounded-sm border border-beige/60">
                        <div class="flex items-center justify-between text-xs mb-1.5 font-sans">
                            <span class="text-gray-500">Progresso integrado (tarefas, filhas e checklists):</span>
                            <span class="font-mono font-bold text-dark">${concluidasStr}/${prog.totalTarefas} (${prog.percentDone}%)</span>
                        </div>
                        <div class="w-full bg-beige h-2 rounded-full overflow-hidden">
                            <div class="bg-musgo h-full transition-all duration-300" style="width: ${prog.percentDone}%"></div>
                        </div>
                    </div>
                </div>
                <div class="flex flex-wrap gap-2 items-center shrink-0">
                    <button onclick="abrirModalEditarSprint('${cur.id}')" class="bg-offwhite hover:bg-beige border border-beige text-dark font-serif px-3.5 py-2 rounded-sm text-sm transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer" title="Editar nome, metas e datas da sprint atual">
                        <svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                        <span>Editar Sprint</span>
                    </button>
                    <button onclick="excluirSprintAtual()" class="text-gray-400 hover:text-terracota font-serif px-3 py-2 text-sm transition-colors flex items-center gap-1 cursor-pointer" title="Excluir sprint atual">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        <span>Excluir</span>
                    </button>
                    <button onclick="abrirModalConcluirSprint()" class="bg-musgo hover:bg-opacity-90 text-white font-serif px-5 py-2 rounded-sm text-sm shadow-xs transition-all flex items-center gap-1.5 cursor-pointer">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                        <span>Concluir & Arquivar</span>
                    </button>
                </div>
            </div>
            `;
    })() : `
            <p class="text-sm text-gray-500 font-serif">Nenhuma Sprint ativa no momento. Crie ou ative uma abaixo.</p>
        `}
    `;
    fragment.appendChild(sprintAtualWrapper);
    const futureWrapper = document.createElement("div");
    futureWrapper.className = "mb-8";
    const futureHeader = document.createElement("h3");
    futureHeader.className = "font-serif text-xl font-bold text-dark mb-3 flex items-center gap-2";
    futureHeader.innerHTML = `
        <span>Pr\xF3ximas Sprints no Planejamento</span>
        <span class="text-xs font-mono font-normal bg-beige px-2 py-0.5 rounded-sm">${future.length}</span>
    `;
    futureWrapper.appendChild(futureHeader);
    if (future.length === 0) {
      const emptyMsg = document.createElement("p");
      emptyMsg.className = "text-sm text-gray-400 font-serif italic bg-white p-4 border border-beige rounded-sm";
      emptyMsg.innerText = "Nenhuma Sprint futura cadastrada na fila.";
      futureWrapper.appendChild(emptyMsg);
    } else {
      const listDiv = document.createElement("div");
      listDiv.className = "space-y-3";
      future.forEach((s) => {
        const item = document.createElement("div");
        item.className = "p-4 bg-white border border-beige rounded-sm flex items-center justify-between gap-4 hover:border-gray-300 transition-colors";
        item.innerHTML = `
                <div class="min-w-0 flex-1">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-gray-400">Futura</span>
                    <h4 class="font-serif text-lg font-bold text-dark">${escapeHTML(s.name)}</h4>
                    ${s.description ? `<p class="text-xs font-sans text-gray-700 my-1 line-clamp-2">${escapeHTML(s.description)}</p>` : ""}
                    <p class="text-xs text-gray-500 font-sans">Previs\xE3o: ${formatarData(s.startDate)} at\xE9 ${formatarData(s.endDate)}</p>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    <button onclick="ativarSprintFutura('${s.id}')" class="text-xs font-serif bg-beige hover:bg-dark hover:text-white text-dark px-3 py-1.5 rounded-sm transition-colors cursor-pointer">
                        Tornar Atual
                    </button>
                    <button onclick="abrirModalEditarSprint('${s.id}')" class="text-xs font-serif border border-beige bg-offwhite hover:bg-beige text-dark px-2.5 py-1.5 rounded-sm transition-colors cursor-pointer">
                        Editar
                    </button>
                    <button onclick="excluirSprintFutura('${s.id}')" class="text-xs font-serif text-gray-400 hover:text-terracota px-2 py-1.5 cursor-pointer">
                        Excluir
                    </button>
                </div>
            `;
        listDiv.appendChild(item);
      });
      futureWrapper.appendChild(listDiv);
    }
    fragment.appendChild(futureWrapper);
    container.appendChild(fragment);
  }
  function abrirModalEditarSprint(sprintId) {
    let sprint = null;
    if (sprintId) {
      sprint = appState.sprints.find((s) => s.id === sprintId);
    } else {
      sprint = appState.sprints.find((s) => s.status === "current");
    }
    if (!sprint) {
      mostrarToast("Sprint n\xE3o encontrada.", "erro");
      return;
    }
    const idEl = document.getElementById("editar-sprint-id");
    const nomeEl = document.getElementById("editar-sprint-nome");
    const descEl = document.getElementById("editar-sprint-descricao");
    const iniEl = document.getElementById("editar-sprint-inicio");
    const fimEl = document.getElementById("editar-sprint-fim");
    if (idEl) idEl.value = sprint.id;
    if (nomeEl) nomeEl.value = sprint.name || "";
    if (descEl) descEl.value = sprint.description || "";
    if (iniEl) iniEl.value = sprint.startDate || "";
    if (fimEl) fimEl.value = sprint.endDate || "";
    const modal = document.getElementById("modalEditarSprint");
    if (modal) modal.showModal();
  }
  function fecharModalEditarSprint() {
    const modal = document.getElementById("modalEditarSprint");
    if (modal) modal.close();
  }
  function salvarEdicaoSprintForm(e) {
    if (e && e.preventDefault) e.preventDefault();
    const idEl = document.getElementById("editar-sprint-id");
    const nomeEl = document.getElementById("editar-sprint-nome");
    const descEl = document.getElementById("editar-sprint-descricao");
    const iniEl = document.getElementById("editar-sprint-inicio");
    const fimEl = document.getElementById("editar-sprint-fim");
    if (!idEl || !idEl.value) return;
    const sprint = appState.sprints.find((s) => s.id === idEl.value);
    if (!sprint) {
      mostrarToast("Sprint n\xE3o encontrada.", "erro");
      return;
    }
    const nome = nomeEl ? nomeEl.value.trim() : "";
    const inicio = iniEl ? iniEl.value : "";
    const fim = fimEl ? fimEl.value : "";
    const desc = descEl ? descEl.value.trim() : "";
    if (!nome || !inicio || !fim) {
      mostrarToast("Preencha o nome e as datas de in\xEDcio e t\xE9rmino.", "erro");
      return;
    }
    sprint.name = nome;
    sprint.description = desc;
    sprint.startDate = inicio;
    sprint.endDate = fim;
    saveState();
    fecharModalEditarSprint();
    renderizarAbaSprints2();
    renderizarHeaderSprints2();
    renderizarQuadro();
    mostrarToast(`Sprint "${nome}" atualizada com sucesso!`, "sucesso");
  }
  function excluirSprintAtual() {
    const cur = appState.sprints.find((s) => s.status === "current");
    if (!cur) {
      mostrarToast("Nenhuma sprint ativa no momento.", "info");
      return;
    }
    if (!confirm(`Tem certeza que deseja excluir a Sprint Atual "${cur.name}"?

As tarefas cadastradas no quadro ser\xE3o mantidas, mas o ciclo atual ser\xE1 cancelado.`)) {
      return;
    }
    const nomeExcluido = cur.name;
    const sprintId = cur.id;
    appState.tasks.forEach((t) => {
      if (t.sprintId === sprintId) {
        t.sprintId = null;
      }
    });
    appState.sprints = appState.sprints.filter((s) => s.id !== sprintId);
    saveState();
    renderizarAbaSprints2();
    renderizarHeaderSprints2();
    renderizarQuadro();
    mostrarToast(`Sprint "${nomeExcluido}" foi exclu\xEDda com sucesso.`, "sucesso");
  }
  function salvarNovaSprintForm(e) {
    if (e && e.preventDefault) e.preventDefault();
    const nome = document.getElementById("sprintNome").value.trim();
    const descricao = document.getElementById("sprintDescricao")?.value.trim() || "";
    const inicio = document.getElementById("sprintInicio").value;
    const fim = document.getElementById("sprintFim").value;
    if (!nome || !inicio || !fim) {
      mostrarToast("Preencha o nome, data de in\xEDcio e data de t\xE9rmino da Sprint.", "erro");
      return;
    }
    const temAtual = appState.sprints.some((s) => s.status === "current");
    const novaSprint = {
      id: gerarId("sprint"),
      name: nome,
      description: descricao,
      startDate: inicio,
      endDate: fim,
      status: temAtual ? "future" : "current"
    };
    appState.sprints.push(novaSprint);
    saveState();
    document.getElementById("sprintNome").value = "";
    const descEl = document.getElementById("sprintDescricao");
    if (descEl) descEl.value = "";
    document.getElementById("sprintInicio").value = "";
    document.getElementById("sprintFim").value = "";
    renderizarAbaSprints2();
    renderizarHeaderSprints2();
    mostrarToast(`Sprint "${nome}" adicionada com sucesso como ${novaSprint.status === "current" ? "Atual" : "Futura"}!`, "sucesso");
  }
  function ativarSprintFutura(sprintId) {
    if (!confirm("Deseja definir esta Sprint como a Sprint Atual?")) return;
    appState.sprints.forEach((s) => {
      if (s.id === sprintId) s.status = "current";
      else if (s.status === "current") s.status = "future";
    });
    saveState();
    renderizarAbaSprints2();
    renderizarQuadro();
    mostrarToast("Sprint ativada como atual no Quadro!", "sucesso");
  }
  function excluirSprintFutura(sprintId) {
    if (!confirm("Deseja remover esta Sprint planejada?")) return;
    appState.sprints = appState.sprints.filter((s) => s.id !== sprintId);
    saveState();
    renderizarAbaSprints2();
    renderizarHeaderSprints2();
    mostrarToast("Sprint planejada removida.", "info");
  }

  // js/task-edit.js
  var modalTarefa = document.getElementById("modalTarefa");
  var tarefaEmEdicaoId = null;
  var subtasksTemporarias = [];
  var imagensTemporarias = [];
  function abrirModalTarefa(taskId = null, options = {}) {
    tarefaEmEdicaoId = taskId;
    subtasksTemporarias = [];
    imagensTemporarias = [];
    const selectProjeto = document.getElementById("inputProjeto");
    if (selectProjeto) {
      selectProjeto.innerHTML = appState.settings.projects.map((p) => `
            <option value="${p}">${p}</option>
        `).join("") + `<option value="__novo__">+ Cadastrar Novo Projeto...</option>`;
    }
    const selectParent = document.getElementById("inputParentId");
    if (selectParent) {
      let invalidos = /* @__PURE__ */ new Set();
      if (taskId) {
        invalidos = obterDescendentesIds(taskId);
        invalidos.add(taskId);
      }
      const tarefasPaiCandidatas = appState.tasks.filter((t) => !invalidos.has(t.id));
      selectParent.innerHTML = `<option value="">(Nenhuma - Tarefa Principal)</option>` + tarefasPaiCandidatas.map((t) => `<option value="${t.id}">[${escapeHTML(t.project || "Geral")}] ${escapeHTML(t.title)}</option>`).join("");
    }
    const tituloModal = document.getElementById("modal-tarefa-titulo");
    const btnExcluir = document.getElementById("btn-excluir-tarefa");
    const selectDificuldade = document.getElementById("inputDificuldade");
    if (taskId) {
      const tarefa = appState.tasks.find((t) => t.id === taskId);
      if (!tarefa) return;
      if (tituloModal) tituloModal.innerText = "Editar Tarefa";
      document.getElementById("inputTitulo").value = tarefa.title || "";
      document.getElementById("inputDescricao").value = tarefa.description || "";
      document.getElementById("inputPrioridade").value = tarefa.priority || "media";
      if (selectDificuldade) selectDificuldade.value = tarefa.difficulty || "media";
      document.getElementById("inputColuna").value = tarefa.column || "backlog";
      document.getElementById("inputDueDate").value = tarefa.dueDate || "";
      if (selectProjeto) selectProjeto.value = tarefa.project || appState.settings.projects[0];
      if (selectParent) selectParent.value = tarefa.parentId || "";
      subtasksTemporarias = tarefa.subtasks ? JSON.parse(JSON.stringify(tarefa.subtasks)) : [];
      imagensTemporarias = tarefa.images ? JSON.parse(JSON.stringify(tarefa.images)) : [];
      if (btnExcluir) btnExcluir.classList.remove("hidden");
    } else {
      if (tituloModal) tituloModal.innerText = "Nova Ideia / Tarefa";
      document.getElementById("inputTitulo").value = "";
      document.getElementById("inputDescricao").value = "";
      document.getElementById("inputPrioridade").value = "media";
      if (selectDificuldade) selectDificuldade.value = "media";
      document.getElementById("inputColuna").value = "backlog";
      document.getElementById("inputDueDate").value = "";
      if (selectProjeto) selectProjeto.value = options && options.project ? options.project : appState.settings.projects[0] || "";
      if (selectParent) selectParent.value = options && options.parentId ? options.parentId : "";
      if (btnExcluir) btnExcluir.classList.add("hidden");
    }
    renderizarListaSubtasks();
    renderizarListaImagensEdicao();
    if (modalTarefa) modalTarefa.showModal();
  }
  function fecharModalTarefa() {
    if (modalTarefa) modalTarefa.close();
    tarefaEmEdicaoId = null;
    subtasksTemporarias = [];
    imagensTemporarias = [];
  }
  function salvarTarefaForm() {
    const titulo = document.getElementById("inputTitulo").value.trim();
    if (!titulo) {
      mostrarToast("Por favor, informe o t\xEDtulo da tarefa.", "erro");
      document.getElementById("inputTitulo").focus();
      return;
    }
    let projeto = document.getElementById("inputProjeto").value;
    if (projeto === "__novo__") {
      const novo = prompt("Nome do novo projeto ou categoria:");
      if (novo && novo.trim()) {
        projeto = novo.trim();
        if (!appState.settings.projects.includes(projeto)) {
          appState.settings.projects.push(projeto);
          atualizarFiltrosUI();
        }
      } else {
        projeto = appState.settings.projects[0] || "Geral";
      }
    }
    const descricao = document.getElementById("inputDescricao").value.trim();
    const prioridade = document.getElementById("inputPrioridade").value;
    const dificuldade = document.getElementById("inputDificuldade")?.value || "media";
    const coluna = document.getElementById("inputColuna").value;
    const dueDate = document.getElementById("inputDueDate").value;
    const parentId = document.getElementById("inputParentId")?.value || null;
    const curSprint = appState.sprints.find((s) => s.status === "current");
    if (tarefaEmEdicaoId) {
      const index = appState.tasks.findIndex((t) => t.id === tarefaEmEdicaoId);
      if (index !== -1) {
        const colunaAntiga = appState.tasks[index].column;
        const mudouColuna = colunaAntiga !== coluna;
        const parentAntigo = appState.tasks[index].parentId;
        appState.tasks[index] = {
          ...appState.tasks[index],
          title: titulo,
          description: descricao,
          priority: prioridade,
          difficulty: dificuldade,
          column: coluna,
          project: projeto,
          dueDate,
          subtasks: subtasksTemporarias,
          images: imagensTemporarias,
          parentId
        };
        if (coluna === "progress" && !appState.tasks[index].startedAt) appState.tasks[index].startedAt = (/* @__PURE__ */ new Date()).toISOString();
        if (coluna === "done" && !appState.tasks[index].completedAt) appState.tasks[index].completedAt = (/* @__PURE__ */ new Date()).toISOString();
        else if (coluna !== "done") delete appState.tasks[index].completedAt;
        if (mudouColuna) {
          const tasksOrigem = appState.tasks.filter((t) => t.column === colunaAntiga && t.id !== tarefaEmEdicaoId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
          tasksOrigem.forEach((t, idx) => {
            t.order = idx;
          });
          const tasksDestino = appState.tasks.filter((t) => t.column === coluna && t.id !== tarefaEmEdicaoId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
          tasksDestino.push(appState.tasks[index]);
          tasksDestino.forEach((t, idx) => {
            t.order = idx;
          });
        }
        if (parentAntigo && parentAntigo !== parentId) {
          const antCard = document.getElementById(`card-${parentAntigo}`);
          const antTask = appState.tasks.find((x) => x.id === parentAntigo);
          if (antCard && antTask) atualizarConteudoCard(antCard, antTask);
        }
        if (parentId) {
          const newCard = document.getElementById(`card-${parentId}`);
          const newTask = appState.tasks.find((x) => x.id === parentId);
          if (newCard && newTask) atualizarConteudoCard(newCard, newTask);
        }
        saveState();
        fecharModalTarefa();
        atualizarFiltrosUI();
        moverCardNoDOM(appState.tasks[index], colunaAntiga, coluna);
        if (mudouColuna && coluna === "progress") atualizarWipBadge(true);
        mostrarToast("Tarefa atualizada com sucesso!", "sucesso");
      }
    } else {
      const novaTarefa = {
        id: gerarId("task"),
        title: titulo,
        description: descricao,
        priority: prioridade,
        difficulty: dificuldade,
        column: coluna,
        order: 0,
        project: projeto,
        dueDate,
        subtasks: subtasksTemporarias,
        images: imagensTemporarias,
        parentId,
        sprintId: curSprint ? curSprint.id : null,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      if (coluna === "progress") novaTarefa.startedAt = (/* @__PURE__ */ new Date()).toISOString();
      if (coluna === "done") novaTarefa.completedAt = (/* @__PURE__ */ new Date()).toISOString();
      appState.tasks.forEach((t) => {
        if (t.column === coluna) t.order = (t.order ?? 0) + 1;
      });
      appState.tasks.unshift(novaTarefa);
      if (parentId) {
        const parentCard = document.getElementById(`card-${parentId}`);
        const pTask = appState.tasks.find((x) => x.id === parentId);
        if (parentCard && pTask) atualizarConteudoCard(parentCard, pTask);
      }
      saveState();
      fecharModalTarefa();
      atualizarFiltrosUI();
      const targetContainer = document.getElementById(`col-${coluna}`);
      if (targetContainer && tarefaCorrespondeFiltros(novaTarefa)) {
        const cardEl = criarElementoCard(novaTarefa);
        targetContainer.insertBefore(cardEl, targetContainer.firstChild);
        verificarPlaceholderColuna(coluna);
      }
      atualizarContadoresColunas([coluna]);
      atualizarWipBadge(coluna === "progress");
      atualizarOverdueBadge();
      renderizarHeaderSprints2();
      verificarLembreteBackup();
      mostrarToast("Nova tarefa criada com sucesso!", "sucesso");
    }
  }
  function excluirTarefaAtual() {
    if (!tarefaEmEdicaoId) return;
    executarExclusaoComUndo(tarefaEmEdicaoId);
  }
  function adicionarSubtask() {
    const input = document.getElementById("inputNovaSubtask");
    const txt = input.value.trim();
    if (!txt) return;
    subtasksTemporarias.push({ id: gerarId("st"), text: txt, done: false });
    input.value = "";
    renderizarListaSubtasks();
  }
  function alternarSubtask(index) {
    if (subtasksTemporarias[index]) {
      subtasksTemporarias[index].done = !subtasksTemporarias[index].done;
      renderizarListaSubtasks();
    }
  }
  function removerSubtask(index) {
    subtasksTemporarias.splice(index, 1);
    renderizarListaSubtasks();
  }
  function renderizarListaSubtasks() {
    const container = document.getElementById("lista-subtasks");
    if (!container) return;
    if (subtasksTemporarias.length === 0) {
      container.innerHTML = `<p class="text-xs text-gray-400 font-serif italic">Nenhum item no checklist ainda.</p>`;
      return;
    }
    const fragment = document.createDocumentFragment();
    subtasksTemporarias.forEach((st, i) => {
      const li = document.createElement("li");
      li.className = "flex items-center justify-between gap-2 p-2 bg-white border border-beige rounded-sm text-sm hover:border-terracota/40 transition-colors shadow-2xs";
      li.innerHTML = `
            <label class="flex items-center gap-2.5 cursor-pointer flex-1 select-none">
                <input type="checkbox" ${st.done ? "checked" : ""} onchange="alternarSubtask(${i})" class="scrumban-checkbox">
                <span class="${st.done ? "line-through text-gray-400" : "text-gray-800 font-medium"} font-serif text-[15px] leading-tight">${escapeHTML(st.text)}</span>
            </label>
            <button type="button" onclick="removerSubtask(${i})" class="text-gray-400 hover:text-terracota p-1" title="Remover item">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
        `;
      fragment.appendChild(li);
    });
    container.innerHTML = "";
    container.appendChild(fragment);
  }
  async function processarUploadImagemTarefa(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      mostrarToast("Por favor, selecione um arquivo de imagem v\xE1lido.", "erro");
      event.target.value = "";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      mostrarToast("A imagem excede o tamanho m\xE1ximo de 10MB.", "erro");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const dataUrl = e.target.result;
        const imageId = gerarId("img");
        await salvarImagemIndexedDB(imageId, dataUrl);
        imagensTemporarias.push({
          id: imageId,
          name: file.name,
          targetType: "none",
          // 'none' (geral), 'checklist' (subtarefa checklist) ou 'subcard' (tarefa filha)
          targetId: ""
        });
        renderizarListaImagensEdicao();
        mostrarToast("Imagem adicionada e salva com seguran\xE7a no IndexedDB.", "sucesso");
      } catch (err) {
        console.error("Erro ao salvar imagem no IndexedDB:", err);
        mostrarToast("Erro ao salvar imagem no IndexedDB: " + (err.message || err), "erro");
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsDataURL(file);
  }
  function removerImagemEdicao(index) {
    if (imagensTemporarias[index]) {
      const img = imagensTemporarias[index];
      excluirImagemIndexedDB(img.id);
      imagensTemporarias.splice(index, 1);
      renderizarListaImagensEdicao();
    }
  }
  function atualizarRelacaoImagemEdicao(index, targetType, targetId) {
    if (imagensTemporarias[index]) {
      imagensTemporarias[index].targetType = targetType;
      imagensTemporarias[index].targetId = targetId;
    }
  }
  async function renderizarListaImagensEdicao() {
    const container = document.getElementById("lista-imagens-tarefa");
    if (!container) return;
    if (imagensTemporarias.length === 0) {
      container.innerHTML = `<p class="text-xs text-gray-400 font-serif italic col-span-full py-1">Nenhuma imagem anexada a esta tarefa.</p>`;
      return;
    }
    const filhas = tarefaEmEdicaoId ? appState.tasks.filter((t) => t.parentId === tarefaEmEdicaoId) : [];
    container.innerHTML = "";
    for (let i = 0; i < imagensTemporarias.length; i++) {
      const item = imagensTemporarias[i];
      const dataUrl = await obterImagemIndexedDB(item.id);
      const card = document.createElement("div");
      card.className = "border border-beige rounded-sm p-2 bg-white flex flex-col gap-2 shadow-2xs";
      let optionsChecklist = subtasksTemporarias.map((s) => `
            <option value="checklist:${s.id}" ${item.targetType === "checklist" && item.targetId === s.id ? "selected" : ""}>
                Checklist: ${escapeHTML(s.text.slice(0, 24))}${s.text.length > 24 ? "..." : ""}
            </option>
        `).join("");
      let optionsFilhas = filhas.map((f) => `
            <option value="subcard:${f.id}" ${item.targetType === "subcard" && item.targetId === f.id ? "selected" : ""}>
                Subtarefa: ${escapeHTML(f.title.slice(0, 24))}${f.title.length > 24 ? "..." : ""}
            </option>
        `).join("");
      card.innerHTML = `
            <div class="relative group/img h-24 bg-gray-100 rounded-xs overflow-hidden flex items-center justify-center cursor-pointer border border-beige/60" onclick="window.abrirModalVisualizarImagem('${item.id}', '${escapeHTML(item.name || "Imagem")}', '${item.targetType}', '${item.targetId}')">
                ${dataUrl ? `<img src="${dataUrl}" class="w-full h-full object-cover" alt="${escapeHTML(item.name)}">` : `<span class="text-xs text-gray-400">Carregando...</span>`}
                <div class="absolute inset-0 bg-dark/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-serif">
                    Clique para ampliar
                </div>
            </div>
            <div class="flex items-center justify-between gap-1">
                <span class="text-[11px] font-medium text-gray-700 truncate max-w-[130px]" title="${escapeHTML(item.name)}">${escapeHTML(item.name || "Imagem")}</span>
                <button type="button" onclick="removerImagemEdicao(${i})" class="text-xs text-terracota hover:underline p-0.5">Remover</button>
            </div>
            <div>
                <label class="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-0.5">Vincular a subtarefa:</label>
                <select onchange="const [t, id] = this.value.split(':'); atualizarRelacaoImagemEdicao(${i}, t, id || '')" class="w-full text-xs p-1 border border-beige rounded-sm bg-white text-dark focus:outline-none focus:border-terracota">
                    <option value="none:" ${item.targetType === "none" ? "selected" : ""}>(Geral - Tarefa Principal)</option>
                    ${optionsChecklist}
                    ${optionsFilhas}
                </select>
            </div>
        `;
      container.appendChild(card);
    }
  }

  // js/task-details.js
  var modalDetalhesTarefa = document.getElementById("modalDetalhesTarefa");
  var tarefaVisualizadaId = null;
  function abrirModalDetalhes(taskId) {
    const tarefa = appState.tasks.find((t) => t.id === taskId);
    if (!tarefa) return;
    tarefaVisualizadaId = taskId;
    const isDone = tarefa.column === "done";
    const prioridade = PRIORIDADE_CONFIG[tarefa.priority] || PRIORIDADE_CONFIG.media;
    const dificuldade = DIFICULDADE_CONFIG[tarefa.difficulty] || DIFICULDADE_CONFIG.media;
    const statusPrazo = calcularStatusPrazo(tarefa.dueDate, isDone);
    const elParentBanner = document.getElementById("detalhe-parent-banner");
    const elParentTitle = document.getElementById("detalhe-parent-title");
    const elParentBtn = document.getElementById("detalhe-parent-btn");
    if (elParentBanner) {
      if (tarefa.parentId) {
        const pai = appState.tasks.find((t) => t.id === tarefa.parentId);
        if (pai) {
          if (elParentTitle) {
            elParentTitle.innerText = pai.title;
            elParentTitle.onclick = () => abrirModalDetalhes(pai.id);
          }
          if (elParentBtn) {
            elParentBtn.onclick = () => abrirModalDetalhes(pai.id);
          }
          elParentBanner.classList.remove("hidden");
        } else {
          elParentBanner.classList.add("hidden");
        }
      } else {
        elParentBanner.classList.add("hidden");
      }
    }
    const elDificuldade = document.getElementById("detalhe-dificuldade");
    if (elDificuldade) {
      elDificuldade.className = `text-[12px] font-bold tracking-wider px-2.5 py-0.5 rounded-full flex items-center gap-1.5 bg-beige/80 text-dark border border-beige`;
      elDificuldade.innerHTML = `<span class="w-2.5 h-2.5 rounded-full ${dificuldade.corDot} border ${dificuldade.border} shrink-0"></span><span>${dificuldade.label}</span>`;
    }
    const elPrioridade = document.getElementById("detalhe-prioridade");
    if (elPrioridade) {
      elPrioridade.className = `text-[12px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${prioridade.cor}`;
      elPrioridade.innerText = prioridade.label;
    }
    const elProjeto = document.getElementById("detalhe-projeto");
    if (elProjeto) elProjeto.innerText = tarefa.project || "Geral";
    const elColuna = document.getElementById("detalhe-coluna");
    if (elColuna) elColuna.innerText = COLUNA_NOMES[tarefa.column] || tarefa.column;
    const elAlertaPrazo = document.getElementById("detalhe-alerta-prazo");
    if (elAlertaPrazo) {
      if (statusPrazo.status === "overdue" && !isDone) {
        elAlertaPrazo.className = "rounded-sm p-2.5 bg-red-50 border border-terracota/40 text-terracota text-sm font-serif flex items-center gap-2";
        elAlertaPrazo.innerHTML = `
                <svg class="w-4 h-4 shrink-0 text-terracota" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                <div>
                    <strong class="font-bold">Aten\xE7\xE3o: Prazo Vencido!</strong>
                    <span>Esta tarefa est\xE1 atrasada h\xE1 <strong>${statusPrazo.label}</strong> (data limite era ${statusPrazo.fullDate}).</span>
                </div>
            `;
        elAlertaPrazo.classList.remove("hidden");
      } else if (statusPrazo.status === "today" && !isDone) {
        elAlertaPrazo.className = "rounded-sm p-2.5 bg-media/15 border border-media/40 text-dark text-sm font-serif flex items-center gap-2";
        elAlertaPrazo.innerHTML = `
                <svg class="w-4 h-4 shrink-0 text-media" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <span><strong>Prazo para Hoje!</strong> A entrega desta tarefa est\xE1 programada para o final do dia.</span>
            `;
        elAlertaPrazo.classList.remove("hidden");
      } else {
        elAlertaPrazo.classList.add("hidden");
      }
    }
    const elTitulo = document.getElementById("detalhe-titulo");
    if (elTitulo) {
      elTitulo.innerText = tarefa.title;
      if (isDone) elTitulo.classList.add("line-through", "text-gray-500");
      else elTitulo.classList.remove("line-through", "text-gray-500");
    }
    const elDesc = document.getElementById("detalhe-descricao");
    if (elDesc) {
      if (tarefa.description && tarefa.description.trim()) {
        elDesc.innerText = tarefa.description;
        elDesc.classList.remove("italic", "text-gray-400");
      } else {
        elDesc.innerText = "Nenhuma nota ou detalhe cadastrado para esta tarefa.";
        elDesc.classList.add("italic", "text-gray-400");
      }
    }
    const elDueDate = document.getElementById("detalhe-duedate-info");
    if (elDueDate) {
      if (tarefa.dueDate) {
        let statusText = "";
        if (isDone) statusText = `<span class="text-musgo font-semibold ml-1">(Conclu\xEDda)</span>`;
        else if (statusPrazo.status === "overdue") statusText = `<span class="text-terracota font-bold ml-1">(${statusPrazo.label})</span>`;
        else if (statusPrazo.status === "today") statusText = `<span class="text-media font-bold ml-1">(Hoje)</span>`;
        else statusText = `<span class="text-gray-500 ml-1">(${statusPrazo.label})</span>`;
        elDueDate.innerHTML = `
                <svg class="w-3.5 h-3.5 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                <span>${formatarData(tarefa.dueDate)}</span> ${statusText}
            `;
      } else {
        elDueDate.innerHTML = `<span class="text-gray-400 italic">Sem prazo definido</span>`;
      }
    }
    const elCriacao = document.getElementById("detalhe-criacao-info");
    if (elCriacao) {
      elCriacao.innerText = tarefa.createdAt ? new Date(tarefa.createdAt).toLocaleDateString("pt-BR") : "Data n\xE3o registrada";
    }
    fecharVincularSubtarefaExistente();
    renderizarDetalhesFilhas(tarefa);
    renderizarDetalhesSubtasks(tarefa);
    renderizarDetalhesImagens(tarefa);
    if (modalDetalhesTarefa) modalDetalhesTarefa.showModal();
  }
  function fecharModalDetalhes() {
    if (modalDetalhesTarefa) modalDetalhesTarefa.close();
    tarefaVisualizadaId = null;
    fecharVincularSubtarefaExistente();
  }
  function editarTarefaDeDetalhes() {
    const taskId = tarefaVisualizadaId;
    fecharModalDetalhes();
    if (taskId) abrirModalTarefa(taskId);
  }
  function excluirTarefaDeDetalhes() {
    if (!tarefaVisualizadaId) return;
    executarExclusaoComUndo(tarefaVisualizadaId);
  }
  function renderizarDetalhesFilhas(tarefa) {
    const container = document.getElementById("detalhe-filhas-lista");
    const countEl = document.getElementById("detalhe-filhas-count");
    if (!container) return;
    const filhas = appState.tasks.filter((t) => t.parentId === tarefa.id);
    const doneCount = filhas.filter((f) => f.column === "done").length;
    if (countEl) countEl.innerText = `${doneCount}/${filhas.length}`;
    if (filhas.length === 0) {
      container.innerHTML = `<li class="text-sm text-gray-400 font-serif italic py-1">Nenhuma sub-tarefa vinculada.</li>`;
      return;
    }
    const fragment = document.createDocumentFragment();
    filhas.forEach((f) => {
      const isDone = f.column === "done";
      const prioridade = PRIORIDADE_CONFIG[f.priority] || PRIORIDADE_CONFIG.media;
      const li = document.createElement("li");
      li.className = "flex items-center justify-between gap-2 p-2 bg-offwhite border border-beige/60 rounded-sm text-sm hover:border-dark/30 transition-colors group";
      let subChecklistBadge = "";
      if (f.subtasks && f.subtasks.length > 0) {
        const stDone = f.subtasks.filter((s) => s.done).length;
        subChecklistBadge = `<span class="text-xs font-mono text-gray-500 bg-beige/50 px-1.5 py-0.5 rounded-sm shrink-0" title="Checklist interno">${stDone}/${f.subtasks.length}</span>`;
      }
      let dueBadge = "";
      if (f.dueDate) {
        dueBadge = `<span class="text-xs text-gray-500 shrink-0 font-sans">${formatarData(f.dueDate)}</span>`;
      }
      li.innerHTML = `
            <div class="flex items-center gap-2 min-w-0 flex-1 cursor-pointer" title="Clique para abrir esta sub-tarefa">
                <span class="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${prioridade.cor}">${f.priority}</span>
                <span class="text-xs font-medium border border-beige px-2 py-0.5 rounded-sm shrink-0 ${isDone ? "bg-musgo/10 text-musgo" : "bg-white text-gray-600"}">${COLUNA_NOMES[f.column] || f.column}</span>
                <span class="font-serif text-[15px] truncate flex-1 ${isDone ? "line-through text-gray-400" : "text-dark font-medium"} group-hover:text-terracota transition-colors">${escapeHTML(f.title)}</span>
                ${subChecklistBadge}
                ${dueBadge}
            </div>
            <div class="flex items-center gap-1 shrink-0">
                <button type="button" class="btn-desvincular text-gray-400 hover:text-terracota p-1 text-sm" title="Desvincular desta tarefa pai">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </div>
        `;
      const clickArea = li.querySelector(".cursor-pointer");
      if (clickArea) {
        clickArea.addEventListener("click", () => abrirModalDetalhes(f.id));
      }
      const btnDesvincular = li.querySelector(".btn-desvincular");
      if (btnDesvincular) {
        btnDesvincular.addEventListener("click", (e) => {
          e.stopPropagation();
          desvincularTarefaFilha(f.id);
        });
      }
      fragment.appendChild(li);
    });
    container.innerHTML = "";
    container.appendChild(fragment);
  }
  function criarNovaSubtarefaDireta() {
    if (!tarefaVisualizadaId) return;
    const pai = appState.tasks.find((t) => t.id === tarefaVisualizadaId);
    if (!pai) return;
    const paiId = pai.id;
    const paiProj = pai.project;
    fecharModalDetalhes();
    abrirModalTarefa(null, { parentId: paiId, project: paiProj });
  }
  function abrirVincularSubtarefaExistente() {
    if (!tarefaVisualizadaId) return;
    const container = document.getElementById("detalhe-vincular-container");
    const select = document.getElementById("detalhe-select-vincular");
    if (!container || !select) return;
    if (!container.classList.contains("hidden")) {
      container.classList.add("hidden");
      return;
    }
    const descendants = obterDescendentesIds(tarefaVisualizadaId);
    descendants.add(tarefaVisualizadaId);
    const tarefaAtual = appState.tasks.find((t) => t.id === tarefaVisualizadaId);
    if (tarefaAtual && tarefaAtual.parentId) {
      descendants.add(tarefaAtual.parentId);
    }
    const candidatas = appState.tasks.filter((t) => !descendants.has(t.id) && t.parentId !== tarefaVisualizadaId);
    if (candidatas.length === 0) {
      select.innerHTML = `<option value="" disabled selected>Nenhuma outra tarefa dispon\xEDvel para vincular</option>`;
    } else {
      select.innerHTML = `<option value="" disabled selected>Selecione uma tarefa para vincular...</option>` + candidatas.map((t) => `<option value="${t.id}">[${escapeHTML(t.project || "Geral")}] ${escapeHTML(t.title)}</option>`).join("");
    }
    container.classList.remove("hidden");
  }
  function fecharVincularSubtarefaExistente() {
    const container = document.getElementById("detalhe-vincular-container");
    if (container) container.classList.add("hidden");
  }
  function confirmarVincularSubtarefaExistente() {
    if (!tarefaVisualizadaId) return;
    const select = document.getElementById("detalhe-select-vincular");
    if (!select || !select.value) {
      mostrarToast("Selecione uma tarefa para vincular.", "erro");
      return;
    }
    const childId = select.value;
    const childTask = appState.tasks.find((t) => t.id === childId);
    const parentTask = appState.tasks.find((t) => t.id === tarefaVisualizadaId);
    if (!childTask || !parentTask) return;
    childTask.parentId = parentTask.id;
    saveState();
    fecharVincularSubtarefaExistente();
    renderizarDetalhesFilhas(parentTask);
    const parentCardEl = document.getElementById(`card-${parentTask.id}`);
    if (parentCardEl) atualizarConteudoCard(parentCardEl, parentTask);
    const childCardEl = document.getElementById(`card-${childTask.id}`);
    if (childCardEl) atualizarConteudoCard(childCardEl, childTask);
    renderizarHeaderSprints2();
    mostrarToast("Sub-tarefa vinculada com sucesso!", "sucesso");
  }
  function desvincularTarefaFilha(childId) {
    if (!tarefaVisualizadaId) return;
    const childTask = appState.tasks.find((t) => t.id === childId);
    const parentTask = appState.tasks.find((t) => t.id === tarefaVisualizadaId);
    if (!childTask) return;
    childTask.parentId = null;
    saveState();
    if (parentTask) renderizarDetalhesFilhas(parentTask);
    if (parentTask) {
      const parentCardEl = document.getElementById(`card-${parentTask.id}`);
      if (parentCardEl) atualizarConteudoCard(parentCardEl, parentTask);
    }
    const childCardEl = document.getElementById(`card-${childTask.id}`);
    if (childCardEl) atualizarConteudoCard(childCardEl, childTask);
    renderizarHeaderSprints2();
    mostrarToast("Sub-tarefa desvinculada.", "sucesso");
  }
  function renderizarDetalhesSubtasks(tarefa) {
    const container = document.getElementById("detalhe-subtasks-lista");
    const countEl = document.getElementById("detalhe-subtasks-count");
    if (!container) return;
    const subtasks = tarefa.subtasks || [];
    const doneCount = subtasks.filter((s) => s.done).length;
    if (countEl) countEl.innerText = `${doneCount}/${subtasks.length}`;
    if (subtasks.length === 0) {
      container.innerHTML = `<li class="text-sm text-gray-400 font-serif italic py-1">Nenhuma subtarefa no checklist.</li>`;
      return;
    }
    const fragment = document.createDocumentFragment();
    subtasks.forEach((st, i) => {
      const li = document.createElement("li");
      li.className = "flex items-center gap-2 p-2 bg-white border border-beige rounded-sm text-sm hover:border-terracota/40 transition-colors shadow-2xs";
      li.innerHTML = `
            <label class="flex items-center gap-2.5 cursor-pointer flex-1 select-none">
                <input type="checkbox" ${st.done ? "checked" : ""} onchange="alternarSubtaskDeDetalhes(${i})" class="scrumban-checkbox">
                <span class="${st.done ? "line-through text-gray-400" : "text-gray-800 font-medium"} font-serif text-[15px] leading-tight">${escapeHTML(st.text)}</span>
            </label>
        `;
      fragment.appendChild(li);
    });
    container.innerHTML = "";
    container.appendChild(fragment);
  }
  function alternarSubtaskDeDetalhes(index) {
    if (!tarefaVisualizadaId) return;
    const tarefa = appState.tasks.find((t) => t.id === tarefaVisualizadaId);
    if (!tarefa || !tarefa.subtasks || !tarefa.subtasks[index]) return;
    tarefa.subtasks[index].done = !tarefa.subtasks[index].done;
    saveState();
    renderizarDetalhesSubtasks(tarefa);
    const cardEl = document.getElementById(`card-${tarefa.id}`);
    if (cardEl) atualizarConteudoCard(cardEl, tarefa);
    renderizarHeaderSprints2();
  }
  async function renderizarDetalhesImagens(tarefa) {
    const container = document.getElementById("detalhe-imagens-lista");
    const countEl = document.getElementById("detalhe-imagens-count");
    if (!container) return;
    const imagensProprias = Array.isArray(tarefa.images) ? tarefa.images.map((img) => ({ ...img, origem: "esta" })) : [];
    let imagensHerdadasPai = [];
    if (tarefa.parentId) {
      const pai = appState.tasks.find((t) => t.id === tarefa.parentId);
      if (pai && Array.isArray(pai.images)) {
        imagensHerdadasPai = pai.images.filter((img) => img.targetType === "subcard" && img.targetId === tarefa.id).map((img) => ({ ...img, origem: "pai", paiTitulo: pai.title }));
      }
    }
    const todasImagens = [...imagensProprias, ...imagensHerdadasPai];
    if (countEl) countEl.innerText = todasImagens.length;
    if (todasImagens.length === 0) {
      container.innerHTML = `<p class="text-sm text-gray-400 font-serif italic py-1 col-span-full">Nenhuma imagem anexada a esta tarefa.</p>`;
      return;
    }
    container.innerHTML = "";
    for (const img of todasImagens) {
      const dataUrl = await obterImagemIndexedDB(img.id);
      let vinculoLabel = "Geral (Tarefa Principal)";
      if (img.targetType === "checklist") {
        const st = (tarefa.subtasks || []).find((s) => s.id === img.targetId);
        vinculoLabel = st ? `Checklist: ${st.text}` : "Checklist associado";
      } else if (img.targetType === "subcard") {
        const filha = appState.tasks.find((f) => f.id === img.targetId);
        vinculoLabel = filha ? `Subtarefa: ${filha.title}` : "Subtarefa associada";
      }
      if (img.origem === "pai") {
        vinculoLabel = `Vinculada via Tarefa Pai: ${img.paiTitulo || ""}`;
      }
      const card = document.createElement("div");
      card.className = "border border-beige rounded-sm p-2 bg-white flex flex-col gap-1.5 shadow-2xs hover:border-terracota/40 transition-colors";
      card.innerHTML = `
            <div class="relative group/detimg h-28 bg-gray-100 rounded-xs overflow-hidden flex items-center justify-center cursor-pointer border border-beige/60">
                ${dataUrl ? `<img src="${dataUrl}" class="w-full h-full object-cover" alt="${escapeHTML(img.name)}">` : `<span class="text-xs text-gray-400">Carregando imagem...</span>`}
                <div class="absolute inset-0 bg-dark/40 opacity-0 group-hover/detimg:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-serif">
                    Clique para ampliar
                </div>
            </div>
            <div class="min-w-0">
                <p class="text-xs font-semibold text-dark truncate" title="${escapeHTML(img.name)}">${escapeHTML(img.name || "Imagem")}</p>
                <span class="inline-block text-[10px] text-gray-500 font-sans truncate max-w-full" title="${escapeHTML(vinculoLabel)}">\u{1F4CE} ${escapeHTML(vinculoLabel)}</span>
            </div>
        `;
      card.querySelector(".cursor-pointer")?.addEventListener("click", () => {
        abrirModalVisualizarImagem(img.id, img.name, img.targetType, img.targetId, vinculoLabel);
      });
      container.appendChild(card);
    }
  }
  async function abrirModalVisualizarImagem(imageId, nome = "Imagem", targetType = "", targetId = "", labelVinculo = "") {
    const modal = document.getElementById("modalVisualizarImagem");
    const preview = document.getElementById("modal-imagem-preview");
    const titulo = document.getElementById("modal-imagem-titulo");
    const info = document.getElementById("modal-imagem-subtarefa-info");
    if (!modal || !preview) return;
    if (titulo) titulo.innerText = nome || "Visualiza\xE7\xE3o de Imagem";
    if (info) {
      info.innerText = labelVinculo ? `Associa\xE7\xE3o: ${labelVinculo}` : "";
    }
    preview.src = "";
    const dataUrl = await obterImagemIndexedDB(imageId);
    if (dataUrl) {
      preview.src = dataUrl;
      modal.showModal();
    } else {
      mostrarToast("Imagem n\xE3o encontrada no banco de dados local.", "erro");
    }
  }
  function fecharModalVisualizarImagem() {
    const modal = document.getElementById("modalVisualizarImagem");
    const preview = document.getElementById("modal-imagem-preview");
    if (preview) preview.src = "";
    if (modal) modal.close();
  }

  // js/drag-drop.js
  var draggedTaskId = null;
  var dropIndicator = null;
  var touchDragState = null;
  function getOrCreateDropIndicator() {
    if (!dropIndicator) {
      dropIndicator = document.createElement("div");
      dropIndicator.className = "drop-indicator";
    }
    return dropIndicator;
  }
  function getDragAfterElement(container, x, y) {
    const isGrid = container.classList.contains("kanban-column-expanded-grid");
    const elements = [...container.querySelectorAll(".card-item:not(.dragging)")];
    if (elements.length === 0) return null;
    if (isGrid && typeof x === "number") {
      let closestElement = null;
      let minDistance = Number.POSITIVE_INFINITY;
      for (const child of elements) {
        const box = child.getBoundingClientRect();
        const childCenterX = box.left + box.width / 2;
        const childCenterY = box.top + box.height / 2;
        if (y < box.bottom && (x < childCenterX || y < box.top + box.height / 2)) {
          const distance = Math.hypot(x - childCenterX, y - childCenterY);
          if (distance < minDistance) {
            minDistance = distance;
            closestElement = child;
          }
        }
      }
      return closestElement;
    }
    return elements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) return { offset, element: child };
      return closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }
  function vincularEventosDrag(card) {
    card.addEventListener("dragstart", function(e) {
      draggedTaskId = this.dataset.taskId;
      e.dataTransfer.setData("text/plain", draggedTaskId);
      e.dataTransfer.effectAllowed = "move";
      setTimeout(() => this.classList.add("dragging"), 0);
    });
    card.addEventListener("dragend", function() {
      this.classList.remove("dragging");
      draggedTaskId = null;
      document.querySelectorAll(".kanban-column, .column-collapsed-strip").forEach((c) => c.classList.remove("drag-over"));
      if (dropIndicator && dropIndicator.parentNode) dropIndicator.remove();
    });
  }
  function inicializarColunasDrop() {
    document.querySelectorAll(".kanban-column").forEach((column) => {
      column.addEventListener("dragover", function(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        this.classList.add("drag-over");
        const afterElement = getDragAfterElement(this, e.clientX, e.clientY);
        const indicator = getOrCreateDropIndicator();
        if (afterElement) this.insertBefore(indicator, afterElement);
        else this.appendChild(indicator);
      });
      column.addEventListener("dragleave", function(e) {
        if (!e.relatedTarget || !this.contains(e.relatedTarget)) {
          this.classList.remove("drag-over");
          if (dropIndicator && dropIndicator.parentNode === this) dropIndicator.remove();
        }
      });
      column.addEventListener("drop", function(e) {
        e.preventDefault();
        this.classList.remove("drag-over");
        const taskId = e.dataTransfer.getData("text/plain") || draggedTaskId;
        const afterElement = getDragAfterElement(this, e.clientX, e.clientY);
        if (dropIndicator && dropIndicator.parentNode) dropIndicator.remove();
        if (!taskId) return;
        const targetCol = this.id.replace("col-", "");
        const afterTaskId = afterElement ? afterElement.dataset.taskId : null;
        reordenarOuMoverTarefa(taskId, targetCol, afterTaskId);
      });
    });
    document.querySelectorAll(".column-collapsed-strip").forEach((strip) => {
      strip.addEventListener("dragover", function(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        this.classList.add("drag-over");
      });
      strip.addEventListener("dragleave", function(e) {
        if (!e.relatedTarget || !this.contains(e.relatedTarget)) {
          this.classList.remove("drag-over");
        }
      });
      strip.addEventListener("drop", function(e) {
        e.preventDefault();
        this.classList.remove("drag-over");
        const taskId = e.dataTransfer.getData("text/plain") || draggedTaskId;
        if (!taskId) return;
        const section = this.closest("section");
        const targetCol = section ? section.dataset.column || section.getAttribute("data-column") : null;
        if (targetCol) {
          reordenarOuMoverTarefa(taskId, targetCol, null);
        }
      });
    });
  }
  function vincularEventosTouch(card) {
    let startY = 0;
    let isMoving = false;
    let cloneEl = null;
    card.addEventListener("touchstart", (e) => {
      if (e.touches.length > 1) return;
      const touch = e.touches[0];
      startY = touch.clientY;
      touchDragState = {
        taskId: card.dataset.taskId,
        cardEl: card,
        initialY: startY
      };
    }, { passive: true });
    card.addEventListener("touchmove", (e) => {
      if (!touchDragState || touchDragState.taskId !== card.dataset.taskId) return;
      const touch = e.touches[0];
      const diffY = Math.abs(touch.clientY - startY);
      if (diffY > 10 && !isMoving) {
        isMoving = true;
        card.classList.add("dragging");
        cloneEl = card.cloneNode(true);
        cloneEl.classList.add("touch-drag-ghost");
        cloneEl.style.width = `${card.offsetWidth}px`;
        document.body.appendChild(cloneEl);
      }
      if (isMoving && cloneEl) {
        e.preventDefault();
        cloneEl.style.transform = `translate3d(${touch.clientX - 40}px, ${touch.clientY - 25}px, 0)`;
        const elemBelow = document.elementFromPoint(touch.clientX, touch.clientY);
        if (elemBelow) {
          const colTarget = elemBelow.closest(".kanban-column");
          if (colTarget) {
            const after = getDragAfterElement(colTarget, touch.clientY);
            const indicator = getOrCreateDropIndicator();
            if (after) colTarget.insertBefore(indicator, after);
            else colTarget.appendChild(indicator);
          }
        }
      }
    }, { passive: false });
    card.addEventListener("touchend", (e) => {
      if (!touchDragState || touchDragState.taskId !== card.dataset.taskId) return;
      if (isMoving) {
        const touch = e.changedTouches[0];
        const elemBelow = document.elementFromPoint(touch.clientX, touch.clientY);
        if (elemBelow) {
          const colTarget = elemBelow.closest(".kanban-column");
          if (colTarget) {
            const after = getDragAfterElement(colTarget, touch.clientY);
            const targetCol = colTarget.id.replace("col-", "");
            const afterTaskId = after ? after.dataset.taskId : null;
            reordenarOuMoverTarefa(card.dataset.taskId, targetCol, afterTaskId);
          }
        }
      }
      card.classList.remove("dragging");
      if (cloneEl) cloneEl.remove();
      if (dropIndicator && dropIndicator.parentNode) dropIndicator.remove();
      touchDragState = null;
      isMoving = false;
    });
    card.addEventListener("touchcancel", () => {
      card.classList.remove("dragging");
      if (cloneEl) cloneEl.remove();
      if (dropIndicator && dropIndicator.parentNode) dropIndicator.remove();
      touchDragState = null;
      isMoving = false;
    });
  }

  // js/kanban.js
  var colunaMobileAtiva = "all";
  var colunaExpandidaAtiva = null;
  function obterColunaExpandidaAtiva() {
    return colunaExpandidaAtiva;
  }
  function aplicarEstadoColunaExpandida() {
    const container = document.getElementById("kanban-columns-container");
    if (!container) return;
    if (!colunaExpandidaAtiva) {
      container.classList.remove("has-expanded-column");
      COLUNAS.forEach((col) => {
        const sec = document.querySelector(`section[data-column="${col}"]`);
        if (sec) {
          sec.classList.remove("column-is-expanded", "column-is-collapsed");
        }
        const colDiv = document.getElementById(`col-${col}`);
        if (colDiv) {
          colDiv.classList.remove("kanban-column-expanded-grid");
        }
      });
      return;
    }
    container.classList.add("has-expanded-column");
    COLUNAS.forEach((col) => {
      const sec = document.querySelector(`section[data-column="${col}"]`);
      const colDiv = document.getElementById(`col-${col}`);
      if (col === colunaExpandidaAtiva) {
        if (sec) {
          sec.classList.add("column-is-expanded");
          sec.classList.remove("column-is-collapsed");
        }
        if (colDiv) {
          colDiv.classList.add("kanban-column-expanded-grid");
        }
      } else {
        if (sec) {
          sec.classList.remove("column-is-expanded");
          sec.classList.add("column-is-collapsed");
        }
        if (colDiv) {
          colDiv.classList.remove("kanban-column-expanded-grid");
        }
      }
    });
  }
  function expandirColuna(coluna) {
    if (!COLUNAS.includes(coluna)) return;
    colunaExpandidaAtiva = coluna;
    aplicarEstadoColunaExpandida();
  }
  function recolherColunaExpandida() {
    if (!colunaExpandidaAtiva) return;
    colunaExpandidaAtiva = null;
    aplicarEstadoColunaExpandida();
  }
  function toggleExpandirColuna(coluna) {
    if (colunaExpandidaAtiva === coluna) {
      recolherColunaExpandida();
    } else {
      expandirColuna(coluna);
    }
  }
  function expandirColunaVizinha(offset) {
    if (!colunaExpandidaAtiva) return;
    const curIdx = COLUNAS.indexOf(colunaExpandidaAtiva);
    const nextIdx = (curIdx + offset + COLUNAS.length) % COLUNAS.length;
    expandirColuna(COLUNAS[nextIdx]);
  }
  function selecionarColunaMobile(coluna) {
    colunaMobileAtiva = coluna;
    document.querySelectorAll(".mobile-col-btn").forEach((btn) => {
      const col = btn.dataset ? btn.dataset.mobileCol : btn.getAttribute("data-mobile-col");
      if (col === coluna) {
        btn.classList.add("active", "bg-dark", "text-white", "border-dark");
        btn.classList.remove("bg-white", "text-dark", "border-beige");
      } else {
        btn.classList.remove("active", "bg-dark", "text-white", "border-dark");
        btn.classList.add("bg-white", "text-dark", "border-beige");
      }
    });
    const colunasElements = document.querySelectorAll("#kanban-columns-container > section");
    colunasElements.forEach((sec) => {
      const secCol = sec.dataset ? sec.dataset.column : sec.getAttribute("data-column");
      if (coluna === "all" || secCol === coluna) {
        sec.classList.remove("mobile-hidden-col");
      } else {
        sec.classList.add("mobile-hidden-col");
      }
    });
    const container = document.getElementById("kanban-columns-container");
    if (container) {
      if (coluna === "all") {
        container.classList.add("min-w-[1050px]");
        container.classList.remove("w-full");
      } else {
        container.classList.remove("min-w-[1050px]");
        container.classList.add("w-full");
      }
    }
  }
  function atualizarWipBadge(dispararAlerta = false) {
    const inProgressCount = appState.tasks.filter((t) => t.column === "progress" && tarefaVisivelNoQuadro(t)).length;
    const wipLimit = appState.settings.wipLimit;
    const wipBadge = document.getElementById("wip-badge");
    const colProgress = document.getElementById("col-progress");
    const sectionProgress = colProgress ? colProgress.closest("section") : null;
    const isExceeded = wipLimit > 0 && inProgressCount > wipLimit;
    if (wipBadge) {
      if (isExceeded) {
        wipBadge.className = "text-xs font-bold bg-terracota text-white px-2.5 py-1 rounded-sm animate-pulse";
        wipBadge.innerText = `WIP Excedido: ${inProgressCount}/${wipLimit}`;
      } else if (wipLimit > 0) {
        wipBadge.className = "text-xs font-bold bg-beige text-dark px-2.5 py-1 rounded-sm";
        wipBadge.innerText = `WIP: ${inProgressCount}/${wipLimit}`;
      } else {
        wipBadge.className = "text-xs font-bold bg-beige text-dark px-2.5 py-1 rounded-sm";
        wipBadge.innerText = `WIP: ${inProgressCount}`;
      }
    }
    if (sectionProgress) {
      if (isExceeded) sectionProgress.classList.add("column-wip-exceeded");
      else sectionProgress.classList.remove("column-wip-exceeded");
    }
    if (isExceeded && dispararAlerta) {
      mostrarToast(`Limite WIP violado (${inProgressCount}/${wipLimit})! Conclua tarefas em andamento antes de puxar mais itens.`, "erro", 6e3);
    }
  }
  function atualizarOverdueBadge() {
    const totalAtrasadas = appState.tasks.filter((t) => {
      if (t.column === "done") return false;
      if (!tarefaVisivelNoQuadro(t)) return false;
      return calcularStatusPrazo(t.dueDate, false).status === "overdue";
    }).length;
    const btnOverdue = document.getElementById("btnFiltroOverdue");
    const txtOverdue = document.getElementById("txtFiltroOverdue");
    if (btnOverdue && txtOverdue) {
      txtOverdue.innerText = `${totalAtrasadas} Atrasada${totalAtrasadas === 1 ? "" : "s"}`;
      if (uiFilters.onlyOverdue) {
        btnOverdue.className = "px-2.5 py-1.5 rounded-sm border text-xs font-serif font-bold transition-all flex items-center gap-1.5 shadow-xs bg-terracota text-white border-terracota";
      } else if (totalAtrasadas > 0) {
        btnOverdue.className = "px-2.5 py-1.5 rounded-sm border text-xs font-serif font-semibold transition-all flex items-center gap-1.5 shadow-xs bg-red-50 text-terracota border-terracota/40 hover:bg-terracota hover:text-white";
      } else {
        btnOverdue.className = "px-2.5 py-1.5 rounded-sm border text-xs font-serif text-gray-500 border-beige bg-white hover:bg-offwhite flex items-center gap-1.5";
      }
    }
  }
  function verificarPontoReabastecimento() {
    const todoCount = appState.tasks.filter((t) => t.column === "todo" && tarefaVisivelNoQuadro(t)).length;
    const backlogCount = appState.tasks.filter((t) => t.column === "backlog" && tarefaVisivelNoQuadro(t)).length;
    const limit = typeof appState.settings.replenishmentLimit === "number" ? appState.settings.replenishmentLimit : 2;
    const banner = document.getElementById("alerta-reabastecimento");
    if (!banner) return;
    if (todoCount <= limit && backlogCount > 0) banner.classList.remove("hidden");
    else banner.classList.add("hidden");
  }
  function atualizarContadoresColunas(colunas = COLUNAS) {
    colunas.forEach((col) => {
      const count = appState.tasks.filter((t) => t.column === col && tarefaVisivelNoQuadro(t)).length;
      const countBadge = document.getElementById(`count-${col}`);
      if (countBadge) countBadge.innerText = count;
      const countBadgeCollapsed = document.getElementById(`count-${col}-collapsed`);
      if (countBadgeCollapsed) countBadgeCollapsed.innerText = count;
      const mobileBadge = document.getElementById(`mcount-${col}`);
      if (mobileBadge) mobileBadge.innerText = count;
    });
    verificarPontoReabastecimento();
  }
  function criarElementoPlaceholderVazio(col) {
    const emptyEl = document.createElement("div");
    emptyEl.className = "empty-column-placeholder p-4 text-center text-xs font-serif text-gray-400 italic border border-dashed border-beige rounded-sm my-auto";
    emptyEl.innerText = uiFilters.onlyOverdue ? "Nenhuma tarefa atrasada" : uiFilters.search ? "Nenhum item com este filtro" : "Nenhuma tarefa";
    return emptyEl;
  }
  function verificarPlaceholderColuna(col) {
    const container = document.getElementById(`col-${col}`);
    if (!container) return;
    const cards = container.querySelectorAll(".card-item");
    const placeholder = container.querySelector(".empty-column-placeholder");
    if (cards.length === 0 && !placeholder) {
      container.appendChild(criarElementoPlaceholderVazio(col));
    } else if (cards.length > 0 && placeholder) {
      placeholder.remove();
    }
  }
  function atualizarConteudoCard(cardEl, tarefa) {
    const isDone = tarefa.column === "done";
    const prioridade = PRIORIDADE_CONFIG[tarefa.priority] || PRIORIDADE_CONFIG.media;
    const statusPrazo = calcularStatusPrazo(tarefa.dueDate, isDone);
    const isOverdue = statusPrazo.status === "overdue" && !isDone;
    const isDueToday = statusPrazo.status === "today" && !isDone;
    let subtaskBadge = "";
    if (tarefa.subtasks && tarefa.subtasks.length > 0) {
      const doneCount = tarefa.subtasks.filter((s) => s.done).length;
      const total = tarefa.subtasks.length;
      subtaskBadge = `<span class="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded-sm ${doneCount === total ? "bg-musgo/20 text-musgo font-semibold" : "bg-gray-100 text-gray-600"}" title="Checklist: ${doneCount}/${total}">${doneCount}/${total}</span>`;
    }
    const filhas = appState.tasks.filter((t) => t.parentId === tarefa.id);
    let subcardsBadge = "";
    if (filhas.length > 0) {
      const filhasDone = filhas.filter((f) => f.column === "done").length;
      const totalFilhas = filhas.length;
      const todasConcluidas = filhasDone === totalFilhas;
      subcardsBadge = `<span class="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded-sm ${todasConcluidas ? "bg-musgo/20 text-musgo font-semibold border border-musgo/30" : "bg-beige/90 text-dark border border-beige"}" title="Sub-tarefas: ${filhasDone}/${totalFilhas} conclu\xEDdas">
            <svg class="w-2.5 h-2.5 text-dark/70 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M8 14h12M8 18h12"></path></svg>
            <span>${filhasDone}/${totalFilhas}</span>
        </span>`;
    }
    let parentBadge = "";
    if (tarefa.parentId) {
      const pai = appState.tasks.find((t) => t.id === tarefa.parentId);
      if (pai) {
        parentBadge = `<span title="Subtarefa de: ${escapeHTML(pai.title)}" class="card-parent-badge text-[9px] font-medium text-amber-900 bg-amber-100/90 border border-amber-300/80 px-1.5 py-0.5 rounded-sm truncate max-w-[85px] whitespace-nowrap inline-flex items-center gap-0.5 shrink-0">
                <svg class="w-2.5 h-2.5 text-amber-700 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a4 4 0 014 4v4m0 0l-3-3m3 3l3-3"></path></svg>
                <span class="truncate">${escapeHTML(pai.title)}</span>
            </span>`;
      }
    }
    let dueBadge = "";
    if (tarefa.dueDate) {
      if (isOverdue) dueBadge = `<span class="inline-flex items-center gap-1 text-[10px] font-sans font-bold px-1.5 py-0.5 rounded-sm bg-red-50 text-terracota border border-terracota/40 animate-pulse">${statusPrazo.badgeText}</span>`;
      else if (isDueToday) dueBadge = `<span class="inline-flex items-center gap-1 text-[10px] font-sans font-bold px-1.5 py-0.5 rounded-sm bg-media/15 text-media border border-media/40">Hoje</span>`;
      else dueBadge = `<span class="inline-flex items-center gap-1 text-[10px] font-sans px-1.5 py-0.5 rounded-sm border text-gray-500 bg-gray-50/80 border-gray-200">${formatarDataCurta(tarefa.dueDate)}</span>`;
    }
    const difConfig = DIFICULDADE_CONFIG[tarefa.difficulty] || DIFICULDADE_CONFIG.media;
    const diffDot = `<span class="w-2.5 h-2.5 rounded-full ${difConfig.corDot} border ${difConfig.border} inline-block shrink-0 shadow-2xs" title="Dificuldade: ${difConfig.label}"></span>`;
    const temImagens = Array.isArray(tarefa.images) && tarefa.images.length > 0;
    const imgBadge = temImagens ? `<span class="inline-flex items-center text-gray-500 hover:text-dark shrink-0" title="${tarefa.images.length} imagem(ns) vinculada(s)"><svg class="w-3 h-3 text-musgo" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg></span>` : "";
    cardEl.className = `card-item card-animate bg-white border border-beige p-2.5 rounded-sm cursor-pointer shadow-xs relative group h-[104px] min-h-[104px] max-h-[104px] flex flex-col justify-between ${isOverdue ? "card-overdue" : ""} ${isDone ? "opacity-55" : ""}`;
    cardEl.innerHTML = `
        <div class="flex items-center justify-between gap-1 h-5 shrink-0">
            <div class="flex items-center gap-1.5 min-w-0 overflow-hidden">
                ${diffDot}
                <span class="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full whitespace-nowrap ${prioridade.cor}">${tarefa.priority}</span>
                ${tarefa.project ? `<span class="text-[9px] font-medium text-gray-600 bg-beige/70 px-1.5 py-0.5 rounded-sm truncate max-w-[75px] whitespace-nowrap">${escapeHTML(tarefa.project)}</span>` : ""}
                ${parentBadge}
            </div>
            <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 md:opacity-0 max-md:opacity-100 transition-opacity shrink-0">
                <button onclick="event.stopPropagation(); moverColunaRapido('${tarefa.id}', -1)" title="Mover para coluna anterior" class="p-1 text-gray-400 hover:text-dark hover:bg-beige rounded-sm">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
                </button>
                <button onclick="event.stopPropagation(); moverColunaRapido('${tarefa.id}', 1)" title="Mover para pr\xF3xima coluna" class="p-1 text-gray-400 hover:text-dark hover:bg-beige rounded-sm">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                </button>
            </div>
        </div>
        <div class="my-auto flex items-center min-h-[38px] max-h-[38px] overflow-hidden">
            <p class="font-serif text-[13.5px] leading-snug text-dark card-title-clamp ${isDone ? "line-through text-gray-400" : "font-semibold"}">${escapeHTML(tarefa.title)}</p>
        </div>
        <div class="flex items-center justify-between gap-1 pt-1 border-t border-beige/40 h-5 shrink-0">
            <div class="flex items-center gap-1 min-w-0 overflow-hidden flex-nowrap">${dueBadge}${subtaskBadge}${subcardsBadge}</div>
            <div class="flex items-center gap-1 shrink-0 ml-auto">
                ${imgBadge}
                ${tarefa.description ? `<span class="text-gray-400 shrink-0"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7"></path></svg></span>` : ""}
            </div>
        </div>
    `;
  }
  function criarElementoCard(tarefa) {
    const card = document.createElement("div");
    card.id = `card-${tarefa.id}`;
    card.dataset.taskId = tarefa.id;
    card.draggable = true;
    atualizarConteudoCard(card, tarefa);
    card.addEventListener("click", () => abrirModalDetalhes(tarefa.id));
    vincularEventosDrag(card);
    vincularEventosTouch(card);
    return card;
  }
  function moverCardNoDOM(tarefa, colunaAntiga, novaColuna) {
    if (novaColuna === "progress" && !tarefa.startedAt) tarefa.startedAt = (/* @__PURE__ */ new Date()).toISOString();
    const cardEl = document.getElementById(`card-${tarefa.id}`);
    const atende = tarefaCorrespondeFiltros(tarefa);
    const target = document.getElementById(`col-${novaColuna}`);
    if (cardEl) {
      if (atende && target) {
        if (cardEl.parentNode !== target) target.appendChild(cardEl);
        atualizarConteudoCard(cardEl, tarefa);
      } else {
        cardEl.remove();
      }
    } else if (atende && target) {
      target.appendChild(criarElementoCard(tarefa));
    }
    verificarPlaceholderColuna(colunaAntiga);
    if (novaColuna !== colunaAntiga) verificarPlaceholderColuna(novaColuna);
    atualizarContadoresColunas([colunaAntiga, novaColuna]);
    atualizarWipBadge();
    atualizarOverdueBadge();
    renderizarHeaderSprints2();
  }
  function reordenarOuMoverTarefa(taskId, novaColuna, afterTaskId = null) {
    const tarefa = appState.tasks.find((t) => t.id === taskId);
    if (!tarefa) return;
    const colunaAntiga = tarefa.column;
    const cardEl = document.getElementById(`card-${taskId}`);
    const targetContainer = document.getElementById(`col-${novaColuna}`);
    if (!targetContainer) return;
    const nextSibling = cardEl ? cardEl.nextElementSibling : null;
    const nextSiblingId = nextSibling && nextSibling.classList.contains("card-item") ? nextSibling.dataset.taskId : null;
    if (colunaAntiga === novaColuna && nextSiblingId === afterTaskId) return;
    const mudouColuna = colunaAntiga !== novaColuna;
    if (mudouColuna) {
      tarefa.column = novaColuna;
      if (novaColuna === "progress" && !tarefa.startedAt) tarefa.startedAt = (/* @__PURE__ */ new Date()).toISOString();
      if (novaColuna === "done") tarefa.completedAt = (/* @__PURE__ */ new Date()).toISOString();
      else if (colunaAntiga === "done") delete tarefa.completedAt;
    }
    if (cardEl) {
      if (afterTaskId) {
        const afterEl = document.getElementById(`card-${afterTaskId}`);
        if (afterEl && afterEl.parentNode === targetContainer) targetContainer.insertBefore(cardEl, afterEl);
        else targetContainer.appendChild(cardEl);
      } else {
        targetContainer.appendChild(cardEl);
      }
      atualizarConteudoCard(cardEl, tarefa);
    }
    const tasksNaDestino = appState.tasks.filter((t) => t.column === novaColuna && t.id !== taskId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    if (afterTaskId) {
      const afterIdx = tasksNaDestino.findIndex((t) => t.id === afterTaskId);
      if (afterIdx !== -1) tasksNaDestino.splice(afterIdx, 0, tarefa);
      else tasksNaDestino.push(tarefa);
    } else {
      tasksNaDestino.push(tarefa);
    }
    tasksNaDestino.forEach((t, idx) => {
      t.order = idx;
    });
    if (mudouColuna) {
      const tasksOrigem = appState.tasks.filter((t) => t.column === colunaAntiga && t.id !== taskId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      tasksOrigem.forEach((t, idx) => {
        t.order = idx;
      });
      verificarPlaceholderColuna(colunaAntiga);
      if (tarefa.parentId) {
        const parentCardEl = document.getElementById(`card-${tarefa.parentId}`);
        if (parentCardEl) {
          const parentTask = appState.tasks.find((t) => t.id === tarefa.parentId);
          if (parentTask) atualizarConteudoCard(parentCardEl, parentTask);
        }
      }
    }
    verificarPlaceholderColuna(novaColuna);
    saveState();
    atualizarContadoresColunas([colunaAntiga, novaColuna]);
    atualizarWipBadge(novaColuna === "progress" && mudouColuna);
    atualizarOverdueBadge();
    renderizarHeaderSprints2();
  }
  function moverTarefaParaColuna(taskId, novaColuna) {
    reordenarOuMoverTarefa(taskId, novaColuna, null);
  }
  function moverColunaRapido(taskId, direcao) {
    const tarefa = appState.tasks.find((t) => t.id === taskId);
    if (!tarefa) return;
    const curIdx = COLUNAS.indexOf(tarefa.column);
    const newIdx = curIdx + direcao;
    if (newIdx >= 0 && newIdx < COLUNAS.length) {
      moverTarefaParaColuna(taskId, COLUNAS[newIdx]);
    }
  }
  function alternarFiltroOverdue() {
    uiFilters.onlyOverdue = !uiFilters.onlyOverdue;
    renderizarQuadro();
  }
  function renderizarQuadro() {
    renderizarHeaderSprints2();
    atualizarWipBadge();
    atualizarOverdueBadge();
    verificarPontoReabastecimento();
    const fragments = {};
    COLUNAS.forEach((col) => {
      fragments[col] = document.createDocumentFragment();
    });
    const filtradas = appState.tasks.filter(tarefaCorrespondeFiltros).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    filtradas.forEach((tarefa) => {
      if (fragments[tarefa.column]) fragments[tarefa.column].appendChild(criarElementoCard(tarefa));
    });
    COLUNAS.forEach((col) => {
      const container = document.getElementById(`col-${col}`);
      if (!container) return;
      container.innerHTML = "";
      if (fragments[col].childNodes.length > 0) container.appendChild(fragments[col]);
      else container.appendChild(criarElementoPlaceholderVazio(col));
    });
    atualizarContadoresColunas();
    selecionarColunaMobile(colunaMobileAtiva);
    aplicarEstadoColunaExpandida();
  }

  // js/metrics.js
  function calcularMetricasFluxo() {
    const agora = Date.now();
    const seteDiasAtras = agora - 7 * 24 * 60 * 60 * 1e3;
    const trintaDiasAtras = agora - 30 * 24 * 60 * 60 * 1e3;
    const tarefasConcluidas = [];
    appState.tasks.filter((t) => t.column === "done").forEach((t) => {
      tarefasConcluidas.push({
        id: t.id,
        title: t.title,
        difficulty: t.difficulty || "media",
        createdAt: t.createdAt || null,
        startedAt: t.startedAt || null,
        completedAt: t.completedAt || t.createdAt || null
      });
    });
    (appState.history || []).forEach((hist) => {
      const dataConclusaoSprint = hist.closedAt || hist.endDate;
      const dataInicioSprint = hist.startDate;
      if (Array.isArray(hist.tasksDelivered)) {
        hist.tasksDelivered.forEach((t) => {
          tarefasConcluidas.push({
            id: t.id,
            title: t.title,
            difficulty: t.difficulty || "media",
            createdAt: t.createdAt || dataInicioSprint || null,
            startedAt: t.startedAt || dataInicioSprint || null,
            completedAt: t.completedAt || dataConclusaoSprint || null
          });
        });
      }
    });
    const cycleTimes = [];
    const leadTimes = [];
    const niveis = ["trivial", "facil", "media", "dificil", "muito_dificil"];
    const porDificuldade = {};
    niveis.forEach((k) => {
      porDificuldade[k] = {
        nivel: k,
        total: 0,
        cycleTimes: [],
        leadTimes: [],
        avgCycleTime: null,
        avgLeadTime: null,
        porcentagem: 0
      };
    });
    tarefasConcluidas.forEach((t) => {
      const difKey = porDificuldade[t.difficulty] ? t.difficulty : "media";
      porDificuldade[difKey].total++;
      if (t.startedAt && t.completedAt) {
        const ms = new Date(t.completedAt).getTime() - new Date(t.startedAt).getTime();
        if (ms >= 0) {
          const dias = ms / (1e3 * 60 * 60 * 24);
          cycleTimes.push(dias);
          porDificuldade[difKey].cycleTimes.push(dias);
        }
      }
      if (t.createdAt && t.completedAt) {
        const ms = new Date(t.completedAt).getTime() - new Date(t.createdAt).getTime();
        if (ms >= 0) {
          const dias = ms / (1e3 * 60 * 60 * 24);
          leadTimes.push(dias);
          porDificuldade[difKey].leadTimes.push(dias);
        }
      }
    });
    let throughput7d = 0;
    let throughput30d = 0;
    tarefasConcluidas.forEach((t) => {
      if (t.completedAt) {
        const ms = new Date(t.completedAt).getTime();
        if (!isNaN(ms)) {
          if (ms >= seteDiasAtras) throughput7d++;
          if (ms >= trintaDiasAtras) throughput30d++;
        }
      }
    });
    const avgCycle = cycleTimes.length > 0 ? cycleTimes.reduce((acc, v) => acc + v, 0) / cycleTimes.length : null;
    const avgLead = leadTimes.length > 0 ? leadTimes.reduce((acc, v) => acc + v, 0) / leadTimes.length : null;
    const totalEntregas = tarefasConcluidas.length;
    niveis.forEach((k) => {
      const item = porDificuldade[k];
      item.avgCycleTime = item.cycleTimes.length > 0 ? item.cycleTimes.reduce((acc, v) => acc + v, 0) / item.cycleTimes.length : null;
      item.avgLeadTime = item.leadTimes.length > 0 ? item.leadTimes.reduce((acc, v) => acc + v, 0) / item.leadTimes.length : null;
      item.porcentagem = totalEntregas > 0 ? Math.round(item.total / totalEntregas * 100) : 0;
    });
    return {
      avgCycleTime: avgCycle,
      avgLeadTime: avgLead,
      throughput7d,
      throughput30d,
      totalEntregas,
      porDificuldade
    };
  }
  function formatarDiasMetrica(dias) {
    if (dias === null || isNaN(dias)) return "\u2014";
    if (dias < 0.05) return "< 0.1";
    return dias.toFixed(1);
  }
  function renderizarPainelMetricasFluxo() {
    const container = document.getElementById("painel-metricas-fluxo");
    if (!container) return;
    const metricas = calcularMetricasFluxo();
    const cycleStr = formatarDiasMetrica(metricas.avgCycleTime);
    const leadStr = formatarDiasMetrica(metricas.avgLeadTime);
    const niveis = ["trivial", "facil", "media", "dificil", "muito_dificil"];
    container.innerHTML = `
        <!-- 1. Linha com os 3 Cards de M\xE9tricas \xC1geis Principais -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <!-- Card 1: Cycle Time M\xE9dio -->
            <div class="relative group bg-white p-5 border border-beige rounded-sm shadow-xs transition-all hover:shadow-md hover:border-musgo/60 cursor-pointer" onclick="abrirModalInfoMetricas('cycle-time')" title="Cycle Time M\xE9dio: Tempo entre In Progress e Done. Clique para abrir o guia de m\xE9tricas.">
                <div class="flex items-center justify-between">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-musgo">M\xE9trica de Fluxo</span>
                    <button type="button" onclick="event.stopPropagation(); abrirModalInfoMetricas('cycle-time')" class="p-1 -mr-1 rounded-sm text-gray-400 hover:text-musgo hover:bg-musgo/10 transition-colors cursor-pointer" title="O que significa Cycle Time? Clique para ver detalhes e f\xF3rmula">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    </button>
                </div>
                <h3 class="font-serif text-sm font-semibold text-gray-600 mt-1 flex items-center gap-1.5">
                    <span>Cycle Time M\xE9dio</span>
                </h3>
                <div class="mt-2 flex items-baseline gap-2">
                    <span class="font-mono text-3xl font-bold text-dark">${cycleStr}</span>
                    <span class="text-xs text-gray-500 font-serif">${cycleStr === "\u2014" ? "" : cycleStr === "1.0" ? "dia" : "dias"}</span>
                </div>
                <p class="text-[11px] text-gray-400 mt-1.5 font-sans">
                    Tempo de execu\xE7\xE3o ativa (de <em>In Progress</em> at\xE9 <em>Done</em>)
                </p>
                <div class="mt-3 pt-2.5 border-t border-beige/60 flex items-center justify-between text-[11px] text-gray-500 group-hover:text-dark transition-colors">
                    <span class="flex items-center gap-1">
                        <svg class="w-3 h-3 text-musgo" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        O que significa?
                    </span>
                    <span class="font-serif text-musgo font-medium group-hover:underline flex items-center gap-0.5">
                        Ver detalhes <span>&rarr;</span>
                    </span>
                </div>

                <!-- Popover informativo -->
                <div class="metric-hover-popover absolute left-0 right-0 top-[calc(100%+6px)] z-40 bg-white border border-beige rounded-sm shadow-xl p-3.5 text-left opacity-0 invisible pointer-events-none">
                    <div class="flex items-center gap-1.5 text-musgo mb-1">
                        <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        <span class="text-xs font-bold font-serif">Cycle Time (Tempo de Ciclo)</span>
                    </div>
                    <p class="text-xs font-sans text-gray-700 leading-relaxed mb-2">
                        Mede o tempo real gasto trabalhando na tarefa (desde <em>In Progress</em> at\xE9 <em>Done</em>). Mede seu foco e velocidade de execu\xE7\xE3o.
                    </p>
                    <div class="p-1.5 bg-offwhite border border-beige/60 rounded-xs font-mono text-[10px] text-gray-600 mb-2">
                        F\xF3rmula: Data Conclus\xE3o - Data In\xEDcio
                    </div>
                    <p class="text-[11px] font-sans text-gray-500 italic">
                        \u{1F4A1} Dica: Respeite o Limite WIP para reduzir o Cycle Time.
                    </p>
                </div>
            </div>

            <!-- Card 2: Lead Time M\xE9dio -->
            <div class="relative group bg-white p-5 border border-beige rounded-sm shadow-xs transition-all hover:shadow-md hover:border-terracota/60 cursor-pointer" onclick="abrirModalInfoMetricas('lead-time')" title="Lead Time M\xE9dio: Tempo total desde a cria\xE7\xE3o no Backlog at\xE9 Done. Clique para abrir o guia de m\xE9tricas.">
                <div class="flex items-center justify-between">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-terracota">M\xE9trica de Fluxo</span>
                    <button type="button" onclick="event.stopPropagation(); abrirModalInfoMetricas('lead-time')" class="p-1 -mr-1 rounded-sm text-gray-400 hover:text-terracota hover:bg-terracota/10 transition-colors cursor-pointer" title="O que significa Lead Time? Clique para ver detalhes e f\xF3rmula">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    </button>
                </div>
                <h3 class="font-serif text-sm font-semibold text-gray-600 mt-1 flex items-center gap-1.5">
                    <span>Lead Time M\xE9dio</span>
                </h3>
                <div class="mt-2 flex items-baseline gap-2">
                    <span class="font-mono text-3xl font-bold text-dark">${leadStr}</span>
                    <span class="text-xs text-gray-500 font-serif">${leadStr === "\u2014" ? "" : leadStr === "1.0" ? "dia" : "dias"}</span>
                </div>
                <p class="text-[11px] text-gray-400 mt-1.5 font-sans">
                    Ciclo total (desde a cria\xE7\xE3o da ideia at\xE9 <em>Done</em>)
                </p>
                <div class="mt-3 pt-2.5 border-t border-beige/60 flex items-center justify-between text-[11px] text-gray-500 group-hover:text-dark transition-colors">
                    <span class="flex items-center gap-1">
                        <svg class="w-3 h-3 text-terracota" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        O que significa?
                    </span>
                    <span class="font-serif text-terracota font-medium group-hover:underline flex items-center gap-0.5">
                        Ver detalhes <span>&rarr;</span>
                    </span>
                </div>

                <!-- Popover informativo -->
                <div class="metric-hover-popover absolute left-0 right-0 top-[calc(100%+6px)] z-40 bg-white border border-beige rounded-sm shadow-xl p-3.5 text-left opacity-0 invisible pointer-events-none">
                    <div class="flex items-center gap-1.5 text-terracota mb-1">
                        <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                        <span class="text-xs font-bold font-serif">Lead Time (Tempo Total)</span>
                    </div>
                    <p class="text-xs font-sans text-gray-700 leading-relaxed mb-2">
                        Mede o ciclo de vida total da demanda: desde a anota\xE7\xE3o no <strong>Backlog</strong> at\xE9 ser conclu\xEDda em <strong>Done</strong>. Inclui a fila de espera.
                    </p>
                    <div class="p-1.5 bg-offwhite border border-beige/60 rounded-xs font-mono text-[10px] text-gray-600 mb-2">
                        F\xF3rmula: Data Conclus\xE3o - Data Cria\xE7\xE3o
                    </div>
                    <p class="text-[11px] font-sans text-gray-500 italic">
                        \u{1F4A1} Dica: Backlog enxuto e Ponto de Reabastecimento reduzem o Lead Time.
                    </p>
                </div>
            </div>

            <!-- Card 3: Throughput (Vaz\xE3o) -->
            <div class="relative group bg-white p-5 border border-beige rounded-sm shadow-xs transition-all hover:shadow-md hover:border-dark/60 cursor-pointer" onclick="abrirModalInfoMetricas('throughput')" title="Throughput: Quantidade de entregas finalizadas. Clique para abrir o guia de m\xE9tricas.">
                <div class="flex items-center justify-between">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-dark">Cad\xEAncia de Entrega</span>
                    <button type="button" onclick="event.stopPropagation(); abrirModalInfoMetricas('throughput')" class="p-1 -mr-1 rounded-sm text-gray-400 hover:text-dark hover:bg-beige transition-colors cursor-pointer" title="O que significa Throughput? Clique para ver detalhes e f\xF3rmula">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    </button>
                </div>
                <h3 class="font-serif text-sm font-semibold text-gray-600 mt-1 flex items-center gap-1.5">
                    <span>Throughput (Vaz\xE3o)</span>
                </h3>
                <div class="mt-2 flex items-baseline gap-3">
                    <div>
                        <span class="font-mono text-3xl font-bold text-dark">${metricas.throughput7d}</span>
                        <span class="text-xs text-gray-500 font-serif">/ 7 dias</span>
                    </div>
                    <span class="text-gray-300 font-sans">|</span>
                    <div>
                        <span class="font-mono text-xl font-bold text-gray-700">${metricas.throughput30d}</span>
                        <span class="text-xs text-gray-500 font-serif">/ 30 dias</span>
                    </div>
                </div>
                <p class="text-[11px] text-gray-400 mt-1.5 font-sans">
                    Tarefas entregues nos per\xEDodos recentes
                </p>
                <div class="mt-3 pt-2.5 border-t border-beige/60 flex items-center justify-between text-[11px] text-gray-500 group-hover:text-dark transition-colors">
                    <span class="flex items-center gap-1">
                        <svg class="w-3 h-3 text-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        O que significa?
                    </span>
                    <span class="font-serif text-dark font-medium group-hover:underline flex items-center gap-0.5">
                        Ver detalhes <span>&rarr;</span>
                    </span>
                </div>

                <!-- Popover informativo -->
                <div class="metric-hover-popover absolute left-0 right-0 top-[calc(100%+6px)] z-40 bg-white border border-beige rounded-sm shadow-xl p-3.5 text-left opacity-0 invisible pointer-events-none">
                    <div class="flex items-center gap-1.5 text-dark mb-1">
                        <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>
                        <span class="text-xs font-bold font-serif">Throughput (Vaz\xE3o de Entregas)</span>
                    </div>
                    <p class="text-xs font-sans text-gray-700 leading-relaxed mb-2">
                        Total de tarefas conclu\xEDdas na janela de 7 e 30 dias. Mede sua velocidade emp\xEDrica real de entrega sem pontos subjetivos.
                    </p>
                </div>
            </div>
        </div>

        <!-- 2. Linha com Desempenho & Distribui\xE7\xE3o por N\xEDvel de Dificuldade -->
        <div class="bg-white p-5 border border-beige rounded-sm shadow-xs transition-all hover:border-dark/30">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-beige/60 mb-4">
                <div>
                    <div class="flex items-center gap-2">
                        <span class="text-[10px] font-bold uppercase tracking-wider text-musgo">Calibra\xE7\xE3o & Esfor\xE7o</span>
                        <span class="text-xs text-gray-400">\u2022</span>
                        <span class="text-xs text-gray-500 font-sans">${metricas.totalEntregas} entrega${metricas.totalEntregas === 1 ? "" : "s"} analisada${metricas.totalEntregas === 1 ? "" : "s"}</span>
                    </div>
                    <h3 class="font-serif text-lg font-bold text-dark mt-0.5 flex items-center gap-2">
                        <span>Desempenho por N\xEDvel de Dificuldade</span>
                    </h3>
                </div>
                <button type="button" onclick="abrirModalInfoMetricas('dificuldade')" class="text-xs font-serif text-musgo hover:underline flex items-center gap-1 self-start sm:self-auto cursor-pointer" title="Saiba como usar a calibra\xE7\xE3o de dificuldade no planejamento">
                    <span>Como estimar com dificuldade</span>
                    <span>&rarr;</span>
                </button>
            </div>

            <!-- Barra de Distribui\xE7\xE3o Visual Multi-Segmento -->
            <div class="mb-5">
                <div class="flex items-center justify-between text-xs text-gray-500 mb-1.5 font-sans">
                    <span class="font-medium">Distribui\xE7\xE3o das Entregas Realizadas</span>
                    <span class="font-mono text-[11px]">${metricas.totalEntregas > 0 ? "100% dos itens conclu\xEDdos" : "Nenhuma entrega para calcular distribui\xE7\xE3o"}</span>
                </div>
                <div class="w-full h-3 bg-beige/60 rounded-sm overflow-hidden flex shadow-2xs">
                    ${metricas.totalEntregas > 0 ? niveis.map((k) => {
      const item = metricas.porDificuldade[k];
      const conf = DIFICULDADE_CONFIG[k];
      if (item.porcentagem === 0) return "";
      return `<div class="${conf.corDot} h-full transition-all duration-300" style="width: ${item.porcentagem}%" title="${conf.label}: ${item.total} tarefa(s) (${item.porcentagem}%)"></div>`;
    }).join("") : '<div class="w-full bg-gray-200 h-full" title="Sem tarefas conclu\xEDdas ainda"></div>'}
                </div>
            </div>

            <!-- Grid com M\xE9tricas dos 5 N\xEDveis -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                ${niveis.map((k) => {
      const item = metricas.porDificuldade[k];
      const conf = DIFICULDADE_CONFIG[k];
      const cycleNivelStr = formatarDiasMetrica(item.avgCycleTime);
      const leadNivelStr = formatarDiasMetrica(item.avgLeadTime);
      return `
                        <div class="p-3 bg-offwhite/80 border border-beige/70 rounded-sm flex flex-col justify-between hover:border-gray-300 transition-colors">
                            <div class="flex items-center justify-between gap-1 mb-2">
                                <div class="flex items-center gap-1.5 min-w-0">
                                    <span class="w-2.5 h-2.5 rounded-full ${conf.corDot} border ${conf.border} shrink-0 inline-block shadow-2xs"></span>
                                    <span class="font-serif text-sm font-bold text-dark truncate">${conf.label}</span>
                                </div>
                                <span class="font-mono text-xs font-semibold text-gray-700 bg-beige/60 px-1.5 py-0.5 rounded-sm shrink-0">${item.total}</span>
                            </div>

                            <div class="space-y-1.5 pt-1.5 border-t border-beige/50 text-[11px] font-sans">
                                <div class="flex items-center justify-between text-gray-600">
                                    <span class="text-gray-500" title="Tempo de execu\xE7\xE3o ativa (In Progress at\xE9 Done)">Cycle Time:</span>
                                    <span class="font-mono font-bold text-dark">${cycleNivelStr} ${cycleNivelStr !== "\u2014" ? "d" : ""}</span>
                                </div>
                                <div class="flex items-center justify-between text-gray-600">
                                    <span class="text-gray-500" title="Tempo total do fluxo (Cria\xE7\xE3o at\xE9 Done)">Lead Time:</span>
                                    <span class="font-mono text-gray-700">${leadNivelStr} ${leadNivelStr !== "\u2014" ? "d" : ""}</span>
                                </div>
                                <div class="flex items-center justify-between text-gray-400 text-[10px]">
                                    <span>Fatia do todo:</span>
                                    <span class="font-mono font-semibold text-gray-600">${item.porcentagem}%</span>
                                </div>
                            </div>
                        </div>
                    `;
    }).join("")}
            </div>

            <!-- Dica de Planejamento -->
            <div class="mt-4 pt-3 border-t border-beige/60 flex items-center gap-2 text-xs text-gray-500 font-sans">
                <span class="shrink-0 text-base">\u{1F4A1}</span>
                <p class="leading-relaxed">
                    <strong>Dica de Planejamento:</strong> Multiplique a quantidade estimada de cada dificuldade pelo seu <em>Cycle Time real</em> para saber com precis\xE3o quantas tarefas cabem na sua pr\xF3xima Sprint sem causar sobrecarga.
                </p>
            </div>
        </div>
    `;
  }
  function abrirModalInfoMetricas(metricaInicial = "cycle-time") {
    const modal = document.getElementById("modalInfoMetricas");
    if (!modal) return;
    selecionarAbaMetricaInfo(metricaInicial);
    modal.showModal();
  }
  function fecharModalInfoMetricas() {
    const modal = document.getElementById("modalInfoMetricas");
    if (modal) modal.close();
  }
  function selecionarAbaMetricaInfo(metrica) {
    const configAbas = {
      "cycle-time": { btnId: "btn-tab-info-cycle", contentId: "conteudo-info-cycle", borderClass: "border-musgo", textClass: "text-musgo" },
      "lead-time": { btnId: "btn-tab-info-lead", contentId: "conteudo-info-lead", borderClass: "border-terracota", textClass: "text-terracota" },
      "throughput": { btnId: "btn-tab-info-throughput", contentId: "conteudo-info-throughput", borderClass: "border-dark", textClass: "text-dark" },
      "dificuldade": { btnId: "btn-tab-info-dificuldade", contentId: "conteudo-info-dificuldade", borderClass: "border-media", textClass: "text-media" },
      "fluxo": { btnId: "btn-tab-info-fluxo", contentId: "conteudo-info-fluxo", borderClass: "border-musgo", textClass: "text-musgo" },
      "geral": { btnId: "btn-tab-info-fluxo", contentId: "conteudo-info-fluxo", borderClass: "border-musgo", textClass: "text-musgo" }
    };
    const alvo = configAbas[metrica] || configAbas["cycle-time"];
    document.querySelectorAll(".secao-info-metrica").forEach((el) => el.classList.add("hidden"));
    document.querySelectorAll(".tab-metrica-btn").forEach((btn2) => {
      btn2.classList.remove(
        "border-musgo",
        "border-terracota",
        "border-dark",
        "border-media",
        "text-musgo",
        "text-terracota",
        "text-dark",
        "text-media",
        "font-semibold"
      );
      btn2.classList.add("border-transparent", "text-gray-500", "font-medium");
    });
    const conteudo = document.getElementById(alvo.contentId);
    if (conteudo) conteudo.classList.remove("hidden");
    const btn = document.getElementById(alvo.btnId);
    if (btn) {
      btn.classList.remove("border-transparent", "text-gray-500", "font-medium");
      btn.classList.add(alvo.borderClass, alvo.textClass, "font-semibold");
    }
  }
  function gerarMarkdownSprint(hist) {
    const dataConclusao = formatarData(hist.closedAt ? hist.closedAt.split("T")[0] : hist.endDate);
    const entregas = hist.tasksDelivered || [];
    let md = `# Sprint: ${hist.sprintName}

`;
    md += `- **Per\xEDodo:** ${formatarData(hist.startDate)} a ${formatarData(hist.endDate)}
`;
    md += `- **Conclu\xEDda em:** ${dataConclusao}
`;
    md += `- **Total de Entregas:** ${entregas.length}
`;
    if (hist.sprintDescription && hist.sprintDescription.trim()) {
      md += `
### \u{1F3AF} Metas & Contexto da Sprint

`;
      md += `${hist.sprintDescription.trim()}
`;
    }
    if (hist.notes && hist.notes.trim()) {
      md += `
### \u{1F4DD} Observa\xE7\xF5es & Notas de Fechamento

`;
      md += `${hist.notes.trim()}
`;
    }
    md += `
### \u{1F4E6} Entregas Realizadas

`;
    if (entregas.length > 0) {
      entregas.forEach((t) => {
        const proj = t.project ? ` [${t.project}]` : "";
        const prio = t.priority ? ` *(Prioridade: ${t.priority.toUpperCase()})*` : "";
        const difNome = DIFICULDADE_CONFIG[t.difficulty]?.label || t.difficulty || "M\xE9dia";
        const dif = ` *(Dificuldade: ${difNome})*`;
        md += `- [x] **${t.title}**${proj}${prio}${dif}
`;
      });
    } else {
      md += `*Nenhuma tarefa registrada como conclu\xEDda neste ciclo.*
`;
    }
    md += `
---
*Exportado pelo Scrumban Pessoal em ${(/* @__PURE__ */ new Date()).toLocaleDateString("pt-BR")}*
`;
    return md;
  }
  async function copiarMarkdownSprint(histId) {
    const hist = (appState.history || []).find((h) => h.id === histId);
    if (!hist) {
      mostrarToast("Sprint n\xE3o encontrada no hist\xF3rico.", "erro");
      return;
    }
    const markdown = gerarMarkdownSprint(hist);
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(markdown);
      } else {
        const tempTa = document.createElement("textarea");
        tempTa.value = markdown;
        tempTa.style.position = "fixed";
        tempTa.style.left = "-9999px";
        tempTa.style.top = "0";
        document.body.appendChild(tempTa);
        tempTa.focus();
        tempTa.select();
        const copiou = document.execCommand("copy");
        document.body.removeChild(tempTa);
        if (!copiou) throw new Error("execCommand falhou");
      }
      mostrarToast(`Resumo da sprint "${hist.sprintName}" copiado em Markdown!`, "sucesso");
    } catch (err) {
      console.error("Erro ao copiar Markdown:", err);
      mostrarToast("N\xE3o foi poss\xEDvel copiar para a \xE1rea de transfer\xEAncia.", "erro");
    }
  }
  function baixarCsvSprint(histId) {
    const hist = (appState.history || []).find((h) => h.id === histId);
    if (!hist) {
      mostrarToast("Sprint n\xE3o encontrada no hist\xF3rico.", "erro");
      return;
    }
    const colunas = [
      "ID da Tarefa",
      "T\xEDtulo",
      "Projeto",
      "Prioridade",
      "Dificuldade",
      "Data Cria\xE7\xE3o",
      "Data In\xEDcio",
      "Data Conclus\xE3o",
      "Sprint",
      "Notas da Sprint"
    ];
    const escapeCsv = (val) => {
      if (val === null || val === void 0) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };
    const linhas = [colunas.map(escapeCsv).join(";")];
    (hist.tasksDelivered || []).forEach((t) => {
      const linha = [
        t.id || "",
        t.title || "",
        t.project || "Geral",
        (t.priority || "").toUpperCase(),
        DIFICULDADE_CONFIG[t.difficulty]?.label || t.difficulty || "M\xE9dia",
        t.createdAt ? formatarData(t.createdAt.split("T")[0]) : "",
        t.startedAt ? formatarData(t.startedAt.split("T")[0]) : "",
        t.completedAt ? formatarData(t.completedAt.split("T")[0]) : "",
        hist.sprintName || "",
        hist.notes || ""
      ];
      linhas.push(linha.map(escapeCsv).join(";"));
    });
    const conteudoCsv = "\uFEFF" + linhas.join("\r\n");
    const blob = new Blob([conteudoCsv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const slug = (hist.sprintName || "sprint").toLowerCase().replace(/[^a-z0-9_-]/gi, "_");
    link.href = url;
    link.download = `entregas-${slug}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    mostrarToast(`CSV da sprint "${hist.sprintName}" baixado com sucesso!`, "sucesso");
  }

  // js/sprint-closure.js
  function abrirModalConcluirSprint() {
    const cur = appState.sprints.find((s) => s.status === "current");
    if (!cur) {
      mostrarToast('Nenhuma sprint ativa no momento. Crie ou ative uma sprint na aba "Gerenciar Sprints".', "info");
      return;
    }
    const tarefasDone = appState.tasks.filter((t) => t.column === "done");
    const tarefasPendentes = appState.tasks.filter((t) => t.column !== "done");
    const nomeEl = document.getElementById("concluir-sprint-nome");
    const doneEl = document.getElementById("concluir-sprint-done-count");
    const pendEl = document.getElementById("concluir-sprint-pending-count");
    const notesEl = document.getElementById("concluir-sprint-notes");
    if (nomeEl) nomeEl.innerText = cur.name;
    if (doneEl) doneEl.innerText = `${tarefasDone.length} tarefas entregues`;
    if (pendEl) pendEl.innerText = `${tarefasPendentes.length} tarefas n\xE3o conclu\xEDdas`;
    if (notesEl) notesEl.value = "";
    const modal = document.getElementById("modalConcluirSprint");
    if (modal) modal.showModal();
  }
  function fecharModalConcluirSprint() {
    const modal = document.getElementById("modalConcluirSprint");
    if (modal) modal.close();
  }
  function confirmarFechamentoSprint() {
    const cur = appState.sprints.find((s) => s.status === "current");
    if (!cur) return;
    const tarefasDone = appState.tasks.filter((t) => t.column === "done");
    const acaoPendentes = document.querySelector('input[name="acaoPendentes"]:checked')?.value || "keep";
    const notesInput = document.getElementById("concluir-sprint-notes");
    const notes = notesInput ? notesInput.value.trim() : "";
    const registroHistorico = {
      id: gerarId("hist"),
      sprintId: cur.id,
      sprintName: cur.name,
      sprintDescription: cur.description || "",
      notes,
      startDate: cur.startDate,
      endDate: cur.endDate,
      closedAt: (/* @__PURE__ */ new Date()).toISOString(),
      tasksDelivered: tarefasDone.map((t) => ({
        id: t.id,
        title: t.title,
        project: t.project,
        priority: t.priority,
        difficulty: t.difficulty || "media",
        createdAt: t.createdAt || null,
        startedAt: t.startedAt || null,
        completedAt: t.completedAt || (/* @__PURE__ */ new Date()).toISOString()
      }))
    };
    appState.history.unshift(registroHistorico);
    appState.tasks = appState.tasks.filter((t) => t.column !== "done");
    appState.tasks.forEach((t) => {
      if (t.parentId && !appState.tasks.some((p) => p.id === t.parentId)) {
        t.parentId = null;
      }
    });
    if (acaoPendentes === "backlog") {
      appState.tasks.forEach((t) => {
        if (t.column !== "backlog") t.column = "backlog";
      });
    }
    cur.status = "past";
    const proxima = appState.sprints.find((s) => s.status === "future");
    if (proxima) {
      proxima.status = "current";
    }
    saveState();
    fecharModalConcluirSprint();
    renderizarQuadro();
    mudarAba("view-historico");
    mostrarToast(`Sprint "${cur.name}" conclu\xEDda e arquivada no hist\xF3rico!`, "sucesso");
  }
  function abrirModalEditarNotasSprint(histId) {
    const hist = (appState.history || []).find((h) => h.id === histId);
    if (!hist) {
      mostrarToast("Sprint n\xE3o encontrada no hist\xF3rico.", "erro");
      return;
    }
    const idEl = document.getElementById("editar-notas-sprint-id");
    const nomeEl = document.getElementById("editar-notas-sprint-nome");
    const textoEl = document.getElementById("editar-notas-sprint-texto");
    if (idEl) idEl.value = hist.id;
    if (nomeEl) nomeEl.innerText = `Sprint: ${hist.sprintName}`;
    if (textoEl) textoEl.value = hist.notes || "";
    const modal = document.getElementById("modalEditarNotasSprint");
    if (modal) modal.showModal();
  }
  function fecharModalEditarNotasSprint() {
    const modal = document.getElementById("modalEditarNotasSprint");
    if (modal) modal.close();
  }
  function salvarNotasSprintHistorico() {
    const idEl = document.getElementById("editar-notas-sprint-id");
    const textoEl = document.getElementById("editar-notas-sprint-texto");
    if (!idEl || !idEl.value) return;
    const hist = (appState.history || []).find((h) => h.id === idEl.value);
    if (!hist) {
      mostrarToast("Sprint n\xE3o encontrada.", "erro");
      return;
    }
    hist.notes = textoEl ? textoEl.value.trim() : "";
    saveState();
    fecharModalEditarNotasSprint();
    renderizarAbaHistorico();
    mostrarToast("Notas da sprint salvas com sucesso!", "sucesso");
  }
  function reabrirSprintHistorico(histId) {
    const hist = (appState.history || []).find((h) => h.id === histId);
    if (!hist) {
      mostrarToast("Sprint n\xE3o encontrada no hist\xF3rico.", "erro");
      return;
    }
    if (!confirm(`Deseja reabrir a sprint "${hist.sprintName}"?

Ela voltar\xE1 a ser a Sprint Atual no Quadro e suas tarefas conclu\xEDdas ser\xE3o restauradas.`)) {
      return;
    }
    appState.sprints.forEach((s) => {
      if (s.status === "current") {
        s.status = "future";
      }
    });
    let sprintExistente = appState.sprints.find((s) => s.id === hist.sprintId);
    if (sprintExistente) {
      sprintExistente.status = "current";
    } else {
      sprintExistente = {
        id: hist.sprintId || gerarId("sprint"),
        name: hist.sprintName,
        description: hist.sprintDescription || "",
        startDate: hist.startDate,
        endDate: hist.endDate,
        status: "current"
      };
      appState.sprints.unshift(sprintExistente);
    }
    if (Array.isArray(hist.tasksDelivered)) {
      hist.tasksDelivered.forEach((t) => {
        const taskExistente = appState.tasks.find((x) => x.id === t.id);
        if (taskExistente) {
          taskExistente.column = "done";
          taskExistente.sprintId = sprintExistente.id;
        } else {
          appState.tasks.push({
            id: t.id,
            title: t.title,
            description: "",
            project: t.project || "",
            priority: t.priority || "media",
            column: "done",
            sprintId: sprintExistente.id,
            createdAt: t.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
            startedAt: t.startedAt || null,
            completedAt: t.completedAt || (/* @__PURE__ */ new Date()).toISOString(),
            subtasks: []
          });
        }
      });
    }
    appState.history = appState.history.filter((h) => h.id !== histId);
    saveState();
    renderizarAbaHistorico();
    renderizarAbaSprints();
    renderizarHeaderSprints();
    renderizarQuadro();
    mudarAba("view-quadro");
    mostrarToast(`Sprint "${hist.sprintName}" reaberta com sucesso no Quadro!`, "sucesso");
  }
  function excluirSprintHistorico(histId) {
    const hist = (appState.history || []).find((h) => h.id === histId);
    if (!hist) {
      mostrarToast("Sprint n\xE3o encontrada no hist\xF3rico.", "erro");
      return;
    }
    if (!confirm(`Tem certeza que deseja excluir permanentemente o registro da sprint "${hist.sprintName}" do hist\xF3rico?

Esta a\xE7\xE3o n\xE3o poder\xE1 ser desfeita.`)) {
      return;
    }
    appState.history = appState.history.filter((h) => h.id !== histId);
    saveState();
    renderizarAbaHistorico();
    renderizarHeaderSprints();
    mostrarToast(`Registro da sprint "${hist.sprintName}" exclu\xEDdo do hist\xF3rico.`, "info");
  }
  function renderizarAbaHistorico() {
    const container = document.getElementById("historico-lista-conteudo");
    if (!container) return;
    renderizarPainelMetricasFluxo();
    if (appState.history.length === 0) {
      container.innerHTML = `
            <div class="bg-white p-8 border border-beige rounded-sm text-center">
                <p class="font-serif text-lg text-gray-500 mb-2">Nenhuma sprint finalizada ainda.</p>
                <p class="text-xs text-gray-400">Assim que voc\xEA concluir sua primeira Sprint no Quadro, ela aparecer\xE1 registrada aqui com todas as entregas.</p>
            </div>
        `;
      return;
    }
    const fragment = document.createDocumentFragment();
    appState.history.forEach((hist) => {
      const dataConclusao = formatarData(hist.closedAt ? hist.closedAt.split("T")[0] : hist.endDate);
      const cardHist = document.createElement("div");
      cardHist.className = "bg-white p-6 border border-beige rounded-sm shadow-xs transition-shadow hover:shadow-sm";
      let entregasHtml = "";
      if (hist.tasksDelivered && hist.tasksDelivered.length > 0) {
        entregasHtml = hist.tasksDelivered.map((t) => {
          const prio = PRIORIDADE_CONFIG[t.priority] || PRIORIDADE_CONFIG.media;
          const dif = DIFICULDADE_CONFIG[t.difficulty] || DIFICULDADE_CONFIG.media;
          return `
                    <li class="p-2 bg-offwhite border border-beige/60 rounded-sm flex items-center justify-between gap-3 text-sm">
                        <div class="flex items-center gap-2 min-w-0">
                            <span class="w-2 h-2 rounded-full ${dif.corDot} border ${dif.border} inline-block shrink-0" title="Dificuldade: ${dif.label}"></span>
                            <svg class="w-4 h-4 text-musgo shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                            <span class="font-serif text-base text-dark truncate">${escapeHTML(t.title)}</span>
                        </div>
                        <div class="flex items-center gap-1.5 shrink-0">
                            ${t.project ? `<span class="text-[9px] bg-beige px-1.5 py-0.5 rounded-sm text-gray-600">${escapeHTML(t.project)}</span>` : ""}
                            <span class="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-sm ${prio.cor}">${t.priority}</span>
                            <span class="text-[9px] font-sans font-medium px-1.5 py-0.5 rounded-sm bg-beige/60 text-dark border border-beige/80">${dif.label}</span>
                        </div>
                    </li>
                `;
        }).join("");
      } else {
        entregasHtml = `<li class="text-xs text-gray-400 font-serif italic py-2">Nenhuma tarefa marcada como Done no fechamento deste ciclo.</li>`;
      }
      const notesBlock = hist.notes ? `
            <div class="mt-3 p-3 bg-offwhite border border-beige/80 rounded-sm">
                <div class="flex items-center gap-1.5 text-musgo mb-1">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                    <span class="text-[10px] font-bold uppercase tracking-wider">Notas de Fechamento & Observa\xE7\xF5es</span>
                </div>
                <p class="text-sm font-sans text-dark whitespace-pre-line leading-relaxed">${escapeHTML(hist.notes)}</p>
            </div>
        ` : "";
      cardHist.innerHTML = `
            <div class="flex flex-col sm:flex-row sm:items-center justify-between border-b border-beige pb-4 mb-4 gap-2">
                <div>
                    <span class="text-[10px] font-bold uppercase tracking-wider text-musgo">Sprint Conclu\xEDda</span>
                    <h3 class="font-serif text-2xl font-bold text-dark">${escapeHTML(hist.sprintName)}</h3>
                    ${hist.sprintDescription ? `<p class="sprint-descricao-box text-sm font-sans text-dark mt-2 mb-2 whitespace-pre-line p-3 rounded-sm leading-relaxed">${escapeHTML(hist.sprintDescription)}</p>` : ""}
                    ${notesBlock}
                    <p class="text-xs text-gray-500 font-sans mt-2">
                        Realizada de ${formatarData(hist.startDate)} a ${formatarData(hist.endDate)} \u2022 Fechada em ${dataConclusao}
                    </p>
                </div>
                <div class="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
                    <button onclick="reabrirSprintHistorico('${hist.id}')" class="px-2.5 py-1 text-xs font-sans font-medium border border-beige hover:border-dark/30 bg-offwhite hover:bg-beige text-dark rounded-sm flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer" title="Reabrir esta sprint e restaur\xE1-la como ativa no Quadro">
                        <svg class="w-3.5 h-3.5 text-musgo shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                        </svg>
                        <span>Reabrir Sprint</span>
                    </button>
                    <button onclick="abrirModalEditarNotasSprint('${hist.id}')" class="px-2.5 py-1 text-xs font-sans font-medium border border-beige hover:border-dark/30 bg-offwhite hover:bg-beige text-dark rounded-sm flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer" title="Adicionar ou editar notas e observa\xE7\xF5es desta sprint">
                        <svg class="w-3.5 h-3.5 text-gray-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                        </svg>
                        <span>${hist.notes ? "Editar Notas" : "Adicionar Nota"}</span>
                    </button>
                    <button onclick="copiarMarkdownSprint('${hist.id}')" class="px-2.5 py-1 text-xs font-sans font-medium border border-beige hover:border-dark/30 bg-offwhite hover:bg-beige text-dark rounded-sm flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer" title="Copiar resumo da sprint formatado em Markdown para Obsidian, Notion ou GitHub">
                        <svg class="w-3.5 h-3.5 text-gray-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path>
                        </svg>
                        <span>Copiar Markdown</span>
                    </button>
                    <button onclick="baixarCsvSprint('${hist.id}')" class="px-2.5 py-1 text-xs font-sans font-medium border border-beige hover:border-dark/30 bg-offwhite hover:bg-beige text-dark rounded-sm flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer" title="Baixar entregas da sprint em arquivo CSV estruturado">
                        <svg class="w-3.5 h-3.5 text-gray-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                        </svg>
                        <span>Baixar CSV</span>
                    </button>
                    <button onclick="excluirSprintHistorico('${hist.id}')" class="px-2 py-1 text-xs font-sans text-gray-400 hover:text-terracota rounded-sm flex items-center gap-1 transition-colors cursor-pointer" title="Excluir permanentemente este registro do hist\xF3rico">
                        <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                        <span>Excluir</span>
                    </button>
                    <span class="bg-musgo text-white text-xs font-bold font-serif px-3 py-1 rounded-sm">
                        ${hist.tasksDelivered ? hist.tasksDelivered.length : 0} Entregas
                    </span>
                </div>
            </div>

            <h4 class="font-serif text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Entreg\xE1veis Conclu\xEDdos:</h4>
            <ul class="space-y-2">
                ${entregasHtml}
            </ul>
        `;
      fragment.appendChild(cardHist);
    });
    container.innerHTML = "";
    container.appendChild(fragment);
  }

  // js/theme.js
  var ICONE_LUA = `<svg class="w-3.5 h-3.5 text-media shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>`;
  var ICONE_SOL = `<svg class="w-3.5 h-3.5 text-media shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>`;
  function obterPreferenciaTema() {
    try {
      return localStorage.getItem("scrumban_theme") || "system";
    } catch {
      return "system";
    }
  }
  function ehTemaEscuroAtivo() {
    return document.documentElement.classList.contains("dark");
  }
  function aplicarTema(modo) {
    const prefereEscuroSistema = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    let deveFicarEscuro = modo === "dark" || modo !== "light" && prefereEscuroSistema;
    if (deveFicarEscuro) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    atualizarUIModoTema(modo, deveFicarEscuro);
  }
  function definirTema(modo) {
    try {
      if (modo === "system") {
        localStorage.removeItem("scrumban_theme");
      } else {
        localStorage.setItem("scrumban_theme", modo);
      }
    } catch {
    }
    aplicarTema(modo);
    const msg = modo === "dark" ? "Modo Escuro ativado." : modo === "light" ? "Modo Claro ativado." : "Tema ajustado para seguir o sistema.";
    mostrarToast(msg, "info", 2500);
  }
  function toggleTemaDark() {
    const novoModo = ehTemaEscuroAtivo() ? "light" : "dark";
    definirTema(novoModo);
  }
  function atualizarUIModoTema(modoConfigurado, estaEscuro) {
    const iconeEl = document.getElementById("tema-icone");
    const mobileIconeEl = document.getElementById("mobile-tema-icone");
    const textoEl = document.getElementById("tema-texto");
    const indicadorEl = document.getElementById("tema-indicador");
    const btnToggle = document.getElementById("btnToggleTema");
    const htmlIcone = estaEscuro ? ICONE_SOL : ICONE_LUA;
    if (iconeEl) iconeEl.innerHTML = htmlIcone;
    if (mobileIconeEl) mobileIconeEl.innerHTML = htmlIcone;
    if (textoEl) textoEl.textContent = estaEscuro ? "Modo Claro" : "Modo Escuro";
    if (indicadorEl) indicadorEl.textContent = modoConfigurado === "system" ? "Auto" : estaEscuro ? "Escuro" : "Claro";
    if (btnToggle) btnToggle.title = estaEscuro ? "Alternar para modo claro (D)" : "Alternar para modo escuro (D)";
    const badgeConfig = document.getElementById("badge-tema-atual");
    if (badgeConfig) badgeConfig.textContent = estaEscuro ? "Tema Escuro Ativo" : "Tema Claro Ativo";
    const radios = document.querySelectorAll('input[name="opcaoTemaConfig"]');
    radios.forEach((r) => {
      r.checked = r.value === modoConfigurado;
    });
  }
  function inicializarTemaDark() {
    const modoSalvo = obterPreferenciaTema();
    aplicarTema(modoSalvo);
    if (window.matchMedia) {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", () => {
        if (obterPreferenciaTema() === "system") aplicarTema("system");
      });
    }
  }

  // js/config.js
  function renderizarAbaConfig() {
    const inputWip = document.getElementById("configWipLimit");
    if (inputWip) inputWip.value = appState.settings.wipLimit;
    const inputReplenish = document.getElementById("configReplenishmentLimit");
    if (inputReplenish) inputReplenish.value = typeof appState.settings.replenishmentLimit === "number" ? appState.settings.replenishmentLimit : 2;
    const listaProjetos = document.getElementById("configListaProjetos");
    if (listaProjetos) {
      listaProjetos.innerHTML = appState.settings.projects.map((p, i) => `
            <li class="flex items-center justify-between p-2 bg-offwhite border border-beige rounded-sm text-sm">
                <span class="font-serif text-base">${escapeHTML(p)}</span>
                <button onclick="removerProjetoConfig(${i})" class="text-xs text-gray-400 hover:text-terracota underline">Excluir</button>
            </li>
        `).join("");
    }
    atualizarUIModoSubtasksVisibilidade();
    atualizarUIModoTema(obterPreferenciaTema(), ehTemaEscuroAtivo());
  }
  function salvarConfigSubtasksVisibilidade(modo) {
    const novoModo = modo === "parent_only" ? "parent_only" : "all";
    appState.settings.subtasksVisibility = novoModo;
    saveState();
    atualizarUIModoSubtasksVisibilidade();
    renderizarQuadro();
    atualizarContadoresColunas();
    atualizarWipBadge();
    atualizarOverdueBadge();
    const txtModo = novoModo === "parent_only" ? "Apenas tarefas principais" : "Todas as tarefas vis\xEDveis";
    mostrarToast(`Visualiza\xE7\xE3o do quadro alterada para: ${txtModo}`, "sucesso");
  }
  function atualizarUIModoSubtasksVisibilidade() {
    const modo = appState.settings.subtasksVisibility || "all";
    const radios = document.querySelectorAll('input[name="opcaoVisibilidadeSubtasks"]');
    radios.forEach((radio) => {
      radio.checked = radio.value === modo;
    });
    const badge = document.getElementById("badge-subtasks-visibilidade");
    if (badge) {
      badge.innerText = modo === "parent_only" ? "Apenas Tarefas Pai" : "Todas Vis\xEDveis";
    }
  }
  function salvarConfigWip() {
    const valor = parseInt(document.getElementById("configWipLimit").value, 10);
    appState.settings.wipLimit = isNaN(valor) || valor < 0 ? 0 : valor;
    saveState();
    renderizarQuadro();
    mostrarToast("Limite de WIP atualizado com sucesso!", "sucesso");
  }
  function salvarConfigReplenishment() {
    const input = document.getElementById("configReplenishmentLimit");
    if (!input) return;
    const valor = parseInt(input.value, 10);
    appState.settings.replenishmentLimit = isNaN(valor) || valor < 0 ? 0 : valor;
    saveState();
    verificarPontoReabastecimento();
    mostrarToast("Ponto de reabastecimento salvo com sucesso!", "sucesso");
  }
  function adicionarProjetoConfig() {
    const input = document.getElementById("configNovoProjeto");
    const nome = input.value.trim();
    if (!nome) return;
    if (!appState.settings.projects.includes(nome)) {
      appState.settings.projects.push(nome);
      saveState();
      input.value = "";
      renderizarAbaConfig();
      atualizarFiltrosUI();
      mostrarToast(`Projeto "${nome}" cadastrado com sucesso!`, "sucesso");
    }
  }
  function removerProjetoConfig(index) {
    if (appState.settings.projects.length <= 1) {
      mostrarToast("Mantenha pelo menos um projeto cadastrado no sistema.", "erro");
      return;
    }
    const removido = appState.settings.projects.splice(index, 1)[0];
    saveState();
    renderizarAbaConfig();
    atualizarFiltrosUI();
    renderizarQuadro();
    mostrarToast(`Projeto "${removido}" removido.`, "info");
  }

  // js/sidebar.js
  function toggleBarraLateral() {
    const sidebar = document.getElementById("barra-lateral");
    const icon = document.getElementById("iconToggleSidebar");
    const btn = document.getElementById("btnToggleSidebar");
    if (!sidebar) return;
    const isCollapsed = sidebar.classList.toggle("collapsed");
    try {
      localStorage.setItem("scrumban_sidebar_collapsed", isCollapsed ? "true" : "false");
    } catch {
    }
    if (icon) {
      if (isCollapsed) icon.classList.add("rotate-180");
      else icon.classList.remove("rotate-180");
    }
    if (btn) btn.title = isCollapsed ? "Expandir menu lateral ([)" : "Recolher menu lateral ([)";
  }
  function inicializarBarraLateral() {
    let isCollapsed = false;
    try {
      isCollapsed = localStorage.getItem("scrumban_sidebar_collapsed") === "true";
    } catch {
      isCollapsed = false;
    }
    const sidebar = document.getElementById("barra-lateral");
    const icon = document.getElementById("iconToggleSidebar");
    const btn = document.getElementById("btnToggleSidebar");
    if (sidebar && isCollapsed) {
      sidebar.classList.add("collapsed");
      if (icon) icon.classList.add("rotate-180");
      if (btn) btn.title = "Expandir menu lateral ([)";
    }
  }
  function toggleMobileMenu() {
    const sidebar = document.getElementById("barra-lateral");
    const overlay = document.getElementById("mobile-drawer-overlay");
    if (!sidebar) return;
    const aberto = sidebar.classList.toggle("mobile-open");
    if (overlay) {
      if (aberto) overlay.classList.remove("hidden");
      else overlay.classList.add("hidden");
    }
  }
  function fecharMobileMenu() {
    const sidebar = document.getElementById("barra-lateral");
    const overlay = document.getElementById("mobile-drawer-overlay");
    if (sidebar) sidebar.classList.remove("mobile-open");
    if (overlay) overlay.classList.add("hidden");
  }

  // js/ui.js
  var tarefaExcluidaPendente = null;
  var timerUndoExclusao = null;
  function mostrarToast(mensagem, tipo = "info", duracaoMs = 4500) {
    const container = document.getElementById("toast-container");
    if (!container) {
      console.log(`[Toast ${tipo}]: ${mensagem}`);
      return;
    }
    const toast = document.createElement("div");
    toast.className = "toast-entry pointer-events-auto flex items-start gap-3 p-3.5 bg-white border rounded-sm shadow-md transition-all font-serif text-sm max-w-sm";
    let iconSvg = "";
    let borderClass = "";
    let title = "";
    if (tipo === "sucesso") {
      borderClass = "border-l-4 border-l-musgo border-beige text-dark";
      title = "Sucesso";
      iconSvg = `<svg class="w-5 h-5 text-musgo shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
    } else if (tipo === "erro") {
      borderClass = "border-l-4 border-l-terracota border-beige text-dark";
      title = "Aten\xE7\xE3o";
      iconSvg = `<svg class="w-5 h-5 text-terracota shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`;
    } else {
      borderClass = "border-l-4 border-l-media border-beige text-dark";
      title = "Informa\xE7\xE3o";
      iconSvg = `<svg class="w-5 h-5 text-media shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
    }
    toast.className += ` ${borderClass}`;
    toast.innerHTML = `
        ${iconSvg}
        <div class="flex-1 min-w-0 pr-1">
            <p class="font-bold text-[13px] uppercase tracking-wider ${tipo === "erro" ? "text-terracota" : tipo === "sucesso" ? "text-musgo" : "text-dark"}">${title}</p>
            <p class="text-xs text-gray-700 font-sans mt-0.5 leading-snug">${escapeHTML(mensagem)}</p>
        </div>
        <button type="button" class="text-gray-400 hover:text-dark p-0.5 text-xs font-sans shrink-0" aria-label="Fechar">&times;</button>
    `;
    const closeBtn = toast.querySelector("button");
    let timerId = null;
    const removerToast = () => {
      if (timerId) clearTimeout(timerId);
      toast.classList.remove("toast-entry");
      toast.classList.add("toast-exit");
      setTimeout(() => {
        if (toast.parentNode) toast.remove();
      }, 250);
    };
    closeBtn.addEventListener("click", removerToast);
    timerId = setTimeout(removerToast, duracaoMs);
    container.appendChild(toast);
  }
  function mostrarToastComAcao(mensagem, textoAcao, callbackAcao, duracaoMs = 6e3) {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = "toast-entry pointer-events-auto flex items-center justify-between gap-3 p-3.5 bg-dark text-white border border-gray-700 rounded-sm shadow-xl font-serif text-sm max-w-md w-full";
    toast.innerHTML = `
        <div class="flex items-center gap-2.5 min-w-0">
            <svg class="w-4 h-4 text-terracota shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            <p class="text-xs text-gray-200 font-sans truncate">${escapeHTML(mensagem)}</p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
            <button type="button" class="btn-undo-toast bg-terracota hover:bg-opacity-90 text-white font-sans text-xs font-bold px-2.5 py-1 rounded-xs transition-colors shadow-xs">
                ${escapeHTML(textoAcao)}
            </button>
            <button type="button" class="btn-close-toast text-gray-400 hover:text-white p-1 text-sm font-sans" aria-label="Fechar">&times;</button>
        </div>
    `;
    const undoBtn = toast.querySelector(".btn-undo-toast");
    const closeBtn = toast.querySelector(".btn-close-toast");
    let timerId = null;
    const removerToast = () => {
      if (timerId) clearTimeout(timerId);
      toast.classList.remove("toast-entry");
      toast.classList.add("toast-exit");
      setTimeout(() => {
        if (toast.parentNode) toast.remove();
      }, 250);
    };
    undoBtn.addEventListener("click", () => {
      removerToast();
      if (typeof callbackAcao === "function") callbackAcao();
    });
    closeBtn.addEventListener("click", removerToast);
    timerId = setTimeout(removerToast, duracaoMs);
    container.appendChild(toast);
  }
  function executarExclusaoComUndo(taskId) {
    const index = appState.tasks.findIndex((t) => t.id === taskId);
    if (index === -1) return;
    const tarefaCopia = JSON.parse(JSON.stringify(appState.tasks[index]));
    const coluna = tarefaCopia.column;
    if (tarefaExcluidaPendente && timerUndoExclusao) {
      clearTimeout(timerUndoExclusao);
      tarefaExcluidaPendente = null;
    }
    const filhasIds = appState.tasks.filter((t) => t.parentId === taskId).map((t) => t.id);
    appState.tasks.forEach((t) => {
      if (t.parentId === taskId) t.parentId = null;
    });
    tarefaExcluidaPendente = { tarefa: tarefaCopia, indexOriginal: index, filhasIds };
    appState.tasks.splice(index, 1);
    saveState();
    const cardEl = document.getElementById(`card-${taskId}`);
    if (cardEl) cardEl.remove();
    if (tarefaCopia.parentId) {
      const parentCard = document.getElementById(`card-${tarefaCopia.parentId}`);
      const parentTask = appState.tasks.find((t) => t.id === tarefaCopia.parentId);
      if (parentCard && parentTask) atualizarConteudoCard(parentCard, parentTask);
    }
    verificarPlaceholderColuna(coluna);
    atualizarContadoresColunas([coluna]);
    atualizarWipBadge();
    atualizarOverdueBadge();
    verificarPontoReabastecimento();
    renderizarHeaderSprints2();
    fecharModalDetalhes();
    fecharModalTarefa();
    mostrarToastComAcao(`Tarefa "${tarefaCopia.title}" exclu\xEDda.`, "Desfazer", () => {
      desfazerExclusaoTarefa();
    }, 6e3);
    timerUndoExclusao = setTimeout(() => {
      tarefaExcluidaPendente = null;
      timerUndoExclusao = null;
    }, 6e3);
  }
  function desfazerExclusaoTarefa() {
    if (!tarefaExcluidaPendente) return;
    if (timerUndoExclusao) {
      clearTimeout(timerUndoExclusao);
      timerUndoExclusao = null;
    }
    const { tarefa, indexOriginal, filhasIds } = tarefaExcluidaPendente;
    tarefaExcluidaPendente = null;
    if (indexOriginal >= 0 && indexOriginal <= appState.tasks.length) {
      appState.tasks.splice(indexOriginal, 0, tarefa);
    } else {
      appState.tasks.push(tarefa);
    }
    if (filhasIds && filhasIds.length > 0) {
      appState.tasks.forEach((t) => {
        if (filhasIds.includes(t.id)) t.parentId = tarefa.id;
      });
    }
    saveState();
    renderizarQuadro();
    mostrarToast(`Tarefa "${tarefa.title}" restaurada com sucesso!`, "sucesso", 3500);
  }
  function mudarAba(abaId) {
    fecharMobileMenu();
    document.querySelectorAll(".aba-content").forEach((el) => {
      el.classList.add("hidden-tab");
      el.classList.remove("active-tab");
    });
    const abaAtiva = document.getElementById(abaId);
    if (abaAtiva) {
      abaAtiva.classList.remove("hidden-tab");
      abaAtiva.classList.add("active-tab");
    }
    document.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.classList.remove("bg-beige", "text-dark", "font-semibold", "shadow-xs");
      btn.classList.add("text-gray-600");
    });
    const idPrefixo = abaId.replace("view-", "");
    const btnAtivo = document.getElementById("btn-" + idPrefixo);
    if (btnAtivo) {
      btnAtivo.classList.remove("text-gray-600");
      btnAtivo.classList.add("bg-beige", "text-dark", "font-semibold");
    }
    if (abaId === "view-quadro") renderizarQuadro();
    if (abaId === "view-sprints") renderizarAbaSprints2();
    if (abaId === "view-historico") renderizarAbaHistorico();
    if (abaId === "view-config") renderizarAbaConfig();
  }
  function atualizarFiltrosUI() {
    const select = document.getElementById("filtroProjeto");
    if (!select) return;
    const valorAtual = uiFilters.project;
    select.innerHTML = `
        <option value="all">Todos os Projetos</option>
        ${appState.settings.projects.map((p) => `
            <option value="${escapeHTML(p)}" ${valorAtual === p ? "selected" : ""}>${escapeHTML(p)}</option>
        `).join("")}
    `;
  }
  function inicializarFiltros() {
    const searchInput = document.getElementById("buscaRapida");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        uiFilters.search = e.target.value;
        renderizarQuadro();
      });
    }
    const filtroProjeto = document.getElementById("filtroProjeto");
    if (filtroProjeto) {
      filtroProjeto.addEventListener("change", (e) => {
        uiFilters.project = e.target.value;
        renderizarQuadro();
      });
    }
    const filtroPrioridade = document.getElementById("filtroPrioridade");
    if (filtroPrioridade) {
      filtroPrioridade.addEventListener("change", (e) => {
        uiFilters.priority = e.target.value;
        renderizarQuadro();
      });
    }
  }
  function abrirModalAtalhos() {
    const modal = document.getElementById("modalAtalhosTeclado");
    if (modal) modal.showModal();
  }
  function fecharModalAtalhos() {
    const modal = document.getElementById("modalAtalhosTeclado");
    if (modal) modal.close();
  }
  function inicializarEventosModais() {
    const modais = document.querySelectorAll("dialog");
    modais.forEach((modal) => {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) modal.close();
      });
    });
  }
  function elementoEhInput(el) {
    if (!el) return false;
    const tag = el.tagName ? el.tagName.toLowerCase() : "";
    return tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable;
  }
  function inicializarAtalhosTeclado() {
    window.addEventListener("keydown", (e) => {
      if (elementoEhInput(document.activeElement)) {
        if (e.key === "Escape") document.activeElement.blur();
        return;
      }
      if (e.key === "Escape") {
        const modalAberto = document.querySelector("dialog[open]");
        if (modalAberto) {
          modalAberto.close();
          return;
        }
        if (obterColunaExpandidaAtiva()) {
          recolherColunaExpandida();
          return;
        }
        return;
      }
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        const btn = document.querySelector('button[onclick*="abrirModalTarefa"]');
        if (btn) btn.click();
      } else if (e.key === "/") {
        e.preventDefault();
        const busca = document.getElementById("buscaRapida");
        if (busca) {
          busca.focus();
          busca.select();
        }
      } else if (e.key === "1") {
        e.preventDefault();
        mudarAba("view-quadro");
      } else if (e.key === "2") {
        e.preventDefault();
        mudarAba("view-sprints");
      } else if (e.key === "3") {
        e.preventDefault();
        mudarAba("view-historico");
      } else if (e.key === "4") {
        e.preventDefault();
        mudarAba("view-config");
      } else if (["5", "6", "7", "8", "9"].includes(e.key)) {
        e.preventDefault();
        const colunasMap = { "5": "backlog", "6": "todo", "7": "progress", "8": "testing", "9": "done" };
        const colTarget = colunasMap[e.key];
        if (colTarget) {
          if (window.obterColunaExpandidaAtiva && window.obterColunaExpandidaAtiva() === colTarget) {
            window.recolherColunaExpandida();
          } else if (window.expandirColuna) {
            window.expandirColuna(colTarget);
          }
        }
      } else if (e.key === "[") {
        e.preventDefault();
        toggleBarraLateral();
      } else if (e.key === "d" || e.key === "D") {
        e.preventDefault();
        toggleTemaDark();
      } else if (e.key === "?") {
        e.preventDefault();
        abrirModalAtalhos();
      }
    });
  }

  // js/storage.js
  var STORAGE_KEY = "scrumban_pessoal_prod_store";
  var IDB_NAME = "scrumban_pessoal_db";
  var IDB_VERSION = 2;
  var IDB_STORE = "app_state";
  var IDB_STORE_IMAGES = "task_images";
  var idbConectado = false;
  function abrirIndexedDB() {
    return new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) {
        return reject(new Error("IndexedDB n\xE3o suportado neste ambiente"));
      }
      const request = window.indexedDB.open(IDB_NAME, IDB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
        if (!db.objectStoreNames.contains(IDB_STORE_IMAGES)) {
          db.createObjectStore(IDB_STORE_IMAGES);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  async function idbGet(key, storeName = IDB_STORE) {
    const db = await abrirIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function idbSet(key, value, storeName = IDB_STORE) {
    const db = await abrirIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const req = store.put(value, key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function idbDelete(key, storeName = IDB_STORE) {
    const db = await abrirIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function salvarImagemIndexedDB(imageId, dataUrl) {
    try {
      await idbSet(imageId, dataUrl, IDB_STORE_IMAGES);
      return imageId;
    } catch (e) {
      console.error("Erro ao salvar imagem no IndexedDB:", e);
      throw e;
    }
  }
  async function obterImagemIndexedDB(imageId) {
    try {
      return await idbGet(imageId, IDB_STORE_IMAGES);
    } catch (e) {
      console.error("Erro ao obter imagem do IndexedDB:", e);
      return null;
    }
  }
  async function excluirImagemIndexedDB(imageId) {
    try {
      await idbDelete(imageId, IDB_STORE_IMAGES);
    } catch (e) {
      console.error("Erro ao remover imagem do IndexedDB:", e);
    }
  }
  async function inicializarArmazenamento() {
    try {
      let dados = await idbGet("current_state");
      idbConectado = true;
      if (!dados) {
        const rawLocal = localStorage.getItem(STORAGE_KEY);
        if (rawLocal) {
          try {
            const parsed = JSON.parse(rawLocal);
            if (parsed && typeof parsed === "object") {
              dados = parsed;
              await idbSet("current_state", dados);
              console.info("Scrumban: Dados migrados com sucesso do localStorage para o IndexedDB.");
            }
          } catch (eMig) {
            console.warn("Erro ao migrar dados legados do localStorage:", eMig);
          }
        }
      }
      if (dados && typeof dados === "object") {
        setAppState({
          settings: { ...DEFAULT_STATE.settings, ...dados.settings || {} },
          sprints: Array.isArray(dados.sprints) ? dados.sprints : [],
          tasks: Array.isArray(dados.tasks) ? dados.tasks : [],
          history: Array.isArray(dados.history) ? dados.history : []
        });
      } else {
        await idbSet("current_state", appState);
      }
    } catch (err) {
      console.warn("IndexedDB inacess\xEDvel, utilizando fallback localStorage:", err);
      idbConectado = false;
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          setAppState({
            settings: { ...DEFAULT_STATE.settings, ...parsed.settings || {} },
            sprints: Array.isArray(parsed.sprints) ? parsed.sprints : [],
            tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
            history: Array.isArray(parsed.history) ? parsed.history : []
          });
        }
      } catch (e2) {
        console.error("Fallback localStorage tamb\xE9m falhou:", e2);
      }
    }
    garantirOrdemTarefas();
  }
  async function saveState() {
    try {
      if (idbConectado) {
        await idbSet("current_state", appState);
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
      } catch (_) {
      }
    } catch (e) {
      console.error("Falha ao salvar dados:", e);
      mostrarToast("Erro ao salvar dados localmente. Verifique o espa\xE7o em disco do navegador.", "erro", 6e3);
    }
  }
  function atualizarIndicadorArmazenamento() {
    const label = document.getElementById("storage-type-label");
    const indicator = document.getElementById("storage-status-indicator");
    if (!label || !indicator) return;
    if (idbConectado) {
      label.innerText = "IndexedDB Ativo";
      indicator.title = "Armazenamento ass\xEDncrono via IndexedDB (~GBs dispon\xEDveis)";
    } else {
      label.innerText = "LocalStorage (Fallback)";
      indicator.title = "Modo de compatibilidade localStorage (~5MB)";
    }
  }
  function verificarLembreteBackup() {
    const banner = document.getElementById("lembrete-backup-banner");
    const txt = document.getElementById("lembrete-backup-texto");
    const statusSidebar = document.getElementById("sidebar-backup-status");
    if (!banner) return;
    if (sessionStorage.getItem("scrumban_dismiss_backup_reminder")) {
      banner.classList.add("hidden");
      return;
    }
    const lastBackup = appState.settings.lastBackupDate;
    if (lastBackup) {
      const lastDate = new Date(lastBackup);
      const diffMs = Date.now() - lastDate.getTime();
      const dias = Math.floor(diffMs / (1e3 * 60 * 60 * 24));
      if (statusSidebar) {
        statusSidebar.innerText = `\xDAltimo backup: h\xE1 ${dias === 0 ? "pouco tempo" : dias === 1 ? "1 dia" : dias + " dias"}`;
      }
      if (dias >= 7) {
        if (txt) {
          txt.innerText = `J\xE1 faz ${dias} dias desde o seu \xFAltimo backup JSON. Mantenha seus dados seguros exportando uma c\xF3pia preventiva.`;
        }
        banner.classList.remove("hidden");
      } else {
        banner.classList.add("hidden");
      }
    } else {
      if (statusSidebar) {
        statusSidebar.innerText = "Nenhum backup exportado";
      }
      if (appState.tasks.length > 0 || appState.sprints.length > 0) {
        if (txt) {
          txt.innerText = "Voc\xEA ainda n\xE3o gerou um backup de seguran\xE7a. Recomendamos baixar uma c\xF3pia preventiva dos seus dados.";
        }
        banner.classList.remove("hidden");
      } else {
        banner.classList.add("hidden");
      }
    }
  }
  function dispensarLembreteBackup() {
    sessionStorage.setItem("scrumban_dismiss_backup_reminder", "true");
    const banner = document.getElementById("lembrete-backup-banner");
    if (banner) banner.classList.add("hidden");
  }
  function executarBackupComLembrete() {
    exportarBackupJSON();
    dispensarLembreteBackup();
  }
  function validarSchemaBackup(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return { valido: false, erro: "O arquivo n\xE3o cont\xE9m um objeto JSON v\xE1lido." };
    }
    if (!data.settings || typeof data.settings !== "object" || Array.isArray(data.settings)) {
      return { valido: false, erro: 'Campo "settings" ausente ou com formato incorreto.' };
    }
    const wip = data.settings.wipLimit;
    if (typeof wip !== "number" || isNaN(wip) || wip < 0) {
      return { valido: false, erro: "O limite de WIP (settings.wipLimit) deve ser um n\xFAmero maior ou igual a zero." };
    }
    if (data.settings.replenishmentLimit !== void 0) {
      const rep = data.settings.replenishmentLimit;
      if (typeof rep !== "number" || isNaN(rep) || rep < 0) {
        return { valido: false, erro: "O limite de reabastecimento deve ser um n\xFAmero maior ou igual a zero." };
      }
    }
    if (!Array.isArray(data.settings.projects) || data.settings.projects.length === 0) {
      return { valido: false, erro: "A lista de projetos deve ser um array com pelo menos um projeto." };
    }
    if (!Array.isArray(data.sprints)) {
      return { valido: false, erro: 'O campo "sprints" deve ser uma lista (array).' };
    }
    const statusSprintsValidos = ["past", "current", "future"];
    for (let i = 0; i < data.sprints.length; i++) {
      const s = data.sprints[i];
      if (!s || typeof s !== "object") return { valido: false, erro: `A Sprint na posi\xE7\xE3o ${i + 1} \xE9 inv\xE1lida.` };
      if (!s.id || typeof s.id !== "string") return { valido: false, erro: `A Sprint na posi\xE7\xE3o ${i + 1} n\xE3o possui um ID v\xE1lido.` };
      if (!s.name || typeof s.name !== "string") return { valido: false, erro: `A Sprint na posi\xE7\xE3o ${i + 1} deve ter um nome v\xE1lido.` };
      if (s.status && !statusSprintsValidos.includes(s.status)) {
        return { valido: false, erro: `Status inv\xE1lido "${s.status}" na Sprint "${s.name}".` };
      }
    }
    if (!Array.isArray(data.tasks)) {
      return { valido: false, erro: 'O campo "tasks" deve ser uma lista (array).' };
    }
    const prioridadesValidas = ["alta", "media", "baixa"];
    const dificuldadesValidas = ["trivial", "facil", "media", "dificil", "muito_dificil"];
    for (let i = 0; i < data.tasks.length; i++) {
      const t = data.tasks[i];
      if (!t || typeof t !== "object") return { valido: false, erro: `A tarefa na posi\xE7\xE3o ${i + 1} \xE9 inv\xE1lida.` };
      if (!t.id || typeof t.id !== "string") return { valido: false, erro: `A tarefa na posi\xE7\xE3o ${i + 1} sem ID v\xE1lido.` };
      if (!t.title || typeof t.title !== "string") return { valido: false, erro: `A tarefa na posi\xE7\xE3o ${i + 1} sem t\xEDtulo v\xE1lido.` };
      if (!COLUNAS.includes(t.column)) return { valido: false, erro: `Coluna desconhecida "${t.column}".` };
      if (t.priority && !prioridadesValidas.includes(t.priority)) return { valido: false, erro: `Prioridade inv\xE1lida "${t.priority}".` };
      if (t.difficulty && !dificuldadesValidas.includes(t.difficulty)) return { valido: false, erro: `Dificuldade inv\xE1lida "${t.difficulty}".` };
    }
    if (!Array.isArray(data.history)) {
      return { valido: false, erro: 'O campo "history" deve ser uma lista (array).' };
    }
    for (let i = 0; i < data.history.length; i++) {
      const h = data.history[i];
      if (!h || typeof h !== "object" || !h.id || !h.sprintName) {
        return { valido: false, erro: `Registro de hist\xF3rico na posi\xE7\xE3o ${i + 1} inv\xE1lido.` };
      }
    }
    return { valido: true };
  }
  function exportarBackupJSON() {
    try {
      appState.settings.lastBackupDate = (/* @__PURE__ */ new Date()).toISOString();
      saveState();
      verificarLembreteBackup();
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState, null, 2));
      const dlAnchorElem = document.createElement("a");
      dlAnchorElem.setAttribute("href", dataStr);
      dlAnchorElem.setAttribute("download", `scrumban_backup_${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.json`);
      dlAnchorElem.click();
      mostrarToast("Backup exportado com sucesso! Arquivo JSON baixado.", "sucesso");
    } catch (err) {
      console.error("Erro ao exportar backup:", err);
      mostrarToast("Erro ao gerar arquivo de backup: " + err.message, "erro");
    }
  }
  function importarBackupJSON(event, onSucessoCallback) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(e) {
      try {
        const imported = JSON.parse(e.target.result);
        const validacao = validarSchemaBackup(imported);
        if (!validacao.valido) {
          mostrarToast(`Falha na valida\xE7\xE3o do backup: ${validacao.erro}`, "erro", 6500);
          event.target.value = "";
          return;
        }
        setAppState({
          settings: { ...DEFAULT_STATE.settings, ...imported.settings },
          sprints: imported.sprints,
          tasks: imported.tasks,
          history: imported.history
        });
        garantirOrdemTarefas();
        await saveState();
        mostrarToast("Backup restaurado com sucesso! Dados sincronizados no IndexedDB.", "sucesso");
        event.target.value = "";
        if (typeof onSucessoCallback === "function") {
          onSucessoCallback();
        }
        verificarLembreteBackup();
      } catch (err) {
        console.error("Erro ao importar backup:", err);
        mostrarToast("Erro ao ler arquivo JSON: " + err.message, "erro", 6e3);
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  }
  function abrirModalLimparDados() {
    const modal = document.getElementById("modalLimparDados");
    if (!modal) return;
    const tarefasCount = Array.isArray(appState.tasks) ? appState.tasks.length : 0;
    const sprintsCount = Array.isArray(appState.sprints) ? appState.sprints.length : 0;
    const histCount = Array.isArray(appState.history) ? appState.history.length : 0;
    const elTarefas = document.getElementById("limpar-total-tarefas");
    const elSprints = document.getElementById("limpar-total-sprints");
    const elHist = document.getElementById("limpar-total-historico");
    if (elTarefas) elTarefas.innerText = tarefasCount;
    if (elSprints) elSprints.innerText = sprintsCount;
    if (elHist) elHist.innerText = histCount;
    const check = document.getElementById("checkConfirmarLimpeza");
    const input = document.getElementById("inputConfirmarLimpeza");
    const btn = document.getElementById("btnConfirmarExclusaoTotal");
    if (check) check.checked = false;
    if (input) input.value = "";
    if (btn) btn.disabled = true;
    modal.showModal();
  }
  function fecharModalLimparDados() {
    const modal = document.getElementById("modalLimparDados");
    if (modal) modal.close();
  }
  function verificarConfirmacaoLimparDados() {
    const check = document.getElementById("checkConfirmarLimpeza");
    const input = document.getElementById("inputConfirmarLimpeza");
    const btn = document.getElementById("btnConfirmarExclusaoTotal");
    const aceitou = check ? check.checked : false;
    const digitouCorreto = input ? input.value.trim().toUpperCase() === "RESETAR" : false;
    if (btn) {
      btn.disabled = !(aceitou && digitouCorreto);
    }
  }
  async function executarLimpezaTotalDados() {
    const check = document.getElementById("checkConfirmarLimpeza");
    const input = document.getElementById("inputConfirmarLimpeza");
    const aceitou = check ? check.checked : false;
    const digitouCorreto = input ? input.value.trim().toUpperCase() === "RESETAR" : false;
    if (!aceitou || !digitouCorreto) {
      mostrarToast("Por favor, confirme a ci\xEAncia e digite RESETAR para continuar.", "erro");
      return;
    }
    try {
      setAppState(JSON.parse(JSON.stringify(DEFAULT_STATE)));
      await saveState();
      try {
        sessionStorage.removeItem("scrumban_dismiss_backup_reminder");
      } catch (_) {
      }
      fecharModalLimparDados();
      mostrarToast("Todos os dados foram resetados com sucesso para o estado inicial.", "info", 3e3);
      setTimeout(() => {
        location.reload();
      }, 400);
    } catch (err) {
      console.error("Erro ao resetar dados:", err);
      mostrarToast("Erro ao resetar dados: " + (err.message || err), "erro");
    }
  }
  async function restaurarDadosPadrao() {
    abrirModalLimparDados();
  }

  // js/main.js
  var globalBindings = {
    appState,
    uiFilters,
    mudarAba,
    toggleBarraLateral,
    toggleMobileMenu,
    fecharMobileMenu,
    toggleTemaDark,
    definirTema,
    abrirModalAtalhos,
    fecharModalAtalhos,
    abrirModalTarefa,
    fecharModalTarefa,
    salvarTarefaForm,
    excluirTarefaAtual,
    adicionarSubtask,
    alternarSubtask,
    removerSubtask,
    processarUploadImagemTarefa,
    removerImagemEdicao,
    atualizarRelacaoImagemEdicao,
    abrirModalDetalhes,
    fecharModalDetalhes,
    editarTarefaDeDetalhes,
    excluirTarefaDeDetalhes,
    alternarSubtaskDeDetalhes,
    criarNovaSubtarefaDireta,
    abrirVincularSubtarefaExistente,
    fecharVincularSubtarefaExistente,
    confirmarVincularSubtarefaExistente,
    desvincularTarefaFilha,
    abrirModalVisualizarImagem,
    fecharModalVisualizarImagem,
    abrirModalConcluirSprint,
    fecharModalConcluirSprint,
    confirmarFechamentoSprint,
    abrirModalEditarNotasSprint,
    fecharModalEditarNotasSprint,
    salvarNotasSprintHistorico,
    reabrirSprintHistorico,
    excluirSprintHistorico,
    abrirModalEditarSprint,
    fecharModalEditarSprint,
    salvarEdicaoSprintForm,
    excluirSprintAtual,
    salvarNovaSprintForm,
    ativarSprintFutura,
    excluirSprintFutura,
    copiarMarkdownSprint,
    baixarCsvSprint,
    abrirModalInfoMetricas,
    fecharModalInfoMetricas,
    selecionarAbaMetricaInfo,
    salvarConfigWip,
    salvarConfigReplenishment,
    salvarConfigSubtasksVisibilidade,
    adicionarProjetoConfig,
    removerProjetoConfig,
    exportarBackupJSON,
    importarBackupJSON: (e) => importarBackupJSON(e, () => {
      atualizarFiltrosUI();
      renderizarQuadro();
      renderizarAbaSprints2();
      renderizarAbaHistorico();
      renderizarAbaConfig();
    }),
    restaurarDadosPadrao,
    abrirModalLimparDados,
    fecharModalLimparDados,
    verificarConfirmacaoLimparDados,
    executarLimpezaTotalDados,
    executarBackupComLembrete,
    dispensarLembreteBackup,
    alternarFiltroOverdue,
    moverColunaRapido,
    selecionarColunaMobile,
    desfazerExclusaoTarefa,
    expandirColuna,
    recolherColunaExpandida,
    toggleExpandirColuna,
    expandirColunaVizinha,
    obterColunaExpandidaAtiva
  };
  Object.entries(globalBindings).forEach(([nome, fn]) => {
    window[nome] = fn;
  });
  async function bootstrapApp() {
    inicializarBarraLateral();
    inicializarTemaDark();
    await inicializarArmazenamento();
    atualizarIndicadorArmazenamento();
    inicializarColunasDrop();
    inicializarEventosModais();
    inicializarAtalhosTeclado();
    atualizarFiltrosUI();
    inicializarFiltros();
    renderizarQuadro();
    verificarLembreteBackup();
  }
  window.bootstrapApp = bootstrapApp;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrapApp);
  } else {
    bootstrapApp();
  }
})();
