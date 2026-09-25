/**
 * Scrumban Pessoal - Métricas Ágeis de Fluxo & Exportação
 * Modulo ES: Lead Time, Cycle Time, Throughput e exportação em Markdown e CSV.
 */

import { appState, formatarData, escapeHTML, DIFICULDADE_CONFIG } from './state.js';
import { mostrarToast } from './ui.js';

export function calcularMetricasFluxo() {
    const agora = Date.now();
    const seteDiasAtras = agora - (7 * 24 * 60 * 60 * 1000);
    const trintaDiasAtras = agora - (30 * 24 * 60 * 60 * 1000);

    const tarefasConcluidas = [];

    // Tarefas concluídas no quadro ativo
    appState.tasks.filter(t => t.column === 'done').forEach(t => {
        tarefasConcluidas.push({
            id: t.id,
            title: t.title,
            difficulty: t.difficulty || 'media',
            createdAt: t.createdAt || null,
            startedAt: t.startedAt || null,
            completedAt: t.completedAt || t.createdAt || null
        });
    });

    // Tarefas concluídas arquivadas no histórico
    (appState.history || []).forEach(hist => {
        const dataConclusaoSprint = hist.closedAt || hist.endDate;
        const dataInicioSprint = hist.startDate;
        if (Array.isArray(hist.tasksDelivered)) {
            hist.tasksDelivered.forEach(t => {
                tarefasConcluidas.push({
                    id: t.id,
                    title: t.title,
                    difficulty: t.difficulty || 'media',
                    createdAt: t.createdAt || dataInicioSprint || null,
                    startedAt: t.startedAt || dataInicioSprint || null,
                    completedAt: t.completedAt || dataConclusaoSprint || null
                });
            });
        }
    });

    // Cycle Time e Lead Time gerais e por dificuldade
    const cycleTimes = [];
    const leadTimes = [];

    const niveis = ['trivial', 'facil', 'media', 'dificil', 'muito_dificil'];
    const porDificuldade = {};
    niveis.forEach(k => {
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

    tarefasConcluidas.forEach(t => {
        const difKey = porDificuldade[t.difficulty] ? t.difficulty : 'media';
        porDificuldade[difKey].total++;

        // Cycle Time: startedAt -> completedAt (em dias)
        if (t.startedAt && t.completedAt) {
            const ms = new Date(t.completedAt).getTime() - new Date(t.startedAt).getTime();
            if (ms >= 0) {
                const dias = ms / (1000 * 60 * 60 * 24);
                cycleTimes.push(dias);
                porDificuldade[difKey].cycleTimes.push(dias);
            }
        }

        // Lead Time: createdAt -> completedAt (em dias)
        if (t.createdAt && t.completedAt) {
            const ms = new Date(t.completedAt).getTime() - new Date(t.createdAt).getTime();
            if (ms >= 0) {
                const dias = ms / (1000 * 60 * 60 * 24);
                leadTimes.push(dias);
                porDificuldade[difKey].leadTimes.push(dias);
            }
        }
    });

    // Throughput: tarefas finalizadas nos últimos 7 e 30 dias
    let throughput7d = 0;
    let throughput30d = 0;
    tarefasConcluidas.forEach(t => {
        if (t.completedAt) {
            const ms = new Date(t.completedAt).getTime();
            if (!isNaN(ms)) {
                if (ms >= seteDiasAtras) throughput7d++;
                if (ms >= trintaDiasAtras) throughput30d++;
            }
        }
    });

    const avgCycle = cycleTimes.length > 0
        ? cycleTimes.reduce((acc, v) => acc + v, 0) / cycleTimes.length
        : null;

    const avgLead = leadTimes.length > 0
        ? leadTimes.reduce((acc, v) => acc + v, 0) / leadTimes.length
        : null;

    const totalEntregas = tarefasConcluidas.length;
    niveis.forEach(k => {
        const item = porDificuldade[k];
        item.avgCycleTime = item.cycleTimes.length > 0
            ? item.cycleTimes.reduce((acc, v) => acc + v, 0) / item.cycleTimes.length
            : null;
        item.avgLeadTime = item.leadTimes.length > 0
            ? item.leadTimes.reduce((acc, v) => acc + v, 0) / item.leadTimes.length
            : null;
        item.porcentagem = totalEntregas > 0
            ? Math.round((item.total / totalEntregas) * 100)
            : 0;
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

export function formatarDiasMetrica(dias) {
    if (dias === null || isNaN(dias)) return '—';
    if (dias < 0.05) return '< 0.1';
    return dias.toFixed(1);
}

export function renderizarPainelMetricasFluxo() {
    const container = document.getElementById('painel-metricas-fluxo');
    if (!container) return;

    const metricas = calcularMetricasFluxo();
    const cycleStr = formatarDiasMetrica(metricas.avgCycleTime);
    const leadStr = formatarDiasMetrica(metricas.avgLeadTime);
    const niveis = ['trivial', 'facil', 'media', 'dificil', 'muito_dificil'];

    container.innerHTML = `
        <!-- 1. Linha com os 3 Cards de Métricas Ágeis Principais -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <!-- Card 1: Cycle Time Médio -->
            <div class="relative group bg-white p-5 border border-beige rounded-sm shadow-xs transition-all hover:shadow-md hover:border-musgo/60 cursor-pointer" onclick="abrirModalInfoMetricas('cycle-time')" title="Cycle Time Médio: Tempo entre In Progress e Done. Clique para abrir o guia de métricas.">
                <div class="flex items-center justify-between">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-musgo">Métrica de Fluxo</span>
                    <button type="button" onclick="event.stopPropagation(); abrirModalInfoMetricas('cycle-time')" class="p-1 -mr-1 rounded-sm text-gray-400 hover:text-musgo hover:bg-musgo/10 transition-colors cursor-pointer" title="O que significa Cycle Time? Clique para ver detalhes e fórmula">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    </button>
                </div>
                <h3 class="font-serif text-sm font-semibold text-gray-600 mt-1 flex items-center gap-1.5">
                    <span>Cycle Time Médio</span>
                </h3>
                <div class="mt-2 flex items-baseline gap-2">
                    <span class="font-mono text-3xl font-bold text-dark">${cycleStr}</span>
                    <span class="text-xs text-gray-500 font-serif">${cycleStr === '—' ? '' : (cycleStr === '1.0' ? 'dia' : 'dias')}</span>
                </div>
                <p class="text-[11px] text-gray-400 mt-1.5 font-sans">
                    Tempo de execução ativa (de <em>In Progress</em> até <em>Done</em>)
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
                        Mede o tempo real gasto trabalhando na tarefa (desde <em>In Progress</em> até <em>Done</em>). Mede seu foco e velocidade de execução.
                    </p>
                    <div class="p-1.5 bg-offwhite border border-beige/60 rounded-xs font-mono text-[10px] text-gray-600 mb-2">
                        Fórmula: Data Conclusão - Data Início
                    </div>
                    <p class="text-[11px] font-sans text-gray-500 italic">
                        💡 Dica: Respeite o Limite WIP para reduzir o Cycle Time.
                    </p>
                </div>
            </div>

            <!-- Card 2: Lead Time Médio -->
            <div class="relative group bg-white p-5 border border-beige rounded-sm shadow-xs transition-all hover:shadow-md hover:border-terracota/60 cursor-pointer" onclick="abrirModalInfoMetricas('lead-time')" title="Lead Time Médio: Tempo total desde a criação no Backlog até Done. Clique para abrir o guia de métricas.">
                <div class="flex items-center justify-between">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-terracota">Métrica de Fluxo</span>
                    <button type="button" onclick="event.stopPropagation(); abrirModalInfoMetricas('lead-time')" class="p-1 -mr-1 rounded-sm text-gray-400 hover:text-terracota hover:bg-terracota/10 transition-colors cursor-pointer" title="O que significa Lead Time? Clique para ver detalhes e fórmula">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    </button>
                </div>
                <h3 class="font-serif text-sm font-semibold text-gray-600 mt-1 flex items-center gap-1.5">
                    <span>Lead Time Médio</span>
                </h3>
                <div class="mt-2 flex items-baseline gap-2">
                    <span class="font-mono text-3xl font-bold text-dark">${leadStr}</span>
                    <span class="text-xs text-gray-500 font-serif">${leadStr === '—' ? '' : (leadStr === '1.0' ? 'dia' : 'dias')}</span>
                </div>
                <p class="text-[11px] text-gray-400 mt-1.5 font-sans">
                    Ciclo total (desde a criação da ideia até <em>Done</em>)
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
                        Mede o ciclo de vida total da demanda: desde a anotação no <strong>Backlog</strong> até ser concluída em <strong>Done</strong>. Inclui a fila de espera.
                    </p>
                    <div class="p-1.5 bg-offwhite border border-beige/60 rounded-xs font-mono text-[10px] text-gray-600 mb-2">
                        Fórmula: Data Conclusão - Data Criação
                    </div>
                    <p class="text-[11px] font-sans text-gray-500 italic">
                        💡 Dica: Backlog enxuto e Ponto de Reabastecimento reduzem o Lead Time.
                    </p>
                </div>
            </div>

            <!-- Card 3: Throughput (Vazão) -->
            <div class="relative group bg-white p-5 border border-beige rounded-sm shadow-xs transition-all hover:shadow-md hover:border-dark/60 cursor-pointer" onclick="abrirModalInfoMetricas('throughput')" title="Throughput: Quantidade de entregas finalizadas. Clique para abrir o guia de métricas.">
                <div class="flex items-center justify-between">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-dark">Cadência de Entrega</span>
                    <button type="button" onclick="event.stopPropagation(); abrirModalInfoMetricas('throughput')" class="p-1 -mr-1 rounded-sm text-gray-400 hover:text-dark hover:bg-beige transition-colors cursor-pointer" title="O que significa Throughput? Clique para ver detalhes e fórmula">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    </button>
                </div>
                <h3 class="font-serif text-sm font-semibold text-gray-600 mt-1 flex items-center gap-1.5">
                    <span>Throughput (Vazão)</span>
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
                    Tarefas entregues nos períodos recentes
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
                        <span class="text-xs font-bold font-serif">Throughput (Vazão de Entregas)</span>
                    </div>
                    <p class="text-xs font-sans text-gray-700 leading-relaxed mb-2">
                        Total de tarefas concluídas na janela de 7 e 30 dias. Mede sua velocidade empírica real de entrega sem pontos subjetivos.
                    </p>
                </div>
            </div>
        </div>

        <!-- 2. Linha com Desempenho & Distribuição por Nível de Dificuldade -->
        <div class="bg-white p-5 border border-beige rounded-sm shadow-xs transition-all hover:border-dark/30">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-beige/60 mb-4">
                <div>
                    <div class="flex items-center gap-2">
                        <span class="text-[10px] font-bold uppercase tracking-wider text-musgo">Calibração & Esforço</span>
                        <span class="text-xs text-gray-400">•</span>
                        <span class="text-xs text-gray-500 font-sans">${metricas.totalEntregas} entrega${metricas.totalEntregas === 1 ? '' : 's'} analisada${metricas.totalEntregas === 1 ? '' : 's'}</span>
                    </div>
                    <h3 class="font-serif text-lg font-bold text-dark mt-0.5 flex items-center gap-2">
                        <span>Desempenho por Nível de Dificuldade</span>
                    </h3>
                </div>
                <button type="button" onclick="abrirModalInfoMetricas('dificuldade')" class="text-xs font-serif text-musgo hover:underline flex items-center gap-1 self-start sm:self-auto cursor-pointer" title="Saiba como usar a calibração de dificuldade no planejamento">
                    <span>Como estimar com dificuldade</span>
                    <span>&rarr;</span>
                </button>
            </div>

            <!-- Barra de Distribuição Visual Multi-Segmento -->
            <div class="mb-5">
                <div class="flex items-center justify-between text-xs text-gray-500 mb-1.5 font-sans">
                    <span class="font-medium">Distribuição das Entregas Realizadas</span>
                    <span class="font-mono text-[11px]">${metricas.totalEntregas > 0 ? '100% dos itens concluídos' : 'Nenhuma entrega para calcular distribuição'}</span>
                </div>
                <div class="w-full h-3 bg-beige/60 rounded-sm overflow-hidden flex shadow-2xs">
                    ${metricas.totalEntregas > 0 ? niveis.map(k => {
                        const item = metricas.porDificuldade[k];
                        const conf = DIFICULDADE_CONFIG[k];
                        if (item.porcentagem === 0) return '';
                        return `<div class="${conf.corDot} h-full transition-all duration-300" style="width: ${item.porcentagem}%" title="${conf.label}: ${item.total} tarefa(s) (${item.porcentagem}%)"></div>`;
                    }).join('') : '<div class="w-full bg-gray-200 h-full" title="Sem tarefas concluídas ainda"></div>'}
                </div>
            </div>

            <!-- Grid com Métricas dos 5 Níveis -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                ${niveis.map(k => {
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
                                    <span class="text-gray-500" title="Tempo de execução ativa (In Progress até Done)">Cycle Time:</span>
                                    <span class="font-mono font-bold text-dark">${cycleNivelStr} ${cycleNivelStr !== '—' ? 'd' : ''}</span>
                                </div>
                                <div class="flex items-center justify-between text-gray-600">
                                    <span class="text-gray-500" title="Tempo total do fluxo (Criação até Done)">Lead Time:</span>
                                    <span class="font-mono text-gray-700">${leadNivelStr} ${leadNivelStr !== '—' ? 'd' : ''}</span>
                                </div>
                                <div class="flex items-center justify-between text-gray-400 text-[10px]">
                                    <span>Fatia do todo:</span>
                                    <span class="font-mono font-semibold text-gray-600">${item.porcentagem}%</span>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>

            <!-- Dica de Planejamento -->
            <div class="mt-4 pt-3 border-t border-beige/60 flex items-center gap-2 text-xs text-gray-500 font-sans">
                <span class="shrink-0 text-base">💡</span>
                <p class="leading-relaxed">
                    <strong>Dica de Planejamento:</strong> Multiplique a quantidade estimada de cada dificuldade pelo seu <em>Cycle Time real</em> para saber com precisão quantas tarefas cabem na sua próxima Sprint sem causar sobrecarga.
                </p>
            </div>
        </div>
    `;
}

export function abrirModalInfoMetricas(metricaInicial = 'cycle-time') {
    const modal = document.getElementById('modalInfoMetricas');
    if (!modal) return;
    selecionarAbaMetricaInfo(metricaInicial);
    modal.showModal();
}

export function fecharModalInfoMetricas() {
    const modal = document.getElementById('modalInfoMetricas');
    if (modal) modal.close();
}

export function selecionarAbaMetricaInfo(metrica) {
    const configAbas = {
        'cycle-time': { btnId: 'btn-tab-info-cycle', contentId: 'conteudo-info-cycle', borderClass: 'border-musgo', textClass: 'text-musgo' },
        'lead-time': { btnId: 'btn-tab-info-lead', contentId: 'conteudo-info-lead', borderClass: 'border-terracota', textClass: 'text-terracota' },
        'throughput': { btnId: 'btn-tab-info-throughput', contentId: 'conteudo-info-throughput', borderClass: 'border-dark', textClass: 'text-dark' },
        'dificuldade': { btnId: 'btn-tab-info-dificuldade', contentId: 'conteudo-info-dificuldade', borderClass: 'border-media', textClass: 'text-media' },
        'fluxo': { btnId: 'btn-tab-info-fluxo', contentId: 'conteudo-info-fluxo', borderClass: 'border-musgo', textClass: 'text-musgo' },
        'geral': { btnId: 'btn-tab-info-fluxo', contentId: 'conteudo-info-fluxo', borderClass: 'border-musgo', textClass: 'text-musgo' }
    };

    const alvo = configAbas[metrica] || configAbas['cycle-time'];

    // Oculta todas as seções de conteúdo
    document.querySelectorAll('.secao-info-metrica').forEach(el => el.classList.add('hidden'));

    // Reseta botões das abas
    document.querySelectorAll('.tab-metrica-btn').forEach(btn => {
        btn.classList.remove(
            'border-musgo', 'border-terracota', 'border-dark', 'border-media',
            'text-musgo', 'text-terracota', 'text-dark', 'text-media',
            'font-semibold'
        );
        btn.classList.add('border-transparent', 'text-gray-500', 'font-medium');
    });

    // Exibe a seção ativa
    const conteudo = document.getElementById(alvo.contentId);
    if (conteudo) conteudo.classList.remove('hidden');

    // Estiliza a aba ativa
    const btn = document.getElementById(alvo.btnId);
    if (btn) {
        btn.classList.remove('border-transparent', 'text-gray-500', 'font-medium');
        btn.classList.add(alvo.borderClass, alvo.textClass, 'font-semibold');
    }
}


// Exportação de Sprint em Markdown e CSV
export function gerarMarkdownSprint(hist) {
    const dataConclusao = formatarData(hist.closedAt ? hist.closedAt.split('T')[0] : hist.endDate);
    const entregas = hist.tasksDelivered || [];
    
    let md = `# Sprint: ${hist.sprintName}\n\n`;
    md += `- **Período:** ${formatarData(hist.startDate)} a ${formatarData(hist.endDate)}\n`;
    md += `- **Concluída em:** ${dataConclusao}\n`;
    md += `- **Total de Entregas:** ${entregas.length}\n`;

    if (hist.sprintDescription && hist.sprintDescription.trim()) {
        md += `\n### 🎯 Metas & Contexto da Sprint\n\n`;
        md += `${hist.sprintDescription.trim()}\n`;
    }

    if (hist.notes && hist.notes.trim()) {
        md += `\n### 📝 Observações & Notas de Fechamento\n\n`;
        md += `${hist.notes.trim()}\n`;
    }

    md += `\n### 📦 Entregas Realizadas\n\n`;
    if (entregas.length > 0) {
        entregas.forEach(t => {
            const proj = t.project ? ` [${t.project}]` : '';
            const prio = t.priority ? ` *(Prioridade: ${t.priority.toUpperCase()})*` : '';
            const difNome = DIFICULDADE_CONFIG[t.difficulty]?.label || t.difficulty || 'Média';
            const dif = ` *(Dificuldade: ${difNome})*`;
            md += `- [x] **${t.title}**${proj}${prio}${dif}\n`;
        });
    } else {
        md += `*Nenhuma tarefa registrada como concluída neste ciclo.*\n`;
    }

    md += `\n---\n*Exportado pelo Scrumban Pessoal em ${new Date().toLocaleDateString('pt-BR')}*\n`;
    return md;
}

export async function copiarMarkdownSprint(histId) {
    const hist = (appState.history || []).find(h => h.id === histId);
    if (!hist) {
        mostrarToast('Sprint não encontrada no histórico.', 'erro');
        return;
    }

    const markdown = gerarMarkdownSprint(hist);

    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(markdown);
        } else {
            const tempTa = document.createElement('textarea');
            tempTa.value = markdown;
            tempTa.style.position = 'fixed';
            tempTa.style.left = '-9999px';
            tempTa.style.top = '0';
            document.body.appendChild(tempTa);
            tempTa.focus();
            tempTa.select();
            const copiou = document.execCommand('copy');
            document.body.removeChild(tempTa);
            if (!copiou) throw new Error('execCommand falhou');
        }
        mostrarToast(`Resumo da sprint "${hist.sprintName}" copiado em Markdown!`, 'sucesso');
    } catch (err) {
        console.error('Erro ao copiar Markdown:', err);
        mostrarToast('Não foi possível copiar para a área de transferência.', 'erro');
    }
}

export function baixarCsvSprint(histId) {
    const hist = (appState.history || []).find(h => h.id === histId);
    if (!hist) {
        mostrarToast('Sprint não encontrada no histórico.', 'erro');
        return;
    }

    const colunas = [
        'ID da Tarefa',
        'Título',
        'Projeto',
        'Prioridade',
        'Dificuldade',
        'Data Criação',
        'Data Início',
        'Data Conclusão',
        'Sprint',
        'Notas da Sprint'
    ];

    const escapeCsv = (val) => {
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
    };

    const linhas = [colunas.map(escapeCsv).join(';')];

    (hist.tasksDelivered || []).forEach(t => {
        const linha = [
            t.id || '',
            t.title || '',
            t.project || 'Geral',
            (t.priority || '').toUpperCase(),
            DIFICULDADE_CONFIG[t.difficulty]?.label || t.difficulty || 'Média',
            t.createdAt ? formatarData(t.createdAt.split('T')[0]) : '',
            t.startedAt ? formatarData(t.startedAt.split('T')[0]) : '',
            t.completedAt ? formatarData(t.completedAt.split('T')[0]) : '',
            hist.sprintName || '',
            hist.notes || ''
        ];
        linhas.push(linha.map(escapeCsv).join(';'));
    });

    const conteudoCsv = '\uFEFF' + linhas.join('\r\n');
    const blob = new Blob([conteudoCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const slug = (hist.sprintName || 'sprint').toLowerCase().replace(/[^a-z0-9_-]/gi, '_');
    link.href = url;
    link.download = `entregas-${slug}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    mostrarToast(`CSV da sprint "${hist.sprintName}" baixado com sucesso!`, 'sucesso');
}
