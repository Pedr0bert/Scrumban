/**
 * Scrumban Pessoal - Fechamento de Sprints & Histórico de Entregas
 * Modulo ES: Modal de conclusão de sprint, arquivamento e renderização do histórico de entregas.
 */

import { appState, gerarId, formatarData, escapeHTML, PRIORIDADE_CONFIG, DIFICULDADE_CONFIG } from './state.js';
import { saveState } from './storage.js';
import { mostrarToast, mudarAba } from './ui.js';
import { renderizarQuadro } from './kanban.js';
import { renderizarPainelMetricasFluxo, copiarMarkdownSprint, baixarCsvSprint } from './metrics.js';

export function abrirModalConcluirSprint() {
    const cur = appState.sprints.find(s => s.status === 'current');
    if (!cur) {
        mostrarToast('Nenhuma sprint ativa no momento. Crie ou ative uma sprint na aba "Gerenciar Sprints".', 'info');
        return;
    }

    const tarefasDone = appState.tasks.filter(t => t.column === 'done');
    const tarefasPendentes = appState.tasks.filter(t => t.column !== 'done');

    const nomeEl = document.getElementById('concluir-sprint-nome');
    const doneEl = document.getElementById('concluir-sprint-done-count');
    const pendEl = document.getElementById('concluir-sprint-pending-count');
    const notesEl = document.getElementById('concluir-sprint-notes');

    if (nomeEl) nomeEl.innerText = cur.name;
    if (doneEl) doneEl.innerText = `${tarefasDone.length} tarefas entregues`;
    if (pendEl) pendEl.innerText = `${tarefasPendentes.length} tarefas não concluídas`;
    if (notesEl) notesEl.value = '';

    const modal = document.getElementById('modalConcluirSprint');
    if (modal) modal.showModal();
}

export function fecharModalConcluirSprint() {
    const modal = document.getElementById('modalConcluirSprint');
    if (modal) modal.close();
}

export function confirmarFechamentoSprint() {
    const cur = appState.sprints.find(s => s.status === 'current');
    if (!cur) return;

    const tarefasDone = appState.tasks.filter(t => t.column === 'done');
    const acaoPendentes = document.querySelector('input[name="acaoPendentes"]:checked')?.value || 'keep';
    const notesInput = document.getElementById('concluir-sprint-notes');
    const notes = notesInput ? notesInput.value.trim() : '';

    const registroHistorico = {
        id: gerarId('hist'),
        sprintId: cur.id,
        sprintName: cur.name,
        sprintDescription: cur.description || '',
        notes: notes,
        startDate: cur.startDate,
        endDate: cur.endDate,
        closedAt: new Date().toISOString(),
        tasksDelivered: tarefasDone.map(t => ({
            id: t.id,
            title: t.title,
            project: t.project,
            priority: t.priority,
            difficulty: t.difficulty || 'media',
            createdAt: t.createdAt || null,
            startedAt: t.startedAt || null,
            completedAt: t.completedAt || new Date().toISOString()
        }))
    };
    appState.history.unshift(registroHistorico);

    appState.tasks = appState.tasks.filter(t => t.column !== 'done');

    // Desvincula referências a tarefas pais que foram concluídas e arquivadas
    appState.tasks.forEach(t => {
        if (t.parentId && !appState.tasks.some(p => p.id === t.parentId)) {
            t.parentId = null;
        }
    });

    if (acaoPendentes === 'backlog') {
        appState.tasks.forEach(t => {
            if (t.column !== 'backlog') t.column = 'backlog';
        });
    }

    cur.status = 'past';

    const proxima = appState.sprints.find(s => s.status === 'future');
    if (proxima) {
        proxima.status = 'current';
    }

    saveState();
    fecharModalConcluirSprint();
    renderizarQuadro();
    mudarAba('view-historico');
    mostrarToast(`Sprint "${cur.name}" concluída e arquivada no histórico!`, 'sucesso');
}

export function abrirModalEditarNotasSprint(histId) {
    const hist = (appState.history || []).find(h => h.id === histId);
    if (!hist) {
        mostrarToast('Sprint não encontrada no histórico.', 'erro');
        return;
    }

    const idEl = document.getElementById('editar-notas-sprint-id');
    const nomeEl = document.getElementById('editar-notas-sprint-nome');
    const textoEl = document.getElementById('editar-notas-sprint-texto');

    if (idEl) idEl.value = hist.id;
    if (nomeEl) nomeEl.innerText = `Sprint: ${hist.sprintName}`;
    if (textoEl) textoEl.value = hist.notes || '';

    const modal = document.getElementById('modalEditarNotasSprint');
    if (modal) modal.showModal();
}

export function fecharModalEditarNotasSprint() {
    const modal = document.getElementById('modalEditarNotasSprint');
    if (modal) modal.close();
}

export function salvarNotasSprintHistorico() {
    const idEl = document.getElementById('editar-notas-sprint-id');
    const textoEl = document.getElementById('editar-notas-sprint-texto');
    if (!idEl || !idEl.value) return;

    const hist = (appState.history || []).find(h => h.id === idEl.value);
    if (!hist) {
        mostrarToast('Sprint não encontrada.', 'erro');
        return;
    }

    hist.notes = textoEl ? textoEl.value.trim() : '';
    saveState();
    fecharModalEditarNotasSprint();
    renderizarAbaHistorico();
    mostrarToast('Notas da sprint salvas com sucesso!', 'sucesso');
}

export function reabrirSprintHistorico(histId) {
    const hist = (appState.history || []).find(h => h.id === histId);
    if (!hist) {
        mostrarToast('Sprint não encontrada no histórico.', 'erro');
        return;
    }

    if (!confirm(`Deseja reabrir a sprint "${hist.sprintName}"?\n\nEla voltará a ser a Sprint Atual no Quadro e suas tarefas concluídas serão restauradas.`)) {
        return;
    }

    // Se houver uma sprint atual ativa, transforma-a em futura
    appState.sprints.forEach(s => {
        if (s.status === 'current') {
            s.status = 'future';
        }
    });

    // Reativa a sprint correspondente em appState.sprints
    let sprintExistente = appState.sprints.find(s => s.id === hist.sprintId);
    if (sprintExistente) {
        sprintExistente.status = 'current';
    } else {
        sprintExistente = {
            id: hist.sprintId || gerarId('sprint'),
            name: hist.sprintName,
            description: hist.sprintDescription || '',
            startDate: hist.startDate,
            endDate: hist.endDate,
            status: 'current'
        };
        appState.sprints.unshift(sprintExistente);
    }

    // Restaura tarefas entregues de volta ao quadro (coluna Done)
    if (Array.isArray(hist.tasksDelivered)) {
        hist.tasksDelivered.forEach(t => {
            const taskExistente = appState.tasks.find(x => x.id === t.id);
            if (taskExistente) {
                taskExistente.column = 'done';
                taskExistente.sprintId = sprintExistente.id;
            } else {
                appState.tasks.push({
                    id: t.id,
                    title: t.title,
                    description: '',
                    project: t.project || '',
                    priority: t.priority || 'media',
                    column: 'done',
                    sprintId: sprintExistente.id,
                    createdAt: t.createdAt || new Date().toISOString(),
                    startedAt: t.startedAt || null,
                    completedAt: t.completedAt || new Date().toISOString(),
                    subtasks: []
                });
            }
        });
    }

    // Remove do histórico
    appState.history = appState.history.filter(h => h.id !== histId);

    saveState();
    renderizarAbaHistorico();
    renderizarAbaSprints();
    renderizarHeaderSprints();
    renderizarQuadro();
    mudarAba('view-quadro');
    mostrarToast(`Sprint "${hist.sprintName}" reaberta com sucesso no Quadro!`, 'sucesso');
}

export function excluirSprintHistorico(histId) {
    const hist = (appState.history || []).find(h => h.id === histId);
    if (!hist) {
        mostrarToast('Sprint não encontrada no histórico.', 'erro');
        return;
    }

    if (!confirm(`Tem certeza que deseja excluir permanentemente o registro da sprint "${hist.sprintName}" do histórico?\n\nEsta ação não poderá ser desfeita.`)) {
        return;
    }

    appState.history = appState.history.filter(h => h.id !== histId);
    saveState();
    renderizarAbaHistorico();
    renderizarHeaderSprints();
    mostrarToast(`Registro da sprint "${hist.sprintName}" excluído do histórico.`, 'info');
}

export function renderizarAbaHistorico() {
    const container = document.getElementById('historico-lista-conteudo');
    if (!container) return;

    renderizarPainelMetricasFluxo();

    if (appState.history.length === 0) {
        container.innerHTML = `
            <div class="bg-white p-8 border border-beige rounded-sm text-center">
                <p class="font-serif text-lg text-gray-500 mb-2">Nenhuma sprint finalizada ainda.</p>
                <p class="text-xs text-gray-400">Assim que você concluir sua primeira Sprint no Quadro, ela aparecerá registrada aqui com todas as entregas.</p>
            </div>
        `;
        return;
    }

    const fragment = document.createDocumentFragment();

    appState.history.forEach(hist => {
        const dataConclusao = formatarData(hist.closedAt ? hist.closedAt.split('T')[0] : hist.endDate);
        const cardHist = document.createElement('div');
        cardHist.className = 'bg-white p-6 border border-beige rounded-sm shadow-xs transition-shadow hover:shadow-sm';

        let entregasHtml = '';
        if (hist.tasksDelivered && hist.tasksDelivered.length > 0) {
            entregasHtml = hist.tasksDelivered.map(t => {
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
                            ${t.project ? `<span class="text-[9px] bg-beige px-1.5 py-0.5 rounded-sm text-gray-600">${escapeHTML(t.project)}</span>` : ''}
                            <span class="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-sm ${prio.cor}">${t.priority}</span>
                            <span class="text-[9px] font-sans font-medium px-1.5 py-0.5 rounded-sm bg-beige/60 text-dark border border-beige/80">${dif.label}</span>
                        </div>
                    </li>
                `;
            }).join('');
        } else {
            entregasHtml = `<li class="text-xs text-gray-400 font-serif italic py-2">Nenhuma tarefa marcada como Done no fechamento deste ciclo.</li>`;
        }

        const notesBlock = hist.notes ? `
            <div class="mt-3 p-3 bg-offwhite border border-beige/80 rounded-sm">
                <div class="flex items-center gap-1.5 text-musgo mb-1">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                    <span class="text-[10px] font-bold uppercase tracking-wider">Notas de Fechamento & Observações</span>
                </div>
                <p class="text-sm font-sans text-dark whitespace-pre-line leading-relaxed">${escapeHTML(hist.notes)}</p>
            </div>
        ` : '';

        cardHist.innerHTML = `
            <div class="flex flex-col sm:flex-row sm:items-center justify-between border-b border-beige pb-4 mb-4 gap-2">
                <div>
                    <span class="text-[10px] font-bold uppercase tracking-wider text-musgo">Sprint Concluída</span>
                    <h3 class="font-serif text-2xl font-bold text-dark">${escapeHTML(hist.sprintName)}</h3>
                    ${hist.sprintDescription ? `<p class="sprint-descricao-box text-sm font-sans text-dark mt-2 mb-2 whitespace-pre-line p-3 rounded-sm leading-relaxed">${escapeHTML(hist.sprintDescription)}</p>` : ''}
                    ${notesBlock}
                    <p class="text-xs text-gray-500 font-sans mt-2">
                        Realizada de ${formatarData(hist.startDate)} a ${formatarData(hist.endDate)} • Fechada em ${dataConclusao}
                    </p>
                </div>
                <div class="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
                    <button onclick="reabrirSprintHistorico('${hist.id}')" class="px-2.5 py-1 text-xs font-sans font-medium border border-beige hover:border-dark/30 bg-offwhite hover:bg-beige text-dark rounded-sm flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer" title="Reabrir esta sprint e restaurá-la como ativa no Quadro">
                        <svg class="w-3.5 h-3.5 text-musgo shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                        </svg>
                        <span>Reabrir Sprint</span>
                    </button>
                    <button onclick="abrirModalEditarNotasSprint('${hist.id}')" class="px-2.5 py-1 text-xs font-sans font-medium border border-beige hover:border-dark/30 bg-offwhite hover:bg-beige text-dark rounded-sm flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer" title="Adicionar ou editar notas e observações desta sprint">
                        <svg class="w-3.5 h-3.5 text-gray-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                        </svg>
                        <span>${hist.notes ? 'Editar Notas' : 'Adicionar Nota'}</span>
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
                    <button onclick="excluirSprintHistorico('${hist.id}')" class="px-2 py-1 text-xs font-sans text-gray-400 hover:text-terracota rounded-sm flex items-center gap-1 transition-colors cursor-pointer" title="Excluir permanentemente este registro do histórico">
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

            <h4 class="font-serif text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Entregáveis Concluídos:</h4>
            <ul class="space-y-2">
                ${entregasHtml}
            </ul>
        `;

        fragment.appendChild(cardHist);
    });

    container.innerHTML = '';
    container.appendChild(fragment);
}
