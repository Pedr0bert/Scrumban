/**
 * Scrumban Pessoal - Quadro Kanban
 * Modulo ES: Renderização de colunas, ordenação vertical, limites WIP e layout mobile por abas.
 */

import { COLUNAS, PRIORIDADE_CONFIG, DIFICULDADE_CONFIG, appState, uiFilters, formatarDataCurta, escapeHTML, calcularStatusPrazo, tarefaCorrespondeFiltros, tarefaVisivelNoQuadro } from './state.js';
import { saveState } from './storage.js';
import { mostrarToast } from './ui.js';
import { renderizarHeaderSprints } from './sprints.js';
import { abrirModalDetalhes } from './task-details.js';
import { vincularEventosDrag, vincularEventosTouch } from './drag-drop.js';

let colunaMobileAtiva = 'all';
let colunaExpandidaAtiva = null;

export function obterColunaMobileAtiva() {
    return colunaMobileAtiva;
}

export function obterColunaExpandidaAtiva() {
    return colunaExpandidaAtiva;
}

export function aplicarEstadoColunaExpandida() {
    const container = document.getElementById('kanban-columns-container');
    if (!container) return;

    if (!colunaExpandidaAtiva) {
        container.classList.remove('has-expanded-column');
        COLUNAS.forEach(col => {
            const sec = document.querySelector(`section[data-column="${col}"]`);
            if (sec) {
                sec.classList.remove('column-is-expanded', 'column-is-collapsed');
            }
            const colDiv = document.getElementById(`col-${col}`);
            if (colDiv) {
                colDiv.classList.remove('kanban-column-expanded-grid');
            }
        });
        return;
    }

    container.classList.add('has-expanded-column');
    COLUNAS.forEach(col => {
        const sec = document.querySelector(`section[data-column="${col}"]`);
        const colDiv = document.getElementById(`col-${col}`);
        if (col === colunaExpandidaAtiva) {
            if (sec) {
                sec.classList.add('column-is-expanded');
                sec.classList.remove('column-is-collapsed');
            }
            if (colDiv) {
                colDiv.classList.add('kanban-column-expanded-grid');
            }
        } else {
            if (sec) {
                sec.classList.remove('column-is-expanded');
                sec.classList.add('column-is-collapsed');
            }
            if (colDiv) {
                colDiv.classList.remove('kanban-column-expanded-grid');
            }
        }
    });
}

export function expandirColuna(coluna) {
    if (!COLUNAS.includes(coluna)) return;
    colunaExpandidaAtiva = coluna;
    aplicarEstadoColunaExpandida();
}

export function recolherColunaExpandida() {
    if (!colunaExpandidaAtiva) return;
    colunaExpandidaAtiva = null;
    aplicarEstadoColunaExpandida();
}

export function toggleExpandirColuna(coluna) {
    if (colunaExpandidaAtiva === coluna) {
        recolherColunaExpandida();
    } else {
        expandirColuna(coluna);
    }
}

export function expandirColunaVizinha(offset) {
    if (!colunaExpandidaAtiva) return;
    const curIdx = COLUNAS.indexOf(colunaExpandidaAtiva);
    const nextIdx = (curIdx + offset + COLUNAS.length) % COLUNAS.length;
    expandirColuna(COLUNAS[nextIdx]);
}

export function selecionarColunaMobile(coluna) {
    colunaMobileAtiva = coluna;

    document.querySelectorAll('.mobile-col-btn').forEach(btn => {
        const col = btn.dataset ? btn.dataset.mobileCol : btn.getAttribute('data-mobile-col');
        if (col === coluna) {
            btn.classList.add('active', 'bg-dark', 'text-white', 'border-dark');
            btn.classList.remove('bg-white', 'text-dark', 'border-beige');
        } else {
            btn.classList.remove('active', 'bg-dark', 'text-white', 'border-dark');
            btn.classList.add('bg-white', 'text-dark', 'border-beige');
        }
    });

    const colunasElements = document.querySelectorAll('#kanban-columns-container > section');
    colunasElements.forEach(sec => {
        const secCol = sec.dataset ? sec.dataset.column : sec.getAttribute('data-column');
        if (coluna === 'all' || secCol === coluna) {
            sec.classList.remove('mobile-hidden-col');
        } else {
            sec.classList.add('mobile-hidden-col');
        }
    });

    const container = document.getElementById('kanban-columns-container');
    if (container) {
        if (coluna === 'all') {
            container.classList.add('min-w-[1050px]');
            container.classList.remove('w-full');
        } else {
            container.classList.remove('min-w-[1050px]');
            container.classList.add('w-full');
        }
    }
}

export function atualizarWipBadge(dispararAlerta = false) {
    const inProgressCount = appState.tasks.filter(t => t.column === 'progress' && tarefaVisivelNoQuadro(t)).length;
    const wipLimit = appState.settings.wipLimit;
    const wipBadge = document.getElementById('wip-badge');
    const colProgress = document.getElementById('col-progress');
    const sectionProgress = colProgress ? colProgress.closest('section') : null;
    const isExceeded = wipLimit > 0 && inProgressCount > wipLimit;
    
    if (wipBadge) {
        if (isExceeded) {
            wipBadge.className = 'text-xs font-bold bg-terracota text-white px-2.5 py-1 rounded-sm animate-pulse';
            wipBadge.innerText = `WIP Excedido: ${inProgressCount}/${wipLimit}`;
        } else if (wipLimit > 0) {
            wipBadge.className = 'text-xs font-bold bg-beige text-dark px-2.5 py-1 rounded-sm';
            wipBadge.innerText = `WIP: ${inProgressCount}/${wipLimit}`;
        } else {
            wipBadge.className = 'text-xs font-bold bg-beige text-dark px-2.5 py-1 rounded-sm';
            wipBadge.innerText = `WIP: ${inProgressCount}`;
        }
    }

    if (sectionProgress) {
        if (isExceeded) sectionProgress.classList.add('column-wip-exceeded');
        else sectionProgress.classList.remove('column-wip-exceeded');
    }

    if (isExceeded && dispararAlerta) {
        mostrarToast(`Limite WIP violado (${inProgressCount}/${wipLimit})! Conclua tarefas em andamento antes de puxar mais itens.`, 'erro', 6000);
    }
}

export function atualizarOverdueBadge() {
    const totalAtrasadas = appState.tasks.filter(t => {
        if (t.column === 'done') return false;
        if (!tarefaVisivelNoQuadro(t)) return false;
        return calcularStatusPrazo(t.dueDate, false).status === 'overdue';
    }).length;

    const btnOverdue = document.getElementById('btnFiltroOverdue');
    const txtOverdue = document.getElementById('txtFiltroOverdue');
    if (btnOverdue && txtOverdue) {
        txtOverdue.innerText = `${totalAtrasadas} Atrasada${totalAtrasadas === 1 ? '' : 's'}`;
        if (uiFilters.onlyOverdue) {
            btnOverdue.className = 'px-2.5 py-1.5 rounded-sm border text-xs font-serif font-bold transition-all flex items-center gap-1.5 shadow-xs bg-terracota text-white border-terracota';
        } else if (totalAtrasadas > 0) {
            btnOverdue.className = 'px-2.5 py-1.5 rounded-sm border text-xs font-serif font-semibold transition-all flex items-center gap-1.5 shadow-xs bg-red-50 text-terracota border-terracota/40 hover:bg-terracota hover:text-white';
        } else {
            btnOverdue.className = 'px-2.5 py-1.5 rounded-sm border text-xs font-serif text-gray-500 border-beige bg-white hover:bg-offwhite flex items-center gap-1.5';
        }
    }
}

export function verificarPontoReabastecimento() {
    const todoCount = appState.tasks.filter(t => t.column === 'todo' && tarefaVisivelNoQuadro(t)).length;
    const backlogCount = appState.tasks.filter(t => t.column === 'backlog' && tarefaVisivelNoQuadro(t)).length;
    const limit = typeof appState.settings.replenishmentLimit === 'number' ? appState.settings.replenishmentLimit : 2;
    const banner = document.getElementById('alerta-reabastecimento');
    if (!banner) return;

    if (todoCount <= limit && backlogCount > 0) banner.classList.remove('hidden');
    else banner.classList.add('hidden');
}

export function atualizarContadoresColunas(colunas = COLUNAS) {
    colunas.forEach(col => {
        const count = appState.tasks.filter(t => t.column === col && tarefaVisivelNoQuadro(t)).length;
        const countBadge = document.getElementById(`count-${col}`);
        if (countBadge) countBadge.innerText = count;
        const countBadgeCollapsed = document.getElementById(`count-${col}-collapsed`);
        if (countBadgeCollapsed) countBadgeCollapsed.innerText = count;
        const mobileBadge = document.getElementById(`mcount-${col}`);
        if (mobileBadge) mobileBadge.innerText = count;
    });
    verificarPontoReabastecimento();
}

export function criarElementoPlaceholderVazio(col) {
    const emptyEl = document.createElement('div');
    emptyEl.className = 'empty-column-placeholder p-4 text-center text-xs font-serif text-gray-400 italic border border-dashed border-beige rounded-sm my-auto';
    emptyEl.innerText = uiFilters.onlyOverdue ? 'Nenhuma tarefa atrasada' : (uiFilters.search ? 'Nenhum item com este filtro' : 'Nenhuma tarefa');
    return emptyEl;
}

export function verificarPlaceholderColuna(col) {
    const container = document.getElementById(`col-${col}`);
    if (!container) return;
    const cards = container.querySelectorAll('.card-item');
    const placeholder = container.querySelector('.empty-column-placeholder');

    if (cards.length === 0 && !placeholder) {
        container.appendChild(criarElementoPlaceholderVazio(col));
    } else if (cards.length > 0 && placeholder) {
        placeholder.remove();
    }
}

export function atualizarConteudoCard(cardEl, tarefa) {
    const isDone = tarefa.column === 'done';
    const prioridade = PRIORIDADE_CONFIG[tarefa.priority] || PRIORIDADE_CONFIG.media;
    const statusPrazo = calcularStatusPrazo(tarefa.dueDate, isDone);
    const isOverdue = statusPrazo.status === 'overdue' && !isDone;
    const isDueToday = statusPrazo.status === 'today' && !isDone;

    // Subtasks simples (checklist)
    let subtaskBadge = '';
    if (tarefa.subtasks && tarefa.subtasks.length > 0) {
        const doneCount = tarefa.subtasks.filter(s => s.done).length;
        const total = tarefa.subtasks.length;
        subtaskBadge = `<span class="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded-sm ${doneCount === total ? 'bg-musgo/20 text-musgo font-semibold' : 'bg-gray-100 text-gray-600'}" title="Checklist: ${doneCount}/${total}">${doneCount}/${total}</span>`;
    }

    // Sub-cards (filhas completas)
    const filhas = appState.tasks.filter(t => t.parentId === tarefa.id);
    let subcardsBadge = '';
    if (filhas.length > 0) {
        const filhasDone = filhas.filter(f => f.column === 'done').length;
        const totalFilhas = filhas.length;
        const todasConcluidas = filhasDone === totalFilhas;
        subcardsBadge = `<span class="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded-sm ${todasConcluidas ? 'bg-musgo/20 text-musgo font-semibold border border-musgo/30' : 'bg-beige/90 text-dark border border-beige'}" title="Sub-tarefas: ${filhasDone}/${totalFilhas} concluídas">
            <svg class="w-2.5 h-2.5 text-dark/70 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M8 14h12M8 18h12"></path></svg>
            <span>${filhasDone}/${totalFilhas}</span>
        </span>`;
    }

    // Badge pai (se esta tarefa pertencer a outra)
    let parentBadge = '';
    if (tarefa.parentId) {
        const pai = appState.tasks.find(t => t.id === tarefa.parentId);
        if (pai) {
            parentBadge = `<span title="Subtarefa de: ${escapeHTML(pai.title)}" class="card-parent-badge text-[9px] font-medium text-amber-900 bg-amber-100/90 border border-amber-300/80 px-1.5 py-0.5 rounded-sm truncate max-w-[85px] whitespace-nowrap inline-flex items-center gap-0.5 shrink-0">
                <svg class="w-2.5 h-2.5 text-amber-700 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a4 4 0 014 4v4m0 0l-3-3m3 3l3-3"></path></svg>
                <span class="truncate">${escapeHTML(pai.title)}</span>
            </span>`;
        }
    }

    let dueBadge = '';
    if (tarefa.dueDate) {
        if (isOverdue) dueBadge = `<span class="inline-flex items-center gap-1 text-[10px] font-sans font-bold px-1.5 py-0.5 rounded-sm bg-red-50 text-terracota border border-terracota/40 animate-pulse">${statusPrazo.badgeText}</span>`;
        else if (isDueToday) dueBadge = `<span class="inline-flex items-center gap-1 text-[10px] font-sans font-bold px-1.5 py-0.5 rounded-sm bg-media/15 text-media border border-media/40">Hoje</span>`;
        else dueBadge = `<span class="inline-flex items-center gap-1 text-[10px] font-sans px-1.5 py-0.5 rounded-sm border text-gray-500 bg-gray-50/80 border-gray-200">${formatarDataCurta(tarefa.dueDate)}</span>`;
    }

    // Indicador de Dificuldade / Complexidade (Item 1: bolinha pequena)
    const difConfig = DIFICULDADE_CONFIG[tarefa.difficulty] || DIFICULDADE_CONFIG.media;
    const diffDot = `<span class="w-2.5 h-2.5 rounded-full ${difConfig.corDot} border ${difConfig.border} inline-block shrink-0 shadow-2xs" title="Dificuldade: ${difConfig.label}"></span>`;

    // Indicador de Imagens vinculadas ou anexadas (Item 4)
    const temImagens = Array.isArray(tarefa.images) && tarefa.images.length > 0;
    const imgBadge = temImagens ? `<span class="inline-flex items-center text-gray-500 hover:text-dark shrink-0" title="${tarefa.images.length} imagem(ns) vinculada(s)"><svg class="w-3 h-3 text-musgo" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg></span>` : '';

    cardEl.className = `card-item card-animate bg-white border border-beige p-2.5 rounded-sm cursor-pointer shadow-xs relative group h-[104px] min-h-[104px] max-h-[104px] flex flex-col justify-between ${isOverdue ? 'card-overdue' : ''} ${isDone ? 'opacity-55' : ''}`;
    cardEl.innerHTML = `
        <div class="flex items-center justify-between gap-1 h-5 shrink-0">
            <div class="flex items-center gap-1.5 min-w-0 overflow-hidden">
                ${diffDot}
                <span class="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full whitespace-nowrap ${prioridade.cor}">${tarefa.priority}</span>
                ${tarefa.project ? `<span class="text-[9px] font-medium text-gray-600 bg-beige/70 px-1.5 py-0.5 rounded-sm truncate max-w-[75px] whitespace-nowrap">${escapeHTML(tarefa.project)}</span>` : ''}
                ${parentBadge}
            </div>
            <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 md:opacity-0 max-md:opacity-100 transition-opacity shrink-0">
                <button onclick="event.stopPropagation(); moverColunaRapido('${tarefa.id}', -1)" title="Mover para coluna anterior" class="p-1 text-gray-400 hover:text-dark hover:bg-beige rounded-sm">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
                </button>
                <button onclick="event.stopPropagation(); moverColunaRapido('${tarefa.id}', 1)" title="Mover para próxima coluna" class="p-1 text-gray-400 hover:text-dark hover:bg-beige rounded-sm">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                </button>
            </div>
        </div>
        <div class="my-auto flex items-center min-h-[38px] max-h-[38px] overflow-hidden">
            <p class="font-serif text-[13.5px] leading-snug text-dark card-title-clamp ${isDone ? 'line-through text-gray-400' : 'font-semibold'}">${escapeHTML(tarefa.title)}</p>
        </div>
        <div class="flex items-center justify-between gap-1 pt-1 border-t border-beige/40 h-5 shrink-0">
            <div class="flex items-center gap-1 min-w-0 overflow-hidden flex-nowrap">${dueBadge}${subtaskBadge}${subcardsBadge}</div>
            <div class="flex items-center gap-1 shrink-0 ml-auto">
                ${imgBadge}
                ${tarefa.description ? `<span class="text-gray-400 shrink-0"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7"></path></svg></span>` : ''}
            </div>
        </div>
    `;
}

export function criarElementoCard(tarefa) {
    const card = document.createElement('div');
    card.id = `card-${tarefa.id}`;
    card.dataset.taskId = tarefa.id;
    card.draggable = true;

    atualizarConteudoCard(card, tarefa);
    card.addEventListener('click', () => abrirModalDetalhes(tarefa.id));
    vincularEventosDrag(card);
    vincularEventosTouch(card);

    return card;
}

export function moverCardNoDOM(tarefa, colunaAntiga, novaColuna) {
    if (novaColuna === 'progress' && !tarefa.startedAt) tarefa.startedAt = new Date().toISOString();
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
    renderizarHeaderSprints();
}

export function reordenarOuMoverTarefa(taskId, novaColuna, afterTaskId = null) {
    const tarefa = appState.tasks.find(t => t.id === taskId);
    if (!tarefa) return;

    const colunaAntiga = tarefa.column;
    const cardEl = document.getElementById(`card-${taskId}`);
    const targetContainer = document.getElementById(`col-${novaColuna}`);
    if (!targetContainer) return;

    const nextSibling = cardEl ? cardEl.nextElementSibling : null;
    const nextSiblingId = (nextSibling && nextSibling.classList.contains('card-item')) ? nextSibling.dataset.taskId : null;
    if (colunaAntiga === novaColuna && nextSiblingId === afterTaskId) return;

    const mudouColuna = colunaAntiga !== novaColuna;
    if (mudouColuna) {
        tarefa.column = novaColuna;
        if (novaColuna === 'progress' && !tarefa.startedAt) tarefa.startedAt = new Date().toISOString();
        if (novaColuna === 'done') tarefa.completedAt = new Date().toISOString();
        else if (colunaAntiga === 'done') delete tarefa.completedAt;
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

    const tasksNaDestino = appState.tasks.filter(t => t.column === novaColuna && t.id !== taskId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    if (afterTaskId) {
        const afterIdx = tasksNaDestino.findIndex(t => t.id === afterTaskId);
        if (afterIdx !== -1) tasksNaDestino.splice(afterIdx, 0, tarefa);
        else tasksNaDestino.push(tarefa);
    } else {
        tasksNaDestino.push(tarefa);
    }
    tasksNaDestino.forEach((t, idx) => { t.order = idx; });

    if (mudouColuna) {
        const tasksOrigem = appState.tasks.filter(t => t.column === colunaAntiga && t.id !== taskId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        tasksOrigem.forEach((t, idx) => { t.order = idx; });
        verificarPlaceholderColuna(colunaAntiga);

        if (tarefa.parentId) {
            const parentCardEl = document.getElementById(`card-${tarefa.parentId}`);
            if (parentCardEl) {
                const parentTask = appState.tasks.find(t => t.id === tarefa.parentId);
                if (parentTask) atualizarConteudoCard(parentCardEl, parentTask);
            }
        }
    }

    verificarPlaceholderColuna(novaColuna);
    saveState();
    atualizarContadoresColunas([colunaAntiga, novaColuna]);
    atualizarWipBadge(novaColuna === 'progress' && mudouColuna);
    atualizarOverdueBadge();
    renderizarHeaderSprints();
}

export function moverTarefaParaColuna(taskId, novaColuna) {
    reordenarOuMoverTarefa(taskId, novaColuna, null);
}

export function moverColunaRapido(taskId, direcao) {
    const tarefa = appState.tasks.find(t => t.id === taskId);
    if (!tarefa) return;
    const curIdx = COLUNAS.indexOf(tarefa.column);
    const newIdx = curIdx + direcao;
    if (newIdx >= 0 && newIdx < COLUNAS.length) {
        moverTarefaParaColuna(taskId, COLUNAS[newIdx]);
    }
}

export function alternarFiltroOverdue() {
    uiFilters.onlyOverdue = !uiFilters.onlyOverdue;
    renderizarQuadro();
}

export function renderizarQuadro() {
    renderizarHeaderSprints();
    atualizarWipBadge();
    atualizarOverdueBadge();
    verificarPontoReabastecimento();

    const fragments = {};
    COLUNAS.forEach(col => { fragments[col] = document.createDocumentFragment(); });

    const filtradas = appState.tasks.filter(tarefaCorrespondeFiltros).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    filtradas.forEach(tarefa => {
        if (fragments[tarefa.column]) fragments[tarefa.column].appendChild(criarElementoCard(tarefa));
    });

    COLUNAS.forEach(col => {
        const container = document.getElementById(`col-${col}`);
        if (!container) return;
        container.innerHTML = '';
        if (fragments[col].childNodes.length > 0) container.appendChild(fragments[col]);
        else container.appendChild(criarElementoPlaceholderVazio(col));
    });

    atualizarContadoresColunas();
    selecionarColunaMobile(colunaMobileAtiva);
    aplicarEstadoColunaExpandida();
}
