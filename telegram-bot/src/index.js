/**
 * Scrumban — Bot do Telegram & API de Acesso Remoto (Cloudflare Worker + D1)
 *
 * Rotas:
 *   POST /telegram/webhook   Updates do Telegram (validado por secret_token + whitelist de usuário)
 *   GET  /api/inbox          Operações pendentes para o desktop aplicar         (Bearer API_KEY)
 *   POST /api/inbox/ack      { ids: [] } remove operações já aplicadas            (Bearer API_KEY)
 *   GET  /api/snapshot       Última fotografia do quadro                          (Bearer API_KEY)
 *   PUT  /api/snapshot       Desktop publica a fotografia do quadro               (Bearer API_KEY)
 *   GET  /health             Verificação simples
 */

import { parseMensagemTarefa, parseColuna, hojeISO, normalizar } from './parser.js';

const COLUNAS = ['backlog', 'todo', 'progress', 'testing', 'done'];
const COLUNA_NOMES = {
    backlog: '📥 Backlog',
    todo: '📋 TODO',
    progress: '🔥 In Progress',
    testing: '🧪 Testing',
    done: '✅ Done'
};
const PRIORIDADE_ICONE = { alta: '🔴', media: '🟡', baixa: '🟢' };
const MAX_SNAPSHOT_BYTES = 1_000_000;
const MAX_ITENS_LISTA = 25;

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400'
};

// ============================ HTTP ============================

function json(body, status = 200, extra = {}) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS, ...extra }
    });
}

function erro(status, mensagem) {
    return json({ error: mensagem }, status);
}

async function compararSeguro(a, b) {
    const enc = new TextEncoder();
    const [ha, hb] = await Promise.all([
        crypto.subtle.digest('SHA-256', enc.encode(String(a))),
        crypto.subtle.digest('SHA-256', enc.encode(String(b)))
    ]);
    const va = new Uint8Array(ha);
    const vb = new Uint8Array(hb);
    let diff = 0;
    for (let i = 0; i < va.length; i++) diff |= va[i] ^ vb[i];
    return diff === 0;
}

async function autorizadoApi(request, env) {
    if (!env.API_KEY) return false;
    const header = request.headers.get('Authorization') || '';
    const m = header.match(/^Bearer\s+(.+)$/i);
    return !!m && compararSeguro(m[1].trim(), env.API_KEY);
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const { pathname } = url;

        if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
        if (pathname === '/health') return json({ ok: true });

        try {
            if (pathname === '/telegram/webhook' && request.method === 'POST') {
                return await handleWebhook(request, env);
            }

            if (pathname.startsWith('/api/')) {
                if (!(await autorizadoApi(request, env))) return erro(401, 'Não autorizado');

                if (pathname === '/api/inbox' && request.method === 'GET') return await apiListarInbox(env);
                if (pathname === '/api/inbox/ack' && request.method === 'POST') return await apiAckInbox(request, env);
                if (pathname === '/api/snapshot' && request.method === 'GET') return await apiObterSnapshot(env);
                if (pathname === '/api/snapshot' && request.method === 'PUT') return await apiSalvarSnapshot(request, env);
            }
            return erro(404, 'Rota não encontrada');
        } catch (e) {
            console.error('Erro não tratado:', e && e.stack || e);
            return erro(500, 'Erro interno');
        }
    }
};

// ============================ API ============================

async function listarInbox(env) {
    const { results } = await env.DB.prepare(
        'SELECT id, type, payload, source, created_at FROM inbox ORDER BY created_at ASC, rowid ASC'
    ).all();
    return (results || []).map(r => ({
        id: r.id,
        type: r.type,
        payload: JSON.parse(r.payload),
        source: r.source,
        createdAt: r.created_at
    }));
}

async function apiListarInbox(env) {
    return json({ items: await listarInbox(env) });
}

async function apiAckInbox(request, env) {
    let body;
    try { body = await request.json(); } catch { return erro(400, 'JSON inválido'); }
    const ids = Array.isArray(body && body.ids) ? body.ids.filter(i => typeof i === 'string').slice(0, 500) : null;
    if (!ids) return erro(400, 'Campo "ids" deve ser uma lista de strings');
    if (ids.length === 0) return json({ removed: 0 });

    const stmt = env.DB.prepare('DELETE FROM inbox WHERE id = ?');
    const res = await env.DB.batch(ids.map(id => stmt.bind(id)));
    const removed = res.reduce((acc, r) => acc + ((r.meta && r.meta.changes) || 0), 0);
    return json({ removed });
}

async function obterSnapshot(env) {
    const row = await env.DB.prepare('SELECT data, updated_at FROM snapshot WHERE id = 1').first();
    if (!row) return null;
    return { ...JSON.parse(row.data), receivedAt: row.updated_at };
}

async function apiObterSnapshot(env) {
    const snap = await obterSnapshot(env);
    return snap ? json(snap) : erro(404, 'Nenhum snapshot publicado ainda');
}

function validarSnapshot(s) {
    if (!s || typeof s !== 'object' || Array.isArray(s)) return 'Snapshot deve ser um objeto';
    if (!Array.isArray(s.tasks)) return 'Campo "tasks" deve ser uma lista';
    if (s.projects !== undefined && !Array.isArray(s.projects)) return 'Campo "projects" deve ser uma lista';
    for (const t of s.tasks) {
        if (!t || typeof t.id !== 'string' || typeof t.title !== 'string') return 'Tarefa sem id/título válido';
        if (!COLUNAS.includes(t.column)) return `Coluna inválida: ${t.column}`;
    }
    return null;
}

async function apiSalvarSnapshot(request, env) {
    const raw = await request.text();
    if (raw.length > MAX_SNAPSHOT_BYTES) return erro(413, 'Snapshot excede 1MB');
    let snap;
    try { snap = JSON.parse(raw); } catch { return erro(400, 'JSON inválido'); }
    const problema = validarSnapshot(snap);
    if (problema) return erro(400, problema);

    const agora = new Date().toISOString();
    await env.DB.prepare(
        'INSERT INTO snapshot (id, data, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at'
    ).bind(raw, agora).run();
    return json({ ok: true, receivedAt: agora, tasks: snap.tasks.length });
}

// ============================ TELEGRAM ============================

function escaparHtml(str) {
    return String(str ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

/** Resposta inline ao webhook: o Telegram executa o método sem uma chamada extra à API. */
function responderTelegram(chatId, texto) {
    let text = texto;
    if (text.length > 4000) text = text.slice(0, 3990) + '\n…';
    return json({ method: 'sendMessage', chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true });
}

function usuarioPermitido(env, userId) {
    const lista = String(env.TELEGRAM_ALLOWED_USER_ID || '')
        .split(',').map(s => s.trim()).filter(Boolean);
    return lista.length > 0 && lista.includes(String(userId));
}

async function handleWebhook(request, env) {
    // 1) Autenticidade: só o Telegram conhece o secret_token registrado no setWebhook
    const secret = request.headers.get('X-Telegram-Bot-Api-Secret-Token') || '';
    if (!env.TELEGRAM_WEBHOOK_SECRET || !(await compararSeguro(secret, env.TELEGRAM_WEBHOOK_SECRET))) {
        return erro(401, 'Não autorizado');
    }

    let update;
    try { update = await request.json(); } catch { return json({ ok: true }); }

    const msg = update.message || update.edited_message;
    if (!msg || !msg.chat) return json({ ok: true });

    // 2) Whitelist: mensagens de terceiros são ignoradas silenciosamente
    if (!msg.from || !usuarioPermitido(env, msg.from.id)) return json({ ok: true });

    // 3) Idempotência: Telegram reenvia o mesmo update_id em caso de erro/timeout
    if (typeof update.update_id === 'number') {
        const r = await env.DB.prepare('INSERT OR IGNORE INTO processed_updates (update_id, created_at) VALUES (?, ?)')
            .bind(update.update_id, new Date().toISOString()).run();
        if (r.meta && r.meta.changes === 0) return json({ ok: true });
        // Mantém a tabela pequena: o Telegram só reenvia updates por até 24h
        const limite = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
        await env.DB.prepare('DELETE FROM processed_updates WHERE created_at < ?').bind(limite).run();
    }

    // edited_message não gera tarefa nova (evita duplicatas ao corrigir um typo)
    if (update.edited_message) {
        return responderTelegram(msg.chat.id, 'ℹ️ Edições não alteram tarefas já capturadas. Use /desfazer e envie novamente.');
    }

    const texto = (msg.text || msg.caption || '').trim();
    if (!texto) {
        return responderTelegram(msg.chat.id, 'Por enquanto só entendo mensagens de texto. Envie /ajuda para ver os comandos.');
    }

    const resposta = await processarTexto(texto, env);
    return responderTelegram(msg.chat.id, resposta);
}

async function processarTexto(texto, env) {
    const m = texto.match(/^\/([a-zA-Z_]+)(?:@\w+)?(?:\s+([\s\S]*))?$/);
    if (!m) return comandoNova(texto, env);

    const cmd = m[1].toLowerCase();
    const args = (m[2] || '').trim();
    switch (cmd) {
        case 'start':
        case 'ajuda':
        case 'help': return textoAjuda();
        case 'nova':
        case 'n': return args ? comandoNova(args, env) : 'Uso: <code>/nova Título #Projeto !alta @amanha</code>';
        case 'quadro': return comandoQuadro(env);
        case 'foco': return comandoListarColunas(env, ['progress', 'testing'], '🔥 <b>Em foco</b>');
        case 'todo': return comandoListarColunas(env, ['todo'], '📋 <b>TODO</b>');
        case 'backlog': return comandoListarColunas(env, ['backlog'], '📥 <b>Backlog</b>');
        case 'hoje': return comandoPrazos(env, 'hoje');
        case 'atrasadas': return comandoPrazos(env, 'atrasadas');
        case 'buscar': return comandoBuscar(env, args);
        case 'ver': return comandoVer(env, args);
        case 'mover': return comandoMover(env, args);
        case 'feito':
        case 'concluir': return comandoMover(env, `${args} done`);
        case 'iniciar': return comandoMover(env, `${args} progress`);
        case 'pendentes': return comandoPendentes(env);
        case 'desfazer': return comandoDesfazer(env);
        default: return `Comando /${escaparHtml(cmd)} desconhecido. Envie /ajuda.`;
    }
}

function textoAjuda() {
    return [
        '🗂️ <b>Scrumban Remoto</b>',
        '',
        '<b>Capturar tarefa</b> — envie qualquer texto:',
        '<code>Corrigir login #Meu Produto !alta @amanha</code>',
        '• <code>#Projeto</code>  • <code>!alta</code> <code>!media</code> <code>!baixa</code>',
        '• <code>~trivial</code> <code>~facil</code> <code>~media</code> <code>~dificil</code> <code>~muito_dificil</code>',
        '• <code>@hoje</code> <code>@amanha</code> <code>@+3</code> <code>@sex</code> <code>@25/09</code> <code>@2026-09-25</code>',
        '• Linhas após a primeira viram a descrição.',
        '',
        '<b>Consultar</b> (fotografia enviada pelo desktop):',
        '/quadro · /foco · /todo · /backlog · /hoje · /atrasadas',
        '/buscar <i>termo</i> · /ver <i>ref</i>',
        '',
        '<b>Agir</b> (aplicado quando o desktop sincronizar):',
        '/mover <i>ref coluna</i> · /iniciar <i>ref</i> · /feito <i>ref</i>',
        '/pendentes · /desfazer',
        '',
        'Colunas: backlog, todo, andamento, teste, feito.'
    ].join('\n');
}

// ---------- helpers de snapshot ----------

export function refDe(id) {
    return String(id).replace(/^task-/, '').replace(/-/g, '').slice(0, 6).toLowerCase();
}

function tempoRelativo(iso) {
    if (!iso) return 'desconhecido';
    const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (min < 1) return 'agora há pouco';
    if (min < 60) return `há ${min} min`;
    const h = Math.round(min / 60);
    if (h < 48) return `há ${h}h`;
    return `há ${Math.round(h / 24)} dias`;
}

function rodapeSnapshot(snap) {
    return `\n<i>📸 Quadro sincronizado ${tempoRelativo(snap.generatedAt || snap.receivedAt)}</i>`;
}

const SEM_SNAPSHOT = '📭 O desktop ainda não publicou o quadro.\nAbra o Scrumban no PC com o Acesso Remoto configurado para sincronizar.';

function linhaTarefa(t, hoje) {
    const partes = [`<code>${refDe(t.id)}</code> ${PRIORIDADE_ICONE[t.priority] || '⚪'} ${escaparHtml(t.title)}`];
    if (t.project) partes.push(`<i>${escaparHtml(t.project)}</i>`);
    if (t.dueDate && t.column !== 'done') {
        if (t.dueDate < hoje) partes.push(`⏰ <b>atrasada (${formatarDataBR(t.dueDate)})</b>`);
        else if (t.dueDate === hoje) partes.push('⏰ hoje');
        else partes.push(`📅 ${formatarDataBR(t.dueDate)}`);
    }
    return partes.join(' · ');
}

function formatarDataBR(iso) {
    const [a, m, d] = String(iso).split('-');
    return d && m ? `${d}/${m}${a !== hojeISO().slice(0, 4) ? '/' + a : ''}` : iso;
}

function ordenar(tasks) {
    return [...tasks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function listar(tasks, hoje) {
    if (tasks.length === 0) return '<i>(vazio)</i>';
    const linhas = tasks.slice(0, MAX_ITENS_LISTA).map(t => linhaTarefa(t, hoje));
    if (tasks.length > MAX_ITENS_LISTA) linhas.push(`<i>… e mais ${tasks.length - MAX_ITENS_LISTA}</i>`);
    return linhas.join('\n');
}

// ---------- comandos ----------

async function comandoNova(texto, env) {
    const snap = await obterSnapshot(env);
    const projetos = (snap && Array.isArray(snap.projects)) ? snap.projects : [];
    const r = parseMensagemTarefa(texto, { projetos, timeZone: env.TIME_ZONE });
    if (!r.ok) return `⚠️ ${escaparHtml(r.erro)}`;

    const id = `task-${crypto.randomUUID()}`;
    const payload = { taskId: id, ...r.tarefa, createdAt: new Date().toISOString() };
    await env.DB.prepare('INSERT INTO inbox (id, type, payload, source, created_at) VALUES (?, ?, ?, ?, ?)')
        .bind(id, 'create', JSON.stringify(payload), 'telegram', payload.createdAt).run();

    const t = r.tarefa;
    const linhas = [
        `✅ <b>Capturada no Backlog</b> <code>${refDe(id)}</code>`,
        `📝 ${escaparHtml(t.title)}`,
        `📁 ${escaparHtml(t.project || (projetos[0] || 'Projeto padrão do desktop'))}`,
        `${PRIORIDADE_ICONE[t.priority]} Prioridade ${t.priority}`
    ];
    if (t.dueDate) linhas.push(`📅 Prazo ${formatarDataBR(t.dueDate)}`);
    if (t.description) linhas.push('🗒️ Com descrição');
    if (t.project && projetos.length && !projetos.includes(t.project)) {
        linhas.push(`<i>ℹ️ Projeto novo — será cadastrado no desktop.</i>`);
    }
    r.avisos.forEach(a => linhas.push(`⚠️ ${escaparHtml(a)}`));
    linhas.push('<i>Será importada quando o Scrumban desktop sincronizar.</i>');
    return linhas.join('\n');
}

async function comandoQuadro(env) {
    const snap = await obterSnapshot(env);
    if (!snap) return SEM_SNAPSHOT;
    const hoje = hojeISO(env.TIME_ZONE);
    const linhas = ['🗂️ <b>Quadro</b>'];
    if (snap.currentSprint) {
        linhas.push(`🏃 Sprint: <b>${escaparHtml(snap.currentSprint.name)}</b>${snap.currentSprint.endDate ? ` (até ${formatarDataBR(snap.currentSprint.endDate)})` : ''}`);
    }
    linhas.push('');
    for (const col of COLUNAS) {
        const n = snap.tasks.filter(t => t.column === col).length;
        const wip = col === 'progress' && snap.wipLimit ? ` / WIP ${snap.wipLimit}${n > snap.wipLimit ? ' ⚠️' : ''}` : '';
        linhas.push(`${COLUNA_NOMES[col]}: <b>${n}</b>${wip}`);
    }
    const atrasadas = snap.tasks.filter(t => t.column !== 'done' && t.dueDate && t.dueDate < hoje).length;
    if (atrasadas) linhas.push(`\n⏰ <b>${atrasadas}</b> atrasada(s) — /atrasadas`);
    const foco = ordenar(snap.tasks.filter(t => t.column === 'progress'));
    if (foco.length) linhas.push('\n🔥 <b>Em andamento</b>\n' + listar(foco, hoje));
    return linhas.join('\n') + rodapeSnapshot(snap);
}

async function comandoListarColunas(env, colunas, titulo) {
    const snap = await obterSnapshot(env);
    if (!snap) return SEM_SNAPSHOT;
    const hoje = hojeISO(env.TIME_ZONE);
    const blocos = [titulo];
    for (const col of colunas) {
        const tasks = ordenar(snap.tasks.filter(t => t.column === col));
        if (colunas.length > 1) blocos.push(`\n${COLUNA_NOMES[col]} (${tasks.length})`);
        blocos.push(listar(tasks, hoje));
    }
    return blocos.join('\n') + rodapeSnapshot(snap);
}

async function comandoPrazos(env, modo) {
    const snap = await obterSnapshot(env);
    if (!snap) return SEM_SNAPSHOT;
    const hoje = hojeISO(env.TIME_ZONE);
    const abertas = snap.tasks.filter(t => t.column !== 'done' && t.dueDate);
    const atrasadas = abertas.filter(t => t.dueDate < hoje).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    if (modo === 'atrasadas') {
        return `⏰ <b>Atrasadas (${atrasadas.length})</b>\n` + listar(atrasadas, hoje) + rodapeSnapshot(snap);
    }
    const deHoje = abertas.filter(t => t.dueDate === hoje);
    return `📅 <b>Vencem hoje (${deHoje.length})</b>\n${listar(deHoje, hoje)}\n\n⏰ <b>Atrasadas (${atrasadas.length})</b>\n${listar(atrasadas, hoje)}` + rodapeSnapshot(snap);
}

async function comandoBuscar(env, termo) {
    if (!termo) return 'Uso: <code>/buscar termo</code>';
    const snap = await obterSnapshot(env);
    if (!snap) return SEM_SNAPSHOT;
    const n = normalizar(termo);
    const achadas = snap.tasks.filter(t =>
        normalizar(t.title).includes(n) || normalizar(t.description).includes(n) || normalizar(t.project).includes(n)
    );
    return `🔎 <b>${achadas.length} resultado(s)</b> para “${escaparHtml(termo)}”\n` + listar(achadas, hojeISO(env.TIME_ZONE)) + rodapeSnapshot(snap);
}

/** Resolve uma ref curta em uma tarefa do snapshot ou em uma criação ainda pendente. */
async function resolverRef(env, ref) {
    const r = normalizar(ref).replace(/^#/, '').replace(/-/g, '');
    if (r.length < 4 || !/^[0-9a-f]+$/.test(r)) return { erro: 'Informe a ref (4+ caracteres) mostrada nas listas, ex.: <code>a1b2c3</code>.' };

    const snap = await obterSnapshot(env);
    const candidatas = new Map();
    for (const t of (snap ? snap.tasks : [])) {
        if (String(t.id).replace(/^task-/, '').replace(/-/g, '').toLowerCase().startsWith(r)) candidatas.set(t.id, t);
    }
    for (const op of await listarInbox(env)) {
        if (op.type === 'create' && op.id.replace(/^task-/, '').replace(/-/g, '').toLowerCase().startsWith(r)) {
            candidatas.set(op.id, { id: op.id, title: op.payload.title, column: 'backlog', pendente: true });
        }
    }
    if (candidatas.size === 0) return { erro: `Nenhuma tarefa com ref <code>${escaparHtml(r)}</code>.` };
    if (candidatas.size > 1) return { erro: `Ref <code>${escaparHtml(r)}</code> é ambígua (${candidatas.size} tarefas). Use mais caracteres.` };
    return { tarefa: [...candidatas.values()][0], snap };
}

async function comandoVer(env, ref) {
    if (!ref) return 'Uso: <code>/ver ref</code>';
    const { erro: e, tarefa: t, snap } = await resolverRef(env, ref);
    if (e) return e;
    const linhas = [
        `<code>${refDe(t.id)}</code> <b>${escaparHtml(t.title)}</b>`,
        `Coluna: ${COLUNA_NOMES[t.column] || t.column}${t.pendente ? ' <i>(pendente de sincronização)</i>' : ''}`
    ];
    if (t.project) linhas.push(`Projeto: ${escaparHtml(t.project)}`);
    if (t.priority) linhas.push(`Prioridade: ${PRIORIDADE_ICONE[t.priority] || ''} ${t.priority}`);
    if (t.dueDate) linhas.push(`Prazo: ${formatarDataBR(t.dueDate)}`);
    if (t.subtasks && t.subtasks.total) linhas.push(`Checklist: ${t.subtasks.done}/${t.subtasks.total}`);
    if (t.description) linhas.push(`\n${escaparHtml(t.description)}`);
    return linhas.join('\n') + (snap && !t.pendente ? rodapeSnapshot(snap) : '');
}

async function comandoMover(env, args) {
    const partes = args.trim().split(/\s+/).filter(Boolean);
    if (partes.length < 2) return 'Uso: <code>/mover ref coluna</code> (backlog, todo, andamento, teste, feito)';
    const coluna = parseColuna(partes.slice(1).join(''));
    if (!coluna) return `Coluna “${escaparHtml(partes.slice(1).join(' '))}” desconhecida. Use: backlog, todo, andamento, teste, feito.`;

    const { erro: e, tarefa: t } = await resolverRef(env, partes[0]);
    if (e) return e;
    if (t.column === coluna && !t.pendente) return `ℹ️ “${escaparHtml(t.title)}” já está em ${COLUNA_NOMES[coluna]}.`;

    const id = `op-${crypto.randomUUID()}`;
    const agora = new Date().toISOString();
    await env.DB.prepare('INSERT INTO inbox (id, type, payload, source, created_at) VALUES (?, ?, ?, ?, ?)')
        .bind(id, 'move', JSON.stringify({ taskId: t.id, column: coluna, requestedAt: agora }), 'telegram', agora).run();

    return `🔀 “${escaparHtml(t.title)}” → ${COLUNA_NOMES[coluna]}\n<i>Será aplicado quando o desktop sincronizar.</i>`;
}

async function comandoPendentes(env) {
    const itens = await listarInbox(env);
    if (itens.length === 0) return '📭 Nenhuma operação pendente — o desktop está em dia.';
    const linhas = itens.slice(0, MAX_ITENS_LISTA).map(op => {
        if (op.type === 'create') return `➕ <code>${refDe(op.id)}</code> ${escaparHtml(op.payload.title)}`;
        if (op.type === 'move') return `🔀 <code>${refDe(op.payload.taskId)}</code> → ${COLUNA_NOMES[op.payload.column] || op.payload.column}`;
        return `• ${escaparHtml(op.type)}`;
    });
    if (itens.length > MAX_ITENS_LISTA) linhas.push(`<i>… e mais ${itens.length - MAX_ITENS_LISTA}</i>`);
    return `⏳ <b>${itens.length} pendente(s)</b> aguardando o desktop\n` + linhas.join('\n');
}

async function comandoDesfazer(env) {
    const ultimo = await env.DB.prepare(
        "SELECT id, type, payload FROM inbox WHERE source = 'telegram' ORDER BY created_at DESC, rowid DESC LIMIT 1"
    ).first();
    if (!ultimo) return '📭 Nada para desfazer (o desktop já pode ter sincronizado).';
    await env.DB.prepare('DELETE FROM inbox WHERE id = ?').bind(ultimo.id).run();
    const p = JSON.parse(ultimo.payload);
    // Se desfez uma criação, remove também movimentos pendentes dessa tarefa
    if (ultimo.type === 'create') {
        await env.DB.prepare("DELETE FROM inbox WHERE type = 'move' AND json_extract(payload, '$.taskId') = ?").bind(ultimo.id).run();
        return `↩️ Captura desfeita: “${escaparHtml(p.title)}”.`;
    }
    return `↩️ Movimento desfeito (${COLUNA_NOMES[p.column] || p.column}).`;
}
