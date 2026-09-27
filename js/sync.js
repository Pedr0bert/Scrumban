/**
 * Scrumban Pessoal - Acesso Remoto (Telegram / App Mobile)
 * Modulo ES: importa operações da Inbox remota (Cloudflare Worker) e publica
 * uma fotografia somente-leitura do quadro para consultas remotas.
 *
 * O desktop continua sendo a fonte da verdade: o servidor só guarda uma fila de
 * operações ('create' | 'move') e o último snapshot publicado.
 * A configuração fica em localStorage próprio — fora do appState — para que o
 * token NÃO seja incluído nos backups JSON exportados.
 */

import { appState, COLUNAS, escapeHTML } from './state.js';
import { saveState, registrarObservadorSalvamento } from './storage.js';
import { mostrarToast, atualizarFiltrosUI } from './ui.js';
import { renderizarQuadro } from './kanban.js';

const SYNC_CONFIG_KEY = 'scrumban_sync_config';
const INTERVALO_MIN_FOCO_MS = 30 * 1000;
const DEBOUNCE_SNAPSHOT_MS = 8 * 1000;
const TIMEOUT_REDE_MS = 15 * 1000;
const PRIORIDADES = ['alta', 'media', 'baixa'];
const DIFICULDADES = ['trivial', 'facil', 'media', 'dificil', 'muito_dificil'];

let sincronizando = false;
let ultimaTentativa = 0;
let timerSnapshot = null;
let aplicandoRemoto = false;

// ================= CONFIGURAÇÃO =================

export function obterConfigSync() {
    try {
        const raw = localStorage.getItem(SYNC_CONFIG_KEY);
        const cfg = raw ? JSON.parse(raw) : {};
        return {
            endpoint: typeof cfg.endpoint === 'string' ? cfg.endpoint : '',
            token: typeof cfg.token === 'string' ? cfg.token : '',
            auto: cfg.auto !== false,
            lastSyncAt: cfg.lastSyncAt || null,
            lastError: cfg.lastError || null
        };
    } catch {
        return { endpoint: '', token: '', auto: true, lastSyncAt: null, lastError: null };
    }
}

function gravarConfigSync(parcial) {
    const cfg = { ...obterConfigSync(), ...parcial };
    localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(cfg));
    return cfg;
}

function syncConfigurado(cfg = obterConfigSync()) {
    return !!(cfg.endpoint && cfg.token);
}

function normalizarEndpoint(url) {
    return String(url || '').trim().replace(/\/+$/, '').replace(/\/api(\/inbox)?$/, '');
}

// ================= REDE =================

async function chamarApi(caminho, { method = 'GET', body } = {}, cfg = obterConfigSync()) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_REDE_MS);
    try {
        const resp = await fetch(`${cfg.endpoint}${caminho}`, {
            method,
            headers: {
                'Authorization': `Bearer ${cfg.token}`,
                ...(body !== undefined ? { 'Content-Type': 'application/json' } : {})
            },
            body: body !== undefined ? JSON.stringify(body) : undefined,
            signal: controller.signal
        });
        const dados = await resp.json().catch(() => ({}));
        if (!resp.ok) {
            const msg = resp.status === 401 ? 'Token inválido (401)' : (dados.error || `HTTP ${resp.status}`);
            throw new Error(msg);
        }
        return dados;
    } catch (e) {
        if (e.name === 'AbortError') throw new Error('Tempo de conexão esgotado');
        throw e;
    } finally {
        clearTimeout(timer);
    }
}

// ================= APLICAÇÃO DE OPERAÇÕES =================

function reindexarColuna(coluna) {
    appState.tasks
        .filter(t => t.column === coluna)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .forEach((t, idx) => { t.order = idx; });
}

function aplicarCriacao(op) {
    const p = op.payload || {};
    const id = typeof p.taskId === 'string' ? p.taskId : op.id;
    // Idempotente: se um ACK anterior falhou, a tarefa já existe e não é duplicada
    if (appState.tasks.some(t => t.id === id)) return { ok: true, duplicada: true };

    const titulo = String(p.title || '').trim().slice(0, 300);
    if (!titulo) return { ok: false, motivo: 'sem título' };

    let projeto = typeof p.project === 'string' && p.project.trim() ? p.project.trim().slice(0, 80) : null;
    if (!projeto) projeto = appState.settings.projects[0] || 'Geral';
    let projetoNovo = false;
    if (!appState.settings.projects.includes(projeto)) {
        appState.settings.projects.push(projeto);
        projetoNovo = true;
    }

    const curSprint = appState.sprints.find(s => s.status === 'current');
    appState.tasks.forEach(t => { if (t.column === 'backlog') t.order = (t.order ?? 0) + 1; });
    appState.tasks.unshift({
        id,
        title: titulo,
        description: String(p.description || '').slice(0, 4000),
        priority: PRIORIDADES.includes(p.priority) ? p.priority : 'media',
        difficulty: DIFICULDADES.includes(p.difficulty) ? p.difficulty : 'media',
        column: 'backlog',
        order: 0,
        project: projeto,
        dueDate: /^\d{4}-\d{2}-\d{2}$/.test(p.dueDate || '') ? p.dueDate : '',
        subtasks: [],
        images: [],
        parentId: null,
        sprintId: curSprint ? curSprint.id : null,
        createdAt: p.createdAt || op.createdAt || new Date().toISOString(),
        source: op.source || 'remoto'
    });
    return { ok: true, projetoNovo };
}

function aplicarMovimento(op) {
    const p = op.payload || {};
    const tarefa = appState.tasks.find(t => t.id === p.taskId);
    if (!tarefa) return { ok: false, motivo: 'tarefa não encontrada (arquivada ou excluída?)' };
    if (!COLUNAS.includes(p.column)) return { ok: false, motivo: `coluna inválida "${p.column}"` };

    const antiga = tarefa.column;
    if (antiga === p.column) return { ok: true };

    tarefa.column = p.column;
    if (p.column === 'progress' && !tarefa.startedAt) tarefa.startedAt = p.requestedAt || new Date().toISOString();
    if (p.column === 'done') tarefa.completedAt = p.requestedAt || new Date().toISOString();
    else if (antiga === 'done') delete tarefa.completedAt;

    // Entra no fim da coluna de destino (mesma regra do drop sem posição específica)
    const maxOrdem = appState.tasks
        .filter(t => t.column === p.column && t.id !== tarefa.id)
        .reduce((m, t) => Math.max(m, t.order ?? 0), -1);
    tarefa.order = maxOrdem + 1;
    reindexarColuna(antiga);
    reindexarColuna(p.column);
    return { ok: true };
}

// ================= SNAPSHOT =================

export function montarSnapshot() {
    const cur = appState.sprints.find(s => s.status === 'current');
    return {
        version: 1,
        generatedAt: new Date().toISOString(),
        projects: [...appState.settings.projects],
        wipLimit: appState.settings.wipLimit,
        currentSprint: cur ? { id: cur.id, name: cur.name, endDate: cur.endDate || null } : null,
        tasks: appState.tasks.map(t => ({
            id: t.id,
            title: t.title,
            column: t.column,
            priority: t.priority || 'media',
            difficulty: t.difficulty || 'media',
            project: t.project || '',
            dueDate: t.dueDate || '',
            parentId: t.parentId || null,
            order: t.order ?? 0,
            description: (t.description || '').slice(0, 500),
            subtasks: {
                done: (t.subtasks || []).filter(s => s.done).length,
                total: (t.subtasks || []).length
            }
        }))
    };
}

export async function publicarSnapshot() {
    const cfg = obterConfigSync();
    if (!syncConfigurado(cfg)) return false;
    clearTimeout(timerSnapshot);
    timerSnapshot = null;
    await chamarApi('/api/snapshot', { method: 'PUT', body: montarSnapshot() }, cfg);
    return true;
}

function agendarPublicacaoSnapshot() {
    if (aplicandoRemoto) return;
    const cfg = obterConfigSync();
    if (!syncConfigurado(cfg) || !cfg.auto) return;
    clearTimeout(timerSnapshot);
    timerSnapshot = setTimeout(() => {
        publicarSnapshot().catch(e => console.warn('Scrumban sync: falha ao publicar snapshot:', e.message));
    }, DEBOUNCE_SNAPSHOT_MS);
}

// ================= CICLO DE SINCRONIZAÇÃO =================

/**
 * Busca a inbox remota, aplica as operações em ordem, persiste, confirma (ACK)
 * e publica o snapshot atualizado.
 */
export async function sincronizarRemoto({ silencioso = false } = {}) {
    const cfg = obterConfigSync();
    if (!syncConfigurado(cfg)) {
        if (!silencioso) mostrarToast('Configure o endpoint e o token do Acesso Remoto em Configurações.', 'erro');
        return;
    }
    if (sincronizando) return;
    sincronizando = true;
    ultimaTentativa = Date.now();
    atualizarStatusSyncUI('Sincronizando…');

    try {
        const { items = [] } = await chamarApi('/api/inbox', {}, cfg);
        const aplicadas = [];
        const falhas = [];
        let criadas = 0;
        let movidas = 0;
        let projetosNovos = false;

        aplicandoRemoto = true;
        for (const op of items) {
            let r;
            if (op.type === 'create') r = aplicarCriacao(op);
            else if (op.type === 'move') r = aplicarMovimento(op);
            else r = { ok: false, motivo: `tipo desconhecido "${op.type}"` };

            // Falhas permanentes também são confirmadas para não travar a fila
            aplicadas.push(op.id);
            if (r.ok) {
                if (op.type === 'create' && !r.duplicada) criadas++;
                if (op.type === 'move') movidas++;
                if (r.projetoNovo) projetosNovos = true;
            } else {
                falhas.push(`${op.type}: ${r.motivo}`);
            }
        }

        if (criadas || movidas) {
            await saveState(); // persiste ANTES do ACK: nenhuma operação se perde
        }
        aplicandoRemoto = false;

        if (aplicadas.length) {
            await chamarApi('/api/inbox/ack', { method: 'POST', body: { ids: aplicadas } }, cfg);
        }

        if (criadas || movidas) {
            if (projetosNovos) atualizarFiltrosUI();
            renderizarQuadro();
            const partes = [];
            if (criadas) partes.push(`${criadas} nova(s) tarefa(s)`);
            if (movidas) partes.push(`${movidas} movimentação(ões)`);
            mostrarToast(`📥 Remoto: ${partes.join(' e ')} importada(s).`, 'sucesso', 5000);
        } else if (!silencioso) {
            mostrarToast('Inbox remota vazia — tudo em dia.', 'info', 2500);
        }
        if (falhas.length) {
            console.warn('Scrumban sync: operações ignoradas:', falhas);
            mostrarToast(`${falhas.length} operação(ões) remota(s) ignorada(s): ${falhas[0]}`, 'aviso', 6000);
        }

        await publicarSnapshot();
        gravarConfigSync({ lastSyncAt: new Date().toISOString(), lastError: null });
        atualizarStatusSyncUI();
    } catch (e) {
        aplicandoRemoto = false;
        console.warn('Scrumban sync falhou:', e);
        gravarConfigSync({ lastError: e.message || String(e) });
        atualizarStatusSyncUI();
        if (!silencioso) mostrarToast(`Falha na sincronização remota: ${e.message}`, 'erro', 6000);
    } finally {
        sincronizando = false;
    }
}

// ================= UI (Aba Configurações) =================

export function renderizarConfigSync() {
    const cfg = obterConfigSync();
    const elEndpoint = document.getElementById('configSyncEndpoint');
    const elToken = document.getElementById('configSyncToken');
    const elAuto = document.getElementById('configSyncAuto');
    if (elEndpoint) elEndpoint.value = cfg.endpoint;
    if (elToken) elToken.value = cfg.token;
    if (elAuto) elAuto.checked = cfg.auto;
    atualizarStatusSyncUI();
}

export function salvarConfigSync() {
    const endpoint = normalizarEndpoint(document.getElementById('configSyncEndpoint')?.value);
    const token = (document.getElementById('configSyncToken')?.value || '').trim();
    const auto = !!document.getElementById('configSyncAuto')?.checked;

    if (endpoint && !/^https:\/\//i.test(endpoint) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(endpoint)) {
        mostrarToast('Use uma URL HTTPS (HTTP só é aceito para localhost).', 'erro');
        return;
    }
    gravarConfigSync({ endpoint, token, auto, lastError: null });
    renderizarConfigSync();
    mostrarToast(endpoint && token ? 'Acesso remoto configurado.' : 'Acesso remoto desativado.', 'sucesso');
    if (endpoint && token) sincronizarRemoto({ silencioso: false });
}

export function removerConfigSync() {
    localStorage.removeItem(SYNC_CONFIG_KEY);
    renderizarConfigSync();
    mostrarToast('Configuração de acesso remoto removida deste dispositivo.', 'info');
}

function atualizarStatusSyncUI(textoForcado) {
    const el = document.getElementById('configSyncStatus');
    if (!el) return;
    const cfg = obterConfigSync();
    let html;
    if (textoForcado) html = escapeHTML(textoForcado);
    else if (!syncConfigurado(cfg)) html = 'Não configurado';
    else if (cfg.lastError) html = `<span class="text-terracota">Erro: ${escapeHTML(cfg.lastError)}</span>`;
    else if (cfg.lastSyncAt) html = `Última sincronização: ${escapeHTML(new Date(cfg.lastSyncAt).toLocaleString('pt-BR'))}`;
    else html = 'Configurado — ainda não sincronizado';
    el.innerHTML = html;
}

// ================= BOOTSTRAP =================

export function inicializarSync() {
    registrarObservadorSalvamento(agendarPublicacaoSnapshot);

    const cfg = obterConfigSync();
    if (syncConfigurado(cfg) && cfg.auto) {
        sincronizarRemoto({ silencioso: true });
    }

    window.addEventListener('focus', () => {
        const atual = obterConfigSync();
        if (!syncConfigurado(atual) || !atual.auto) return;
        if (Date.now() - ultimaTentativa < INTERVALO_MIN_FOCO_MS) return;
        sincronizarRemoto({ silencioso: true });
    });
}
