/**
 * Scrumban Pessoal - Criação e Edição de Tarefas
 * Modulo ES: Formulário de tarefas, categorias/projetos e adição de subtarefas.
 */

import { appState, gerarId, escapeHTML, tarefaCorrespondeFiltros, obterDescendentesIds } from './state.js';
import { saveState, verificarLembreteBackup, salvarImagemIndexedDB, obterImagemIndexedDB, excluirImagemIndexedDB } from './storage.js';
import { mostrarToast, executarExclusaoComUndo, atualizarFiltrosUI } from './ui.js';
import { criarElementoCard, moverCardNoDOM, verificarPlaceholderColuna, atualizarContadoresColunas, atualizarWipBadge, atualizarOverdueBadge, atualizarConteudoCard } from './kanban.js';
import { renderizarHeaderSprints } from './sprints.js';

const modalTarefa = document.getElementById('modalTarefa');

let tarefaEmEdicaoId = null;
let subtasksTemporarias = [];
let imagensTemporarias = [];

export function abrirModalTarefa(taskId = null, options = {}) {
    tarefaEmEdicaoId = taskId;
    subtasksTemporarias = [];
    imagensTemporarias = [];

    const selectProjeto = document.getElementById('inputProjeto');
    if (selectProjeto) {
        selectProjeto.innerHTML = appState.settings.projects.map(p => `
            <option value="${p}">${p}</option>
        `).join('') + `<option value="__novo__">+ Cadastrar Novo Projeto...</option>`;
    }

    const selectParent = document.getElementById('inputParentId');
    if (selectParent) {
        let invalidos = new Set();
        if (taskId) {
            invalidos = obterDescendentesIds(taskId);
            invalidos.add(taskId);
        }
        const tarefasPaiCandidatas = appState.tasks.filter(t => !invalidos.has(t.id));
        selectParent.innerHTML = `<option value="">(Nenhuma - Tarefa Principal)</option>` +
            tarefasPaiCandidatas.map(t => `<option value="${t.id}">[${escapeHTML(t.project || 'Geral')}] ${escapeHTML(t.title)}</option>`).join('');
    }

    const tituloModal = document.getElementById('modal-tarefa-titulo');
    const btnExcluir = document.getElementById('btn-excluir-tarefa');
    const selectDificuldade = document.getElementById('inputDificuldade');

    if (taskId) {
        const tarefa = appState.tasks.find(t => t.id === taskId);
        if (!tarefa) return;

        if (tituloModal) tituloModal.innerText = 'Editar Tarefa';
        document.getElementById('inputTitulo').value = tarefa.title || '';
        document.getElementById('inputDescricao').value = tarefa.description || '';
        document.getElementById('inputPrioridade').value = tarefa.priority || 'media';
        if (selectDificuldade) selectDificuldade.value = tarefa.difficulty || 'media';
        document.getElementById('inputColuna').value = tarefa.column || 'backlog';
        document.getElementById('inputDueDate').value = tarefa.dueDate || '';
        if (selectProjeto) selectProjeto.value = tarefa.project || appState.settings.projects[0];
        if (selectParent) selectParent.value = tarefa.parentId || '';

        subtasksTemporarias = tarefa.subtasks ? JSON.parse(JSON.stringify(tarefa.subtasks)) : [];
        imagensTemporarias = tarefa.images ? JSON.parse(JSON.stringify(tarefa.images)) : [];
        if (btnExcluir) btnExcluir.classList.remove('hidden');
    } else {
        if (tituloModal) tituloModal.innerText = 'Nova Ideia / Tarefa';
        document.getElementById('inputTitulo').value = '';
        document.getElementById('inputDescricao').value = '';
        document.getElementById('inputPrioridade').value = 'media';
        if (selectDificuldade) selectDificuldade.value = 'media';
        document.getElementById('inputColuna').value = 'backlog';
        document.getElementById('inputDueDate').value = '';
        if (selectProjeto) selectProjeto.value = (options && options.project) ? options.project : (appState.settings.projects[0] || '');
        if (selectParent) selectParent.value = (options && options.parentId) ? options.parentId : '';
        if (btnExcluir) btnExcluir.classList.add('hidden');
    }

    renderizarListaSubtasks();
    renderizarListaImagensEdicao();
    if (modalTarefa) modalTarefa.showModal();
}

export function fecharModalTarefa() {
    if (modalTarefa) modalTarefa.close();
    tarefaEmEdicaoId = null;
    subtasksTemporarias = [];
    imagensTemporarias = [];
}

export function salvarTarefaForm() {
    const titulo = document.getElementById('inputTitulo').value.trim();
    if (!titulo) {
        mostrarToast('Por favor, informe o título da tarefa.', 'erro');
        document.getElementById('inputTitulo').focus();
        return;
    }

    let projeto = document.getElementById('inputProjeto').value;
    if (projeto === '__novo__') {
        const novo = prompt('Nome do novo projeto ou categoria:');
        if (novo && novo.trim()) {
            projeto = novo.trim();
            if (!appState.settings.projects.includes(projeto)) {
                appState.settings.projects.push(projeto);
                atualizarFiltrosUI();
            }
        } else {
            projeto = appState.settings.projects[0] || 'Geral';
        }
    }

    const descricao = document.getElementById('inputDescricao').value.trim();
    const prioridade = document.getElementById('inputPrioridade').value;
    const dificuldade = document.getElementById('inputDificuldade')?.value || 'media';
    const coluna = document.getElementById('inputColuna').value;
    const dueDate = document.getElementById('inputDueDate').value;
    const parentId = (document.getElementById('inputParentId')?.value) || null;
    const curSprint = appState.sprints.find(s => s.status === 'current');

    if (tarefaEmEdicaoId) {
        const index = appState.tasks.findIndex(t => t.id === tarefaEmEdicaoId);
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
                dueDate: dueDate,
                subtasks: subtasksTemporarias,
                images: imagensTemporarias,
                parentId: parentId
            };

            if (coluna === 'progress' && !appState.tasks[index].startedAt) appState.tasks[index].startedAt = new Date().toISOString();
            if (coluna === 'done' && !appState.tasks[index].completedAt) appState.tasks[index].completedAt = new Date().toISOString();
            else if (coluna !== 'done') delete appState.tasks[index].completedAt;

            if (mudouColuna) {
                const tasksOrigem = appState.tasks.filter(t => t.column === colunaAntiga && t.id !== tarefaEmEdicaoId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
                tasksOrigem.forEach((t, idx) => { t.order = idx; });
                const tasksDestino = appState.tasks.filter(t => t.column === coluna && t.id !== tarefaEmEdicaoId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
                tasksDestino.push(appState.tasks[index]);
                tasksDestino.forEach((t, idx) => { t.order = idx; });
            }

            if (parentAntigo && parentAntigo !== parentId) {
                const antCard = document.getElementById(`card-${parentAntigo}`);
                const antTask = appState.tasks.find(x => x.id === parentAntigo);
                if (antCard && antTask) atualizarConteudoCard(antCard, antTask);
            }
            if (parentId) {
                const newCard = document.getElementById(`card-${parentId}`);
                const newTask = appState.tasks.find(x => x.id === parentId);
                if (newCard && newTask) atualizarConteudoCard(newCard, newTask);
            }

            saveState();
            fecharModalTarefa();
            atualizarFiltrosUI();
            moverCardNoDOM(appState.tasks[index], colunaAntiga, coluna);
            if (mudouColuna && coluna === 'progress') atualizarWipBadge(true);
            mostrarToast('Tarefa atualizada com sucesso!', 'sucesso');
        }
    } else {
        const novaTarefa = {
            id: gerarId('task'),
            title: titulo,
            description: descricao,
            priority: prioridade,
            difficulty: dificuldade,
            column: coluna,
            order: 0,
            project: projeto,
            dueDate: dueDate,
            subtasks: subtasksTemporarias,
            images: imagensTemporarias,
            parentId: parentId,
            sprintId: curSprint ? curSprint.id : null,
            createdAt: new Date().toISOString()
        };
        if (coluna === 'progress') novaTarefa.startedAt = new Date().toISOString();
        if (coluna === 'done') novaTarefa.completedAt = new Date().toISOString();

        appState.tasks.forEach(t => {
            if (t.column === coluna) t.order = (t.order ?? 0) + 1;
        });

        appState.tasks.unshift(novaTarefa);

        if (parentId) {
            const parentCard = document.getElementById(`card-${parentId}`);
            const pTask = appState.tasks.find(x => x.id === parentId);
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
        atualizarWipBadge(coluna === 'progress');
        atualizarOverdueBadge();
        renderizarHeaderSprints();
        verificarLembreteBackup();
        mostrarToast('Nova tarefa criada com sucesso!', 'sucesso');
    }
}

export function excluirTarefaAtual() {
    if (!tarefaEmEdicaoId) return;
    executarExclusaoComUndo(tarefaEmEdicaoId);
}

export function adicionarSubtask() {
    const input = document.getElementById('inputNovaSubtask');
    const txt = input.value.trim();
    if (!txt) return;

    subtasksTemporarias.push({ id: gerarId('st'), text: txt, done: false });
    input.value = '';
    renderizarListaSubtasks();
}

export function alternarSubtask(index) {
    if (subtasksTemporarias[index]) {
        subtasksTemporarias[index].done = !subtasksTemporarias[index].done;
        renderizarListaSubtasks();
    }
}

export function removerSubtask(index) {
    subtasksTemporarias.splice(index, 1);
    renderizarListaSubtasks();
}

export function renderizarListaSubtasks() {
    const container = document.getElementById('lista-subtasks');
    if (!container) return;

    if (subtasksTemporarias.length === 0) {
        container.innerHTML = `<p class="text-xs text-gray-400 font-serif italic">Nenhum item no checklist ainda.</p>`;
        return;
    }

    const fragment = document.createDocumentFragment();
    subtasksTemporarias.forEach((st, i) => {
        const li = document.createElement('li');
        li.className = 'flex items-center justify-between gap-2 p-2 bg-white border border-beige rounded-sm text-sm hover:border-terracota/40 transition-colors shadow-2xs';
        li.innerHTML = `
            <label class="flex items-center gap-2.5 cursor-pointer flex-1 select-none">
                <input type="checkbox" ${st.done ? 'checked' : ''} onchange="alternarSubtask(${i})" class="scrumban-checkbox">
                <span class="${st.done ? 'line-through text-gray-400' : 'text-gray-800 font-medium'} font-serif text-[15px] leading-tight">${escapeHTML(st.text)}</span>
            </label>
            <button type="button" onclick="removerSubtask(${i})" class="text-gray-400 hover:text-terracota p-1" title="Remover item">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
        `;
        fragment.appendChild(li);
    });

    container.innerHTML = '';
    container.appendChild(fragment);
}

// ================= GESTÃO DE IMAGENS NA EDIÇÃO (Item 4: IndexedDB) =================

export async function processarUploadImagemTarefa(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        mostrarToast('Por favor, selecione um arquivo de imagem válido.', 'erro');
        event.target.value = '';
        return;
    }

    // Limite razoável de segurança por imagem (10MB)
    if (file.size > 10 * 1024 * 1024) {
        mostrarToast('A imagem excede o tamanho máximo de 10MB.', 'erro');
        event.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const dataUrl = e.target.result;
            const imageId = gerarId('img');
            await salvarImagemIndexedDB(imageId, dataUrl);

            imagensTemporarias.push({
                id: imageId,
                name: file.name,
                targetType: 'none', // 'none' (geral), 'checklist' (subtarefa checklist) ou 'subcard' (tarefa filha)
                targetId: ''
            });

            renderizarListaImagensEdicao();
            mostrarToast('Imagem adicionada e salva com segurança no IndexedDB.', 'sucesso');
        } catch (err) {
            console.error('Erro ao salvar imagem no IndexedDB:', err);
            mostrarToast('Erro ao salvar imagem no IndexedDB: ' + (err.message || err), 'erro');
        } finally {
            event.target.value = '';
        }
    };
    reader.readAsDataURL(file);
}

export function removerImagemEdicao(index) {
    if (imagensTemporarias[index]) {
        const img = imagensTemporarias[index];
        excluirImagemIndexedDB(img.id);
        imagensTemporarias.splice(index, 1);
        renderizarListaImagensEdicao();
    }
}

export function atualizarRelacaoImagemEdicao(index, targetType, targetId) {
    if (imagensTemporarias[index]) {
        imagensTemporarias[index].targetType = targetType;
        imagensTemporarias[index].targetId = targetId;
    }
}

export async function renderizarListaImagensEdicao() {
    const container = document.getElementById('lista-imagens-tarefa');
    if (!container) return;

    if (imagensTemporarias.length === 0) {
        container.innerHTML = `<p class="text-xs text-gray-400 font-serif italic col-span-full py-1">Nenhuma imagem anexada a esta tarefa.</p>`;
        return;
    }

    // Filhas disponíveis para vincular
    const filhas = tarefaEmEdicaoId ? appState.tasks.filter(t => t.parentId === tarefaEmEdicaoId) : [];

    container.innerHTML = '';
    for (let i = 0; i < imagensTemporarias.length; i++) {
        const item = imagensTemporarias[i];
        const dataUrl = await obterImagemIndexedDB(item.id);

        const card = document.createElement('div');
        card.className = 'border border-beige rounded-sm p-2 bg-white flex flex-col gap-2 shadow-2xs';

        // Opções de associação
        let optionsChecklist = subtasksTemporarias.map(s => `
            <option value="checklist:${s.id}" ${item.targetType === 'checklist' && item.targetId === s.id ? 'selected' : ''}>
                Checklist: ${escapeHTML(s.text.slice(0, 24))}${s.text.length > 24 ? '...' : ''}
            </option>
        `).join('');

        let optionsFilhas = filhas.map(f => `
            <option value="subcard:${f.id}" ${item.targetType === 'subcard' && item.targetId === f.id ? 'selected' : ''}>
                Subtarefa: ${escapeHTML(f.title.slice(0, 24))}${f.title.length > 24 ? '...' : ''}
            </option>
        `).join('');

        card.innerHTML = `
            <div class="relative group/img h-24 bg-gray-100 rounded-xs overflow-hidden flex items-center justify-center cursor-pointer border border-beige/60" onclick="window.abrirModalVisualizarImagem('${item.id}', '${escapeHTML(item.name || 'Imagem')}', '${item.targetType}', '${item.targetId}')">
                ${dataUrl ? `<img src="${dataUrl}" class="w-full h-full object-cover" alt="${escapeHTML(item.name)}">` : `<span class="text-xs text-gray-400">Carregando...</span>`}
                <div class="absolute inset-0 bg-dark/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-serif">
                    Clique para ampliar
                </div>
            </div>
            <div class="flex items-center justify-between gap-1">
                <span class="text-[11px] font-medium text-gray-700 truncate max-w-[130px]" title="${escapeHTML(item.name)}">${escapeHTML(item.name || 'Imagem')}</span>
                <button type="button" onclick="removerImagemEdicao(${i})" class="text-xs text-terracota hover:underline p-0.5">Remover</button>
            </div>
            <div>
                <label class="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-0.5">Vincular a subtarefa:</label>
                <select onchange="const [t, id] = this.value.split(':'); atualizarRelacaoImagemEdicao(${i}, t, id || '')" class="w-full text-xs p-1 border border-beige rounded-sm bg-white text-dark focus:outline-none focus:border-terracota">
                    <option value="none:" ${item.targetType === 'none' ? 'selected' : ''}>(Geral - Tarefa Principal)</option>
                    ${optionsChecklist}
                    ${optionsFilhas}
                </select>
            </div>
        `;
        container.appendChild(card);
    }
}
