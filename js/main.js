/**
 * Scrumban Pessoal - Ponto de Entrada Principal (Main ES Module)
 * Modulo ES: Orquestração geral, exportação global para window e bootstrap assíncrono.
 */

import {
    COLUNAS,
    DEFAULT_STATE,
    appState,
    uiFilters,
    gerarId,
    formatarData,
    formatarDataCurta,
    escapeHTML,
    calcularStatusPrazo,
    tarefaCorrespondeFiltros
} from './state.js';

import {
    abrirIndexedDB,
    idbGet,
    idbSet,
    inicializarArmazenamento,
    saveState,
    atualizarIndicadorArmazenamento,
    verificarLembreteBackup,
    dispensarLembreteBackup,
    executarBackupComLembrete,
    exportarBackupJSON,
    importarBackupJSON,
    restaurarDadosPadrao,
    abrirModalLimparDados,
    fecharModalLimparDados,
    verificarConfirmacaoLimparDados,
    executarLimpezaTotalDados
} from './storage.js';

import {
    calcularMetricasFluxo,
    formatarDiasMetrica,
    renderizarPainelMetricasFluxo,
    gerarMarkdownSprint,
    copiarMarkdownSprint,
    baixarCsvSprint,
    abrirModalInfoMetricas,
    fecharModalInfoMetricas,
    selecionarAbaMetricaInfo
} from './metrics.js';

import {
    renderizarHeaderSprints,
    renderizarAbaSprints,
    salvarNovaSprintForm,
    ativarSprintFutura,
    excluirSprintFutura,
    abrirModalEditarSprint,
    fecharModalEditarSprint,
    salvarEdicaoSprintForm,
    excluirSprintAtual
} from './sprints.js';

import {
    abrirModalConcluirSprint,
    fecharModalConcluirSprint,
    confirmarFechamentoSprint,
    abrirModalEditarNotasSprint,
    fecharModalEditarNotasSprint,
    salvarNotasSprintHistorico,
    reabrirSprintHistorico,
    excluirSprintHistorico,
    renderizarAbaHistorico
} from './sprint-closure.js';

import {
    atualizarWipBadge,
    atualizarOverdueBadge,
    verificarPontoReabastecimento,
    atualizarContadoresColunas,
    alternarFiltroOverdue,
    renderizarQuadro,
    moverColunaRapido,
    moverTarefaParaColuna,
    reordenarOuMoverTarefa,
    selecionarColunaMobile,
    obterColunaMobileAtiva,
    expandirColuna,
    recolherColunaExpandida,
    toggleExpandirColuna,
    expandirColunaVizinha,
    obterColunaExpandidaAtiva
} from './kanban.js';

import {
    inicializarColunasDrop,
    vincularEventosDrag,
    vincularEventosTouch
} from './drag-drop.js';

import {
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
    fecharModalVisualizarImagem
} from './task-details.js';

import {
    abrirModalTarefa,
    fecharModalTarefa,
    salvarTarefaForm,
    excluirTarefaAtual,
    adicionarSubtask,
    alternarSubtask,
    removerSubtask,
    processarUploadImagemTarefa,
    removerImagemEdicao,
    atualizarRelacaoImagemEdicao
} from './task-edit.js';

import {
    renderizarAbaConfig,
    salvarConfigWip,
    salvarConfigReplenishment,
    salvarConfigSubtasksVisibilidade,
    adicionarProjetoConfig,
    removerProjetoConfig
} from './config.js';

import {
    mostrarToast,
    mostrarToastComAcao,
    executarExclusaoComUndo,
    desfazerExclusaoTarefa,
    mudarAba,
    atualizarFiltrosUI,
    inicializarFiltros,
    abrirModalAtalhos,
    fecharModalAtalhos,
    inicializarEventosModais,
    inicializarAtalhosTeclado
} from './ui.js';

import {
    toggleBarraLateral,
    inicializarBarraLateral,
    toggleMobileMenu,
    fecharMobileMenu
} from './sidebar.js';

import {
    obterPreferenciaTema,
    ehTemaEscuroAtivo,
    aplicarTema,
    definirTema,
    toggleTemaDark,
    inicializarTemaDark
} from './theme.js';

// Vinculação de funções ao escopo global (window) para compatibilidade transparente com handlers inline HTML
const globalBindings = {
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
        renderizarAbaSprints();
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

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapApp);
} else {
    bootstrapApp();
}
