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
    aplicarBackup,
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
    inicializarAtalhosTeclado,
    inicializarComportamentoDatas,
    confirmarAcao
} from './ui.js';

import {
    toggleBarraLateral,
    inicializarBarraLateral,
    toggleMobileMenu,
    fecharMobileMenu
} from './sidebar.js';

import {
    inicializarDesktop,
    mostrarJanela,
    abrirPastaBackups,
    lerBackupAutomatico,
    renderizarConfigDesktop
} from './desktop.js';

import {
    inicializarSync,
    sincronizarRemoto,
    salvarConfigSync,
    removerConfigSync
} from './sync.js';

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
    importarBackupJSON: (e) => importarBackupJSON(e, rerenderizarTudo),
    abrirPastaBackups,
    mostrarToast,
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
    obterColunaExpandidaAtiva,
    sincronizarRemoto: () => sincronizarRemoto({ silencioso: false }),
    salvarConfigSync,
    removerConfigSync
};

Object.entries(globalBindings).forEach(([nome, fn]) => {
    window[nome] = fn;
});

function rerenderizarTudo() {
    atualizarFiltrosUI();
    renderizarQuadro();
    renderizarAbaSprints();
    renderizarAbaHistorico();
    renderizarAbaConfig();
}

async function restaurarBackupAutomatico(nome) {
    const dia = nome.replace('scrumban-auto-', '').replace('.json', '').split('-').reverse().join('/');
    const ok = await confirmarAcao({
        titulo: `Restaurar o backup de ${dia}?`,
        mensagem: 'Todos os dados atuais serão substituídos pelos daquele dia. O estado atual continua salvo no backup automático de hoje.',
        textoConfirmar: 'Restaurar backup',
        perigo: true
    });
    if (!ok) return;
    try {
        if (await aplicarBackup(await lerBackupAutomatico(nome))) rerenderizarTudo();
    } catch (e) {
        mostrarToast(`Não foi possível restaurar o backup: ${e.message || e}`, 'erro', 6000);
    }
}

async function bootstrapApp() {
    inicializarBarraLateral();
    inicializarTemaDark();
    await inicializarArmazenamento();
    atualizarIndicadorArmazenamento();
    inicializarColunasDrop();
    inicializarEventosModais();
    inicializarAtalhosTeclado();
    inicializarComportamentoDatas();
    atualizarFiltrosUI();
    inicializarFiltros();
    renderizarQuadro();
    verificarLembreteBackup();
    inicializarSync();
    inicializarDesktop({ aoRestaurarBackup: restaurarBackupAutomatico });
    renderizarConfigDesktop();
    // A janela do desktop nasce oculta: só aparece com o quadro já pintado (sem flash branco)
    requestAnimationFrame(() => mostrarJanela());
}

window.bootstrapApp = bootstrapApp;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapApp);
} else {
    bootstrapApp();
}
