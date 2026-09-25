/**
 * Scrumban Pessoal - Aba de Configurações
 * Modulo ES: Gestão de limites WIP, ponto de reabastecimento, projetos e preferências.
 */

import { appState, escapeHTML } from './state.js';
import { saveState } from './storage.js';
import { mostrarToast, atualizarFiltrosUI } from './ui.js';
import { renderizarQuadro, verificarPontoReabastecimento, atualizarContadoresColunas, atualizarWipBadge, atualizarOverdueBadge } from './kanban.js';
import { obterPreferenciaTema, ehTemaEscuroAtivo, atualizarUIModoTema } from './theme.js';

export function renderizarAbaConfig() {
    const inputWip = document.getElementById('configWipLimit');
    if (inputWip) inputWip.value = appState.settings.wipLimit;

    const inputReplenish = document.getElementById('configReplenishmentLimit');
    if (inputReplenish) inputReplenish.value = typeof appState.settings.replenishmentLimit === 'number' ? appState.settings.replenishmentLimit : 2;

    const listaProjetos = document.getElementById('configListaProjetos');
    if (listaProjetos) {
        listaProjetos.innerHTML = appState.settings.projects.map((p, i) => `
            <li class="flex items-center justify-between p-2 bg-offwhite border border-beige rounded-sm text-sm">
                <span class="font-serif text-base">${escapeHTML(p)}</span>
                <button onclick="removerProjetoConfig(${i})" class="text-xs text-gray-400 hover:text-terracota underline">Excluir</button>
            </li>
        `).join('');
    }

    atualizarUIModoSubtasksVisibilidade();
    atualizarUIModoTema(obterPreferenciaTema(), ehTemaEscuroAtivo());
}

export function salvarConfigSubtasksVisibilidade(modo) {
    const novoModo = modo === 'parent_only' ? 'parent_only' : 'all';
    appState.settings.subtasksVisibility = novoModo;
    saveState();
    atualizarUIModoSubtasksVisibilidade();
    renderizarQuadro();
    atualizarContadoresColunas();
    atualizarWipBadge();
    atualizarOverdueBadge();
    const txtModo = novoModo === 'parent_only' ? 'Apenas tarefas principais' : 'Todas as tarefas visíveis';
    mostrarToast(`Visualização do quadro alterada para: ${txtModo}`, 'sucesso');
}

export function atualizarUIModoSubtasksVisibilidade() {
    const modo = appState.settings.subtasksVisibility || 'all';
    const radios = document.querySelectorAll('input[name="opcaoVisibilidadeSubtasks"]');
    radios.forEach(radio => {
        radio.checked = radio.value === modo;
    });

    const badge = document.getElementById('badge-subtasks-visibilidade');
    if (badge) {
        badge.innerText = modo === 'parent_only' ? 'Apenas Tarefas Pai' : 'Todas Visíveis';
    }
}

export function salvarConfigWip() {
    const valor = parseInt(document.getElementById('configWipLimit').value, 10);
    appState.settings.wipLimit = isNaN(valor) || valor < 0 ? 0 : valor;
    saveState();
    renderizarQuadro();
    mostrarToast('Limite de WIP atualizado com sucesso!', 'sucesso');
}

export function salvarConfigReplenishment() {
    const input = document.getElementById('configReplenishmentLimit');
    if (!input) return;
    const valor = parseInt(input.value, 10);
    appState.settings.replenishmentLimit = isNaN(valor) || valor < 0 ? 0 : valor;
    saveState();
    verificarPontoReabastecimento();
    mostrarToast('Ponto de reabastecimento salvo com sucesso!', 'sucesso');
}

export function adicionarProjetoConfig() {
    const input = document.getElementById('configNovoProjeto');
    const nome = input.value.trim();
    if (!nome) return;

    if (!appState.settings.projects.includes(nome)) {
        appState.settings.projects.push(nome);
        saveState();
        input.value = '';
        renderizarAbaConfig();
        atualizarFiltrosUI();
        mostrarToast(`Projeto "${nome}" cadastrado com sucesso!`, 'sucesso');
    }
}

export function removerProjetoConfig(index) {
    if (appState.settings.projects.length <= 1) {
        mostrarToast('Mantenha pelo menos um projeto cadastrado no sistema.', 'erro');
        return;
    }
    const removido = appState.settings.projects.splice(index, 1)[0];
    saveState();
    renderizarAbaConfig();
    atualizarFiltrosUI();
    renderizarQuadro();
    mostrarToast(`Projeto "${removido}" removido.`, 'info');
}
