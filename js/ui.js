/**
 * Scrumban Pessoal - Interface do Usuário, Notificações e Navegação
 * Modulo ES: Toasts, Desfazer (Undo), Abas, Filtros e Atalhos de Teclado.
 */

import { appState, escapeHTML, uiFilters } from './state.js';
import { saveState } from './storage.js';
import { renderizarQuadro, verificarPlaceholderColuna, atualizarContadoresColunas, atualizarWipBadge, atualizarOverdueBadge, verificarPontoReabastecimento, atualizarConteudoCard, obterColunaExpandidaAtiva, recolherColunaExpandida } from './kanban.js';
import { renderizarHeaderSprints } from './sprints.js';
import { renderizarAbaSprints } from './sprints.js';
import { renderizarAbaHistorico } from './sprint-closure.js';
import { renderizarAbaConfig } from './config.js';
import { fecharModalDetalhes } from './task-details.js';
import { fecharModalTarefa } from './task-edit.js';
import { toggleBarraLateral, fecharMobileMenu } from './sidebar.js';
import { toggleTemaDark } from './theme.js';

let tarefaExcluidaPendente = null;
let timerUndoExclusao = null;

// ================= SISTEMA DE FEEDBACK VISUAL (TOASTS) =================

export function mostrarToast(mensagem, tipo = 'info', duracaoMs = 4500) {
    const container = document.getElementById('toast-container');
    if (!container) {
        console.log(`[Toast ${tipo}]: ${mensagem}`);
        return;
    }

    const toast = document.createElement('div');
    toast.className = 'toast-entry pointer-events-auto flex items-start gap-3 p-3.5 bg-white border rounded-sm shadow-md transition-all font-serif text-sm max-w-sm';

    let iconSvg = '';
    let borderClass = '';
    let title = '';

    if (tipo === 'sucesso') {
        borderClass = 'border-l-4 border-l-musgo border-beige text-dark';
        title = 'Sucesso';
        iconSvg = `<svg class="w-5 h-5 text-musgo shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
    } else if (tipo === 'erro') {
        borderClass = 'border-l-4 border-l-terracota border-beige text-dark';
        title = 'Atenção';
        iconSvg = `<svg class="w-5 h-5 text-terracota shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`;
    } else {
        borderClass = 'border-l-4 border-l-media border-beige text-dark';
        title = 'Informação';
        iconSvg = `<svg class="w-5 h-5 text-media shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
    }

    toast.className += ` ${borderClass}`;
    toast.innerHTML = `
        ${iconSvg}
        <div class="flex-1 min-w-0 pr-1">
            <p class="font-bold text-[13px] uppercase tracking-wider ${tipo === 'erro' ? 'text-terracota' : tipo === 'sucesso' ? 'text-musgo' : 'text-dark'}">${title}</p>
            <p class="text-xs text-gray-700 font-sans mt-0.5 leading-snug">${escapeHTML(mensagem)}</p>
        </div>
        <button type="button" class="text-gray-400 hover:text-dark p-0.5 text-xs font-sans shrink-0" aria-label="Fechar">&times;</button>
    `;

    const closeBtn = toast.querySelector('button');
    let timerId = null;

    const removerToast = () => {
        if (timerId) clearTimeout(timerId);
        toast.classList.remove('toast-entry');
        toast.classList.add('toast-exit');
        setTimeout(() => {
            if (toast.parentNode) toast.remove();
        }, 250);
    };

    closeBtn.addEventListener('click', removerToast);
    timerId = setTimeout(removerToast, duracaoMs);
    container.appendChild(toast);
}

export function mostrarToastComAcao(mensagem, textoAcao, callbackAcao, duracaoMs = 6000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast-entry pointer-events-auto flex items-center justify-between gap-3 p-3.5 bg-dark text-white border border-gray-700 rounded-sm shadow-xl font-serif text-sm max-w-md w-full';

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

    const undoBtn = toast.querySelector('.btn-undo-toast');
    const closeBtn = toast.querySelector('.btn-close-toast');
    let timerId = null;

    const removerToast = () => {
        if (timerId) clearTimeout(timerId);
        toast.classList.remove('toast-entry');
        toast.classList.add('toast-exit');
        setTimeout(() => {
            if (toast.parentNode) toast.remove();
        }, 250);
    };

    undoBtn.addEventListener('click', () => {
        removerToast();
        if (typeof callbackAcao === 'function') callbackAcao();
    });

    closeBtn.addEventListener('click', removerToast);
    timerId = setTimeout(removerToast, duracaoMs);
    container.appendChild(toast);
}

// Ação 2.4: Mecanismo de Exclusão Segura com Desfazer (Undo)
export function executarExclusaoComUndo(taskId) {
    const index = appState.tasks.findIndex(t => t.id === taskId);
    if (index === -1) return;

    const tarefaCopia = JSON.parse(JSON.stringify(appState.tasks[index]));
    const coluna = tarefaCopia.column;

    if (tarefaExcluidaPendente && timerUndoExclusao) {
        clearTimeout(timerUndoExclusao);
        tarefaExcluidaPendente = null;
    }

    // Desvincula filhas temporariamente guardando IDs para restaurar no Undo
    const filhasIds = appState.tasks.filter(t => t.parentId === taskId).map(t => t.id);
    appState.tasks.forEach(t => {
        if (t.parentId === taskId) t.parentId = null;
    });

    tarefaExcluidaPendente = { tarefa: tarefaCopia, indexOriginal: index, filhasIds };

    appState.tasks.splice(index, 1);
    saveState();

    const cardEl = document.getElementById(`card-${taskId}`);
    if (cardEl) cardEl.remove();

    if (tarefaCopia.parentId) {
        const parentCard = document.getElementById(`card-${tarefaCopia.parentId}`);
        const parentTask = appState.tasks.find(t => t.id === tarefaCopia.parentId);
        if (parentCard && parentTask) atualizarConteudoCard(parentCard, parentTask);
    }

    verificarPlaceholderColuna(coluna);
    atualizarContadoresColunas([coluna]);
    atualizarWipBadge();
    atualizarOverdueBadge();
    verificarPontoReabastecimento();
    renderizarHeaderSprints();

    fecharModalDetalhes();
    fecharModalTarefa();

    mostrarToastComAcao(`Tarefa "${tarefaCopia.title}" excluída.`, 'Desfazer', () => {
        desfazerExclusaoTarefa();
    }, 6000);

    timerUndoExclusao = setTimeout(() => {
        tarefaExcluidaPendente = null;
        timerUndoExclusao = null;
    }, 6000);
}

export function desfazerExclusaoTarefa() {
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
        appState.tasks.forEach(t => {
            if (filhasIds.includes(t.id)) t.parentId = tarefa.id;
        });
    }

    saveState();
    renderizarQuadro();
    mostrarToast(`Tarefa "${tarefa.title}" restaurada com sucesso!`, 'sucesso', 3500);
}

// ================= NAVEGAÇÃO DE ABAS =================

export function mudarAba(abaId) {
    fecharMobileMenu();

    document.querySelectorAll('.aba-content').forEach(el => {
        el.classList.add('hidden-tab');
        el.classList.remove('active-tab');
    });

    const abaAtiva = document.getElementById(abaId);
    if (abaAtiva) {
        abaAtiva.classList.remove('hidden-tab');
        abaAtiva.classList.add('active-tab');
    }

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('bg-beige', 'text-dark', 'font-semibold', 'shadow-xs');
        btn.classList.add('text-gray-600');
    });

    const idPrefixo = abaId.replace('view-', '');
    const btnAtivo = document.getElementById('btn-' + idPrefixo);
    if (btnAtivo) {
        btnAtivo.classList.remove('text-gray-600');
        btnAtivo.classList.add('bg-beige', 'text-dark', 'font-semibold');
    }

    if (abaId === 'view-quadro') renderizarQuadro();
    if (abaId === 'view-sprints') renderizarAbaSprints();
    if (abaId === 'view-historico') renderizarAbaHistorico();
    if (abaId === 'view-config') renderizarAbaConfig();
}

// ================= FILTROS & BUSCA RÁPIDA =================

export function atualizarFiltrosUI() {
    const select = document.getElementById('filtroProjeto');
    if (!select) return;

    const valorAtual = uiFilters.project;
    select.innerHTML = `
        <option value="all">Todos os Projetos</option>
        ${appState.settings.projects.map(p => `
            <option value="${escapeHTML(p)}" ${valorAtual === p ? 'selected' : ''}>${escapeHTML(p)}</option>
        `).join('')}
    `;
}

export function inicializarFiltros() {
    const searchInput = document.getElementById('buscaRapida');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            uiFilters.search = e.target.value;
            renderizarQuadro();
        });
    }

    const filtroProjeto = document.getElementById('filtroProjeto');
    if (filtroProjeto) {
        filtroProjeto.addEventListener('change', (e) => {
            uiFilters.project = e.target.value;
            renderizarQuadro();
        });
    }

    const filtroPrioridade = document.getElementById('filtroPrioridade');
    if (filtroPrioridade) {
        filtroPrioridade.addEventListener('change', (e) => {
            uiFilters.priority = e.target.value;
            renderizarQuadro();
        });
    }
}

// ================= MODAL ATALHOS & EVENTOS GLOBAIS =================

export function abrirModalAtalhos() {
    const modal = document.getElementById('modalAtalhosTeclado');
    if (modal) modal.showModal();
}

export function fecharModalAtalhos() {
    const modal = document.getElementById('modalAtalhosTeclado');
    if (modal) modal.close();
}

export function inicializarEventosModais() {
    const modais = document.querySelectorAll('dialog');
    modais.forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.close();
        });
    });
}

function elementoEhInput(el) {
    if (!el) return false;
    const tag = el.tagName ? el.tagName.toLowerCase() : '';
    return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
}

export function inicializarAtalhosTeclado() {
    window.addEventListener('keydown', (e) => {
        if (elementoEhInput(document.activeElement)) {
            if (e.key === 'Escape') document.activeElement.blur();
            return;
        }

        if (e.key === 'Escape') {
            const modalAberto = document.querySelector('dialog[open]');
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

        if (e.key === 'n' || e.key === 'N') {
            e.preventDefault();
            const btn = document.querySelector('button[onclick*="abrirModalTarefa"]');
            if (btn) btn.click();
        } else if (e.key === '/') {
            e.preventDefault();
            const busca = document.getElementById('buscaRapida');
            if (busca) { busca.focus(); busca.select(); }
        } else if (e.key === '1') {
            e.preventDefault();
            mudarAba('view-quadro');
        } else if (e.key === '2') {
            e.preventDefault();
            mudarAba('view-sprints');
        } else if (e.key === '3') {
            e.preventDefault();
            mudarAba('view-historico');
        } else if (e.key === '4') {
            e.preventDefault();
            mudarAba('view-config');
        } else if (['5', '6', '7', '8', '9'].includes(e.key)) {
            e.preventDefault();
            const colunasMap = { '5': 'backlog', '6': 'todo', '7': 'progress', '8': 'testing', '9': 'done' };
            const colTarget = colunasMap[e.key];
            if (colTarget) {
                if (window.obterColunaExpandidaAtiva && window.obterColunaExpandidaAtiva() === colTarget) {
                    window.recolherColunaExpandida();
                } else if (window.expandirColuna) {
                    window.expandirColuna(colTarget);
                }
            }
        } else if (e.key === '[') {
            e.preventDefault();
            toggleBarraLateral();
        } else if (e.key === 'd' || e.key === 'D') {
            e.preventDefault();
            toggleTemaDark();
        } else if (e.key === '?') {
            e.preventDefault();
            abrirModalAtalhos();
        }
    });
}
