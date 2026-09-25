/**
 * Scrumban Pessoal - Visualização de Detalhes da Tarefa
 * Modulo ES: Modal de inspeção detalhada da tarefa e checklist de subtarefas.
 */

import { appState, formatarData, escapeHTML, PRIORIDADE_CONFIG, DIFICULDADE_CONFIG, COLUNA_NOMES, calcularStatusPrazo, obterDescendentesIds } from './state.js';
import { saveState, obterImagemIndexedDB } from './storage.js';
import { executarExclusaoComUndo, mostrarToast } from './ui.js';
import { atualizarConteudoCard } from './kanban.js';
import { abrirModalTarefa } from './task-edit.js';
import { renderizarHeaderSprints } from './sprints.js';

const modalDetalhesTarefa = document.getElementById('modalDetalhesTarefa');
let tarefaVisualizadaId = null;

export function obterTarefaVisualizadaId() {
    return tarefaVisualizadaId;
}

export function abrirModalDetalhes(taskId) {
    const tarefa = appState.tasks.find(t => t.id === taskId);
    if (!tarefa) return;

    tarefaVisualizadaId = taskId;
    const isDone = tarefa.column === 'done';
    const prioridade = PRIORIDADE_CONFIG[tarefa.priority] || PRIORIDADE_CONFIG.media;
    const dificuldade = DIFICULDADE_CONFIG[tarefa.difficulty] || DIFICULDADE_CONFIG.media;
    const statusPrazo = calcularStatusPrazo(tarefa.dueDate, isDone);

    // Banner de Tarefa Pai (se esta for uma sub-tarefa)
    const elParentBanner = document.getElementById('detalhe-parent-banner');
    const elParentTitle = document.getElementById('detalhe-parent-title');
    const elParentBtn = document.getElementById('detalhe-parent-btn');

    if (elParentBanner) {
        if (tarefa.parentId) {
            const pai = appState.tasks.find(t => t.id === tarefa.parentId);
            if (pai) {
                if (elParentTitle) {
                    elParentTitle.innerText = pai.title;
                    elParentTitle.onclick = () => abrirModalDetalhes(pai.id);
                }
                if (elParentBtn) {
                    elParentBtn.onclick = () => abrirModalDetalhes(pai.id);
                }
                elParentBanner.classList.remove('hidden');
            } else {
                elParentBanner.classList.add('hidden');
            }
        } else {
            elParentBanner.classList.add('hidden');
        }
    }

    const elDificuldade = document.getElementById('detalhe-dificuldade');
    if (elDificuldade) {
        elDificuldade.className = `text-[12px] font-bold tracking-wider px-2.5 py-0.5 rounded-full flex items-center gap-1.5 bg-beige/80 text-dark border border-beige`;
        elDificuldade.innerHTML = `<span class="w-2.5 h-2.5 rounded-full ${dificuldade.corDot} border ${dificuldade.border} shrink-0"></span><span>${dificuldade.label}</span>`;
    }

    const elPrioridade = document.getElementById('detalhe-prioridade');
    if (elPrioridade) {
        elPrioridade.className = `text-[12px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${prioridade.cor}`;
        elPrioridade.innerText = prioridade.label;
    }

    const elProjeto = document.getElementById('detalhe-projeto');
    if (elProjeto) elProjeto.innerText = tarefa.project || 'Geral';

    const elColuna = document.getElementById('detalhe-coluna');
    if (elColuna) elColuna.innerText = COLUNA_NOMES[tarefa.column] || tarefa.column;

    const elAlertaPrazo = document.getElementById('detalhe-alerta-prazo');
    if (elAlertaPrazo) {
        if (statusPrazo.status === 'overdue' && !isDone) {
            elAlertaPrazo.className = 'rounded-sm p-2.5 bg-red-50 border border-terracota/40 text-terracota text-sm font-serif flex items-center gap-2';
            elAlertaPrazo.innerHTML = `
                <svg class="w-4 h-4 shrink-0 text-terracota" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                <div>
                    <strong class="font-bold">Atenção: Prazo Vencido!</strong>
                    <span>Esta tarefa está atrasada há <strong>${statusPrazo.label}</strong> (data limite era ${statusPrazo.fullDate}).</span>
                </div>
            `;
            elAlertaPrazo.classList.remove('hidden');
        } else if (statusPrazo.status === 'today' && !isDone) {
            elAlertaPrazo.className = 'rounded-sm p-2.5 bg-media/15 border border-media/40 text-dark text-sm font-serif flex items-center gap-2';
            elAlertaPrazo.innerHTML = `
                <svg class="w-4 h-4 shrink-0 text-media" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <span><strong>Prazo para Hoje!</strong> A entrega desta tarefa está programada para o final do dia.</span>
            `;
            elAlertaPrazo.classList.remove('hidden');
        } else {
            elAlertaPrazo.classList.add('hidden');
        }
    }

    const elTitulo = document.getElementById('detalhe-titulo');
    if (elTitulo) {
        elTitulo.innerText = tarefa.title;
        if (isDone) elTitulo.classList.add('line-through', 'text-gray-500');
        else elTitulo.classList.remove('line-through', 'text-gray-500');
    }

    const elDesc = document.getElementById('detalhe-descricao');
    if (elDesc) {
        if (tarefa.description && tarefa.description.trim()) {
            elDesc.innerText = tarefa.description;
            elDesc.classList.remove('italic', 'text-gray-400');
        } else {
            elDesc.innerText = 'Nenhuma nota ou detalhe cadastrado para esta tarefa.';
            elDesc.classList.add('italic', 'text-gray-400');
        }
    }

    const elDueDate = document.getElementById('detalhe-duedate-info');
    if (elDueDate) {
        if (tarefa.dueDate) {
            let statusText = '';
            if (isDone) statusText = `<span class="text-musgo font-semibold ml-1">(Concluída)</span>`;
            else if (statusPrazo.status === 'overdue') statusText = `<span class="text-terracota font-bold ml-1">(${statusPrazo.label})</span>`;
            else if (statusPrazo.status === 'today') statusText = `<span class="text-media font-bold ml-1">(Hoje)</span>`;
            else statusText = `<span class="text-gray-500 ml-1">(${statusPrazo.label})</span>`;

            elDueDate.innerHTML = `
                <svg class="w-3.5 h-3.5 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                <span>${formatarData(tarefa.dueDate)}</span> ${statusText}
            `;
        } else {
            elDueDate.innerHTML = `<span class="text-gray-400 italic">Sem prazo definido</span>`;
        }
    }

    const elCriacao = document.getElementById('detalhe-criacao-info');
    if (elCriacao) {
        elCriacao.innerText = tarefa.createdAt ? new Date(tarefa.createdAt).toLocaleDateString('pt-BR') : 'Data não registrada';
    }

    fecharVincularSubtarefaExistente();
    renderizarDetalhesFilhas(tarefa);
    renderizarDetalhesSubtasks(tarefa);
    renderizarDetalhesImagens(tarefa);
    if (modalDetalhesTarefa) modalDetalhesTarefa.showModal();
}

export function fecharModalDetalhes() {
    if (modalDetalhesTarefa) modalDetalhesTarefa.close();
    tarefaVisualizadaId = null;
    fecharVincularSubtarefaExistente();
}

export function editarTarefaDeDetalhes() {
    const taskId = tarefaVisualizadaId;
    fecharModalDetalhes();
    if (taskId) abrirModalTarefa(taskId);
}

export function excluirTarefaDeDetalhes() {
    if (!tarefaVisualizadaId) return;
    executarExclusaoComUndo(tarefaVisualizadaId);
}

export function renderizarDetalhesFilhas(tarefa) {
    const container = document.getElementById('detalhe-filhas-lista');
    const countEl = document.getElementById('detalhe-filhas-count');
    if (!container) return;

    const filhas = appState.tasks.filter(t => t.parentId === tarefa.id);
    const doneCount = filhas.filter(f => f.column === 'done').length;
    if (countEl) countEl.innerText = `${doneCount}/${filhas.length}`;

    if (filhas.length === 0) {
        container.innerHTML = `<li class="text-sm text-gray-400 font-serif italic py-1">Nenhuma sub-tarefa vinculada.</li>`;
        return;
    }

    const fragment = document.createDocumentFragment();
    filhas.forEach(f => {
        const isDone = f.column === 'done';
        const prioridade = PRIORIDADE_CONFIG[f.priority] || PRIORIDADE_CONFIG.media;
        const li = document.createElement('li');
        li.className = 'flex items-center justify-between gap-2 p-2 bg-offwhite border border-beige/60 rounded-sm text-sm hover:border-dark/30 transition-colors group';
        
        let subChecklistBadge = '';
        if (f.subtasks && f.subtasks.length > 0) {
            const stDone = f.subtasks.filter(s => s.done).length;
            subChecklistBadge = `<span class="text-xs font-mono text-gray-500 bg-beige/50 px-1.5 py-0.5 rounded-sm shrink-0" title="Checklist interno">${stDone}/${f.subtasks.length}</span>`;
        }

        let dueBadge = '';
        if (f.dueDate) {
            dueBadge = `<span class="text-xs text-gray-500 shrink-0 font-sans">${formatarData(f.dueDate)}</span>`;
        }

        li.innerHTML = `
            <div class="flex items-center gap-2 min-w-0 flex-1 cursor-pointer" title="Clique para abrir esta sub-tarefa">
                <span class="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${prioridade.cor}">${f.priority}</span>
                <span class="text-xs font-medium border border-beige px-2 py-0.5 rounded-sm shrink-0 ${isDone ? 'bg-musgo/10 text-musgo' : 'bg-white text-gray-600'}">${COLUNA_NOMES[f.column] || f.column}</span>
                <span class="font-serif text-[15px] truncate flex-1 ${isDone ? 'line-through text-gray-400' : 'text-dark font-medium'} group-hover:text-terracota transition-colors">${escapeHTML(f.title)}</span>
                ${subChecklistBadge}
                ${dueBadge}
            </div>
            <div class="flex items-center gap-1 shrink-0">
                <button type="button" class="btn-desvincular text-gray-400 hover:text-terracota p-1 text-sm" title="Desvincular desta tarefa pai">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </div>
        `;

        const clickArea = li.querySelector('.cursor-pointer');
        if (clickArea) {
            clickArea.addEventListener('click', () => abrirModalDetalhes(f.id));
        }

        const btnDesvincular = li.querySelector('.btn-desvincular');
        if (btnDesvincular) {
            btnDesvincular.addEventListener('click', (e) => {
                e.stopPropagation();
                desvincularTarefaFilha(f.id);
            });
        }

        fragment.appendChild(li);
    });

    container.innerHTML = '';
    container.appendChild(fragment);
}

export function criarNovaSubtarefaDireta() {
    if (!tarefaVisualizadaId) return;
    const pai = appState.tasks.find(t => t.id === tarefaVisualizadaId);
    if (!pai) return;
    const paiId = pai.id;
    const paiProj = pai.project;
    fecharModalDetalhes();
    abrirModalTarefa(null, { parentId: paiId, project: paiProj });
}

export function abrirVincularSubtarefaExistente() {
    if (!tarefaVisualizadaId) return;
    const container = document.getElementById('detalhe-vincular-container');
    const select = document.getElementById('detalhe-select-vincular');
    if (!container || !select) return;

    if (!container.classList.contains('hidden')) {
        container.classList.add('hidden');
        return;
    }

    const descendants = obterDescendentesIds(tarefaVisualizadaId);
    descendants.add(tarefaVisualizadaId);

    const tarefaAtual = appState.tasks.find(t => t.id === tarefaVisualizadaId);
    if (tarefaAtual && tarefaAtual.parentId) {
        descendants.add(tarefaAtual.parentId);
    }

    const candidatas = appState.tasks.filter(t => !descendants.has(t.id) && t.parentId !== tarefaVisualizadaId);

    if (candidatas.length === 0) {
        select.innerHTML = `<option value="" disabled selected>Nenhuma outra tarefa disponível para vincular</option>`;
    } else {
        select.innerHTML = `<option value="" disabled selected>Selecione uma tarefa para vincular...</option>` +
            candidatas.map(t => `<option value="${t.id}">[${escapeHTML(t.project || 'Geral')}] ${escapeHTML(t.title)}</option>`).join('');
    }

    container.classList.remove('hidden');
}

export function fecharVincularSubtarefaExistente() {
    const container = document.getElementById('detalhe-vincular-container');
    if (container) container.classList.add('hidden');
}

export function confirmarVincularSubtarefaExistente() {
    if (!tarefaVisualizadaId) return;
    const select = document.getElementById('detalhe-select-vincular');
    if (!select || !select.value) {
        mostrarToast('Selecione uma tarefa para vincular.', 'erro');
        return;
    }

    const childId = select.value;
    const childTask = appState.tasks.find(t => t.id === childId);
    const parentTask = appState.tasks.find(t => t.id === tarefaVisualizadaId);
    if (!childTask || !parentTask) return;

    childTask.parentId = parentTask.id;
    saveState();

    fecharVincularSubtarefaExistente();
    renderizarDetalhesFilhas(parentTask);

    const parentCardEl = document.getElementById(`card-${parentTask.id}`);
    if (parentCardEl) atualizarConteudoCard(parentCardEl, parentTask);

    const childCardEl = document.getElementById(`card-${childTask.id}`);
    if (childCardEl) atualizarConteudoCard(childCardEl, childTask);

    renderizarHeaderSprints();
    mostrarToast('Sub-tarefa vinculada com sucesso!', 'sucesso');
}

export function desvincularTarefaFilha(childId) {
    if (!tarefaVisualizadaId) return;
    const childTask = appState.tasks.find(t => t.id === childId);
    const parentTask = appState.tasks.find(t => t.id === tarefaVisualizadaId);
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

    renderizarHeaderSprints();
    mostrarToast('Sub-tarefa desvinculada.', 'sucesso');
}

export function renderizarDetalhesSubtasks(tarefa) {
    const container = document.getElementById('detalhe-subtasks-lista');
    const countEl = document.getElementById('detalhe-subtasks-count');
    if (!container) return;

    const subtasks = tarefa.subtasks || [];
    const doneCount = subtasks.filter(s => s.done).length;
    if (countEl) countEl.innerText = `${doneCount}/${subtasks.length}`;

    if (subtasks.length === 0) {
        container.innerHTML = `<li class="text-sm text-gray-400 font-serif italic py-1">Nenhuma subtarefa no checklist.</li>`;
        return;
    }

    const fragment = document.createDocumentFragment();
    subtasks.forEach((st, i) => {
        const li = document.createElement('li');
        li.className = 'flex items-center gap-2 p-2 bg-white border border-beige rounded-sm text-sm hover:border-terracota/40 transition-colors shadow-2xs';
        li.innerHTML = `
            <label class="flex items-center gap-2.5 cursor-pointer flex-1 select-none">
                <input type="checkbox" ${st.done ? 'checked' : ''} onchange="alternarSubtaskDeDetalhes(${i})" class="scrumban-checkbox">
                <span class="${st.done ? 'line-through text-gray-400' : 'text-gray-800 font-medium'} font-serif text-[15px] leading-tight">${escapeHTML(st.text)}</span>
            </label>
        `;
        fragment.appendChild(li);
    });

    container.innerHTML = '';
    container.appendChild(fragment);
}

export function alternarSubtaskDeDetalhes(index) {
    if (!tarefaVisualizadaId) return;
    const tarefa = appState.tasks.find(t => t.id === tarefaVisualizadaId);
    if (!tarefa || !tarefa.subtasks || !tarefa.subtasks[index]) return;

    tarefa.subtasks[index].done = !tarefa.subtasks[index].done;
    saveState();
    renderizarDetalhesSubtasks(tarefa);

    const cardEl = document.getElementById(`card-${tarefa.id}`);
    if (cardEl) atualizarConteudoCard(cardEl, tarefa);
    renderizarHeaderSprints();
}

// ================= VISUALIZAÇÃO DE IMAGENS E VÍNCULO COM SUBTAREFAS (Item 4) =================

export async function renderizarDetalhesImagens(tarefa) {
    const container = document.getElementById('detalhe-imagens-lista');
    const countEl = document.getElementById('detalhe-imagens-count');
    if (!container) return;

    // Imagens diretamente associadas a esta tarefa
    const imagensProprias = Array.isArray(tarefa.images) ? tarefa.images.map(img => ({ ...img, origem: 'esta' })) : [];

    // Se esta tarefa for um card filho, busca também imagens da tarefa pai que estejam vinculadas a esta filha
    let imagensHerdadasPai = [];
    if (tarefa.parentId) {
        const pai = appState.tasks.find(t => t.id === tarefa.parentId);
        if (pai && Array.isArray(pai.images)) {
            imagensHerdadasPai = pai.images
                .filter(img => img.targetType === 'subcard' && img.targetId === tarefa.id)
                .map(img => ({ ...img, origem: 'pai', paiTitulo: pai.title }));
        }
    }

    const todasImagens = [...imagensProprias, ...imagensHerdadasPai];
    if (countEl) countEl.innerText = todasImagens.length;

    if (todasImagens.length === 0) {
        container.innerHTML = `<p class="text-sm text-gray-400 font-serif italic py-1 col-span-full">Nenhuma imagem anexada a esta tarefa.</p>`;
        return;
    }

    container.innerHTML = '';
    for (const img of todasImagens) {
        const dataUrl = await obterImagemIndexedDB(img.id);

        let vinculoLabel = 'Geral (Tarefa Principal)';
        if (img.targetType === 'checklist') {
            const st = (tarefa.subtasks || []).find(s => s.id === img.targetId);
            vinculoLabel = st ? `Checklist: ${st.text}` : 'Checklist associado';
        } else if (img.targetType === 'subcard') {
            const filha = appState.tasks.find(f => f.id === img.targetId);
            vinculoLabel = filha ? `Subtarefa: ${filha.title}` : 'Subtarefa associada';
        }

        if (img.origem === 'pai') {
            vinculoLabel = `Vinculada via Tarefa Pai: ${img.paiTitulo || ''}`;
        }

        const card = document.createElement('div');
        card.className = 'border border-beige rounded-sm p-2 bg-white flex flex-col gap-1.5 shadow-2xs hover:border-terracota/40 transition-colors';
        card.innerHTML = `
            <div class="relative group/detimg h-28 bg-gray-100 rounded-xs overflow-hidden flex items-center justify-center cursor-pointer border border-beige/60">
                ${dataUrl ? `<img src="${dataUrl}" class="w-full h-full object-cover" alt="${escapeHTML(img.name)}">` : `<span class="text-xs text-gray-400">Carregando imagem...</span>`}
                <div class="absolute inset-0 bg-dark/40 opacity-0 group-hover/detimg:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-serif">
                    Clique para ampliar
                </div>
            </div>
            <div class="min-w-0">
                <p class="text-xs font-semibold text-dark truncate" title="${escapeHTML(img.name)}">${escapeHTML(img.name || 'Imagem')}</p>
                <span class="inline-block text-[10px] text-gray-500 font-sans truncate max-w-full" title="${escapeHTML(vinculoLabel)}">📎 ${escapeHTML(vinculoLabel)}</span>
            </div>
        `;

        card.querySelector('.cursor-pointer')?.addEventListener('click', () => {
            abrirModalVisualizarImagem(img.id, img.name, img.targetType, img.targetId, vinculoLabel);
        });

        container.appendChild(card);
    }
}

export async function abrirModalVisualizarImagem(imageId, nome = 'Imagem', targetType = '', targetId = '', labelVinculo = '') {
    const modal = document.getElementById('modalVisualizarImagem');
    const preview = document.getElementById('modal-imagem-preview');
    const titulo = document.getElementById('modal-imagem-titulo');
    const info = document.getElementById('modal-imagem-subtarefa-info');

    if (!modal || !preview) return;

    if (titulo) titulo.innerText = nome || 'Visualização de Imagem';
    if (info) {
        info.innerText = labelVinculo ? `Associação: ${labelVinculo}` : '';
    }

    preview.src = '';
    const dataUrl = await obterImagemIndexedDB(imageId);
    if (dataUrl) {
        preview.src = dataUrl;
        modal.showModal();
    } else {
        mostrarToast('Imagem não encontrada no banco de dados local.', 'erro');
    }
}

export function fecharModalVisualizarImagem() {
    const modal = document.getElementById('modalVisualizarImagem');
    const preview = document.getElementById('modal-imagem-preview');
    if (preview) preview.src = '';
    if (modal) modal.close();
}

