/**
 * Scrumban Pessoal - Planejamento e Ciclos de Sprint
 * Modulo ES: Cabeçalho com ciclo atual/passado/futuro e tela de planejamento de sprints.
 */

import { appState, gerarId, formatarData, formatarDataCurta, escapeHTML } from './state.js';
import { saveState } from './storage.js';
import { mostrarToast } from './ui.js';
import { renderizarQuadro } from './kanban.js';

/**
 * Calcula o progresso ponderado da sprint ativa, considerando:
 * - Tarefas folha comprometidas (fora do backlog)
 * - Progresso fracionado de itens de checklist concluídos
 * - Tarefas filhas (evitando dupla contagem de tarefas pai que possuem filhas ativas)
 */
export function calcularProgressoSprint() {
    // Tarefas comprometidas no ciclo ativo (colunas TODO, Progress, Testing, Done)
    const tasksComprometidas = appState.tasks.filter(t => t.column !== 'backlog');

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

    // Identifica quais tarefas comprometidas são pais de outras tarefas também comprometidas
    const committedParentIds = new Set();
    tasksComprometidas.forEach(t => {
        if (t.parentId) {
            committedParentIds.add(t.parentId);
        }
    });

    // Tarefas executáveis (folhas): ou são tarefas autônomas sem filhas comprometidas, ou são tarefas filhas
    const tarefasExecutaveis = tasksComprometidas.filter(t => !committedParentIds.has(t.id));

    let progressoEquivalente = 0;
    let tarefasDone = 0;
    let totalChecklist = 0;
    let checklistDone = 0;
    let totalFilhas = 0;
    let filhasDone = 0;

    tarefasExecutaveis.forEach(t => {
        if (t.parentId) {
            totalFilhas++;
            if (t.column === 'done') filhasDone++;
        }

        const temChecklist = Array.isArray(t.subtasks) && t.subtasks.length > 0;
        let checklistScore = 0;
        if (temChecklist) {
            const stDone = t.subtasks.filter(s => s.done).length;
            const stTotal = t.subtasks.length;
            totalChecklist += stTotal;
            checklistDone += stDone;
            checklistScore = stDone / stTotal;
        }

        if (t.column === 'done') {
            tarefasDone++;
            progressoEquivalente += 1.0;
        } else {
            // Se não está em Done, mas tem checklist preenchido, conta a fração
            if (temChecklist && checklistScore > 0) {
                progressoEquivalente += checklistScore;
            }
        }
    });

    const totalTarefas = tarefasExecutaveis.length;
    const percentDone = totalTarefas > 0
        ? Math.min(100, Math.round((progressoEquivalente / totalTarefas) * 100))
        : 0;

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

export function renderizarHeaderSprints() {
    let pastSprint = null;
    if (appState.history && appState.history.length > 0) {
        const ultimoHist = appState.history[0];
        pastSprint = appState.sprints.find(s => s.status === 'past' && (s.id === ultimoHist.sprintId || s.name === ultimoHist.sprintName));
        if (!pastSprint) {
            pastSprint = { name: ultimoHist.sprintName, endDate: ultimoHist.endDate };
        }
    }
    if (!pastSprint) {
        const pastSprints = appState.sprints.filter(s => s.status === 'past');
        if (pastSprints.length > 0) {
            pastSprints.sort((a, b) => (b.endDate || '').localeCompare(a.endDate || ''));
            pastSprint = pastSprints[0];
        }
    }

    const curSprint = appState.sprints.find(s => s.status === 'current');
    const nextSprint = appState.sprints.find(s => s.status === 'future');

    // Header Sprint Passada
    const elPast = document.getElementById('header-sprint-past');
    if (elPast) {
        if (pastSprint) {
            elPast.innerHTML = `
                <p class="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-0.5 truncate">Passada</p>
                <h3 class="font-serif text-sm line-through text-gray-500 truncate" title="${escapeHTML(pastSprint.name)}">${escapeHTML(pastSprint.name)}</h3>
            `;
            elPast.classList.remove('hidden');
        } else {
            elPast.classList.add('hidden');
        }
    }

    // Header Sprint Atual
    const elCur = document.getElementById('header-sprint-current');
    if (elCur) {
        if (curSprint) {
            let diasRestantesTxt = '';
            if (curSprint.endDate) {
                diasRestantesTxt = `Termina em ${formatarDataCurta(curSprint.endDate)}`;
            }

            const progresso = calcularProgressoSprint();
            const concluidasStr = Number(progresso.progressoEquivalente.toFixed(1)).toString();
            const percentDone = progresso.percentDone;
            const totalSprint = progresso.totalTarefas;

            let tooltipProgresso = `Progresso da Sprint: ${concluidasStr} de ${totalSprint} tarefas equivalentes (${percentDone}%)`;
            if (progresso.tarefasDone > 0) tooltipProgresso += ` • ${progresso.tarefasDone} card(s) em Done`;
            if (progresso.totalChecklist > 0) tooltipProgresso += ` • ${progresso.checklistDone}/${progresso.totalChecklist} itens de checklist`;
            if (progresso.totalFilhas > 0) tooltipProgresso += ` • ${progresso.filhasDone}/${progresso.totalFilhas} sub-tarefas filhas`;

            elCur.innerHTML = `
                <div class="min-w-0 flex-1">
                    <p class="text-xs font-bold uppercase tracking-wider text-terracota mb-0.5 sm:mb-1 truncate">
                        Atual ${diasRestantesTxt ? '• ' + diasRestantesTxt : ''}
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

    // Header Sprint Futura
    const elNext = document.getElementById('header-sprint-next');
    if (elNext) {
        if (nextSprint) {
            elNext.innerHTML = `
                <p class="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-0.5 truncate">Próxima (${formatarDataCurta(nextSprint.startDate)})</p>
                <h3 class="font-serif text-sm text-gray-700 truncate" title="${escapeHTML(nextSprint.name)}">${escapeHTML(nextSprint.name)}</h3>
            `;
            elNext.classList.remove('hidden');
        } else {
            elNext.classList.add('hidden');
        }
    }
}

export function renderizarAbaSprints() {
    const container = document.getElementById('sprints-lista-conteudo');
    if (!container) return;

    const cur = appState.sprints.find(s => s.status === 'current');
    const future = appState.sprints.filter(s => s.status === 'future');

    container.innerHTML = '';
    const fragment = document.createDocumentFragment();

    // 1. Card da Sprint Atual
    const sprintAtualWrapper = document.createElement('div');
    sprintAtualWrapper.className = 'mb-8 p-6 bg-white border-2 border-terracota rounded-sm shadow-sm relative';
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
                    ${cur.description ? `<p class="sprint-descricao-box text-sm font-sans text-dark mt-2 mb-3 whitespace-pre-line p-3 rounded-sm leading-relaxed">${escapeHTML(cur.description)}</p>` : ''}
                    <p class="text-sm font-sans text-gray-600 mb-3">
                        Período: <strong class="text-dark">${formatarData(cur.startDate)}</strong> até <strong class="text-dark">${formatarData(cur.endDate)}</strong>
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

    // 2. Seção de Sprints Futuras
    const futureWrapper = document.createElement('div');
    futureWrapper.className = 'mb-8';

    const futureHeader = document.createElement('h3');
    futureHeader.className = 'font-serif text-xl font-bold text-dark mb-3 flex items-center gap-2';
    futureHeader.innerHTML = `
        <span>Próximas Sprints no Planejamento</span>
        <span class="text-xs font-mono font-normal bg-beige px-2 py-0.5 rounded-sm">${future.length}</span>
    `;
    futureWrapper.appendChild(futureHeader);

    if (future.length === 0) {
        const emptyMsg = document.createElement('p');
        emptyMsg.className = 'text-sm text-gray-400 font-serif italic bg-white p-4 border border-beige rounded-sm';
        emptyMsg.innerText = 'Nenhuma Sprint futura cadastrada na fila.';
        futureWrapper.appendChild(emptyMsg);
    } else {
        const listDiv = document.createElement('div');
        listDiv.className = 'space-y-3';
        future.forEach(s => {
            const item = document.createElement('div');
            item.className = 'p-4 bg-white border border-beige rounded-sm flex items-center justify-between gap-4 hover:border-gray-300 transition-colors';
            item.innerHTML = `
                <div class="min-w-0 flex-1">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-gray-400">Futura</span>
                    <h4 class="font-serif text-lg font-bold text-dark">${escapeHTML(s.name)}</h4>
                    ${s.description ? `<p class="text-xs font-sans text-gray-700 my-1 line-clamp-2">${escapeHTML(s.description)}</p>` : ''}
                    <p class="text-xs text-gray-500 font-sans">Previsão: ${formatarData(s.startDate)} até ${formatarData(s.endDate)}</p>
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

export function abrirModalEditarSprint(sprintId) {
    let sprint = null;
    if (sprintId) {
        sprint = appState.sprints.find(s => s.id === sprintId);
    } else {
        sprint = appState.sprints.find(s => s.status === 'current');
    }

    if (!sprint) {
        mostrarToast('Sprint não encontrada.', 'erro');
        return;
    }

    const idEl = document.getElementById('editar-sprint-id');
    const nomeEl = document.getElementById('editar-sprint-nome');
    const descEl = document.getElementById('editar-sprint-descricao');
    const iniEl = document.getElementById('editar-sprint-inicio');
    const fimEl = document.getElementById('editar-sprint-fim');

    if (idEl) idEl.value = sprint.id;
    if (nomeEl) nomeEl.value = sprint.name || '';
    if (descEl) descEl.value = sprint.description || '';
    if (iniEl) iniEl.value = sprint.startDate || '';
    if (fimEl) fimEl.value = sprint.endDate || '';

    const modal = document.getElementById('modalEditarSprint');
    if (modal) modal.showModal();
}

export function fecharModalEditarSprint() {
    const modal = document.getElementById('modalEditarSprint');
    if (modal) modal.close();
}

export function salvarEdicaoSprintForm(e) {
    if (e && e.preventDefault) e.preventDefault();

    const idEl = document.getElementById('editar-sprint-id');
    const nomeEl = document.getElementById('editar-sprint-nome');
    const descEl = document.getElementById('editar-sprint-descricao');
    const iniEl = document.getElementById('editar-sprint-inicio');
    const fimEl = document.getElementById('editar-sprint-fim');

    if (!idEl || !idEl.value) return;

    const sprint = appState.sprints.find(s => s.id === idEl.value);
    if (!sprint) {
        mostrarToast('Sprint não encontrada.', 'erro');
        return;
    }

    const nome = nomeEl ? nomeEl.value.trim() : '';
    const inicio = iniEl ? iniEl.value : '';
    const fim = fimEl ? fimEl.value : '';
    const desc = descEl ? descEl.value.trim() : '';

    if (!nome || !inicio || !fim) {
        mostrarToast('Preencha o nome e as datas de início e término.', 'erro');
        return;
    }

    sprint.name = nome;
    sprint.description = desc;
    sprint.startDate = inicio;
    sprint.endDate = fim;

    saveState();
    fecharModalEditarSprint();
    renderizarAbaSprints();
    renderizarHeaderSprints();
    renderizarQuadro();
    mostrarToast(`Sprint "${nome}" atualizada com sucesso!`, 'sucesso');
}

export function excluirSprintAtual() {
    const cur = appState.sprints.find(s => s.status === 'current');
    if (!cur) {
        mostrarToast('Nenhuma sprint ativa no momento.', 'info');
        return;
    }

    if (!confirm(`Tem certeza que deseja excluir a Sprint Atual "${cur.name}"?\n\nAs tarefas cadastradas no quadro serão mantidas, mas o ciclo atual será cancelado.`)) {
        return;
    }

    const nomeExcluido = cur.name;
    const sprintId = cur.id;

    // Desvincula referências à sprint nas tarefas ativas
    appState.tasks.forEach(t => {
        if (t.sprintId === sprintId) {
            t.sprintId = null;
        }
    });

    // Remove a sprint
    appState.sprints = appState.sprints.filter(s => s.id !== sprintId);

    saveState();
    renderizarAbaSprints();
    renderizarHeaderSprints();
    renderizarQuadro();
    mostrarToast(`Sprint "${nomeExcluido}" foi excluída com sucesso.`, 'sucesso');
}

export function salvarNovaSprintForm(e) {
    if (e && e.preventDefault) e.preventDefault();
    const nome = document.getElementById('sprintNome').value.trim();
    const descricao = document.getElementById('sprintDescricao')?.value.trim() || '';
    const inicio = document.getElementById('sprintInicio').value;
    const fim = document.getElementById('sprintFim').value;

    if (!nome || !inicio || !fim) {
        mostrarToast('Preencha o nome, data de início e data de término da Sprint.', 'erro');
        return;
    }

    const temAtual = appState.sprints.some(s => s.status === 'current');
    const novaSprint = {
        id: gerarId('sprint'),
        name: nome,
        description: descricao,
        startDate: inicio,
        endDate: fim,
        status: temAtual ? 'future' : 'current'
    };

    appState.sprints.push(novaSprint);
    saveState();

    document.getElementById('sprintNome').value = '';
    const descEl = document.getElementById('sprintDescricao');
    if (descEl) descEl.value = '';
    document.getElementById('sprintInicio').value = '';
    document.getElementById('sprintFim').value = '';

    renderizarAbaSprints();
    renderizarHeaderSprints();
    mostrarToast(`Sprint "${nome}" adicionada com sucesso como ${novaSprint.status === 'current' ? 'Atual' : 'Futura'}!`, 'sucesso');
}

export function ativarSprintFutura(sprintId) {
    if (!confirm('Deseja definir esta Sprint como a Sprint Atual?')) return;

    appState.sprints.forEach(s => {
        if (s.id === sprintId) s.status = 'current';
        else if (s.status === 'current') s.status = 'future';
    });

    saveState();
    renderizarAbaSprints();
    renderizarQuadro();
    mostrarToast('Sprint ativada como atual no Quadro!', 'sucesso');
}

export function excluirSprintFutura(sprintId) {
    if (!confirm('Deseja remover esta Sprint planejada?')) return;
    appState.sprints = appState.sprints.filter(s => s.id !== sprintId);
    saveState();
    renderizarAbaSprints();
    renderizarHeaderSprints();
    mostrarToast('Sprint planejada removida.', 'info');
}
