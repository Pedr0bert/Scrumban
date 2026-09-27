/**
 * Parser de mensagens rápidas do Telegram → tarefa do Scrumban.
 *
 * Sintaxe (tags podem aparecer em qualquer posição da 1ª linha):
 *   #Projeto        → projeto (casa com projetos conhecidos, aceita espaços; senão 1 palavra, "_" vira espaço)
 *   !alta|!media|!baixa (ou !a, !m, !b)  → prioridade
 *   ~trivial|~facil|~media|~dificil|~muito_dificil → dificuldade
 *   @hoje | @amanha | @+3 | @seg..@dom | @25/09 | @25/09/2026 | @2026-09-25 → prazo
 * Linhas seguintes à primeira viram a descrição.
 */

const PRIORIDADES = {
    alta: 'alta', a: 'alta',
    media: 'media', m: 'media',
    baixa: 'baixa', b: 'baixa'
};

const DIFICULDADES = {
    trivial: 'trivial',
    facil: 'facil',
    media: 'media',
    dificil: 'dificil',
    muito_dificil: 'muito_dificil', muitodificil: 'muito_dificil'
};

const DIAS_SEMANA = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6 };

export function normalizar(str) {
    return String(str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

/** Data de "hoje" (YYYY-MM-DD) no fuso informado. */
export function hojeISO(timeZone = 'America/Sao_Paulo', agora = new Date()) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone, year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(agora);
}

function somarDias(iso, dias) {
    const [a, m, d] = iso.split('-').map(Number);
    const dt = new Date(Date.UTC(a, m - 1, d + dias));
    return dt.toISOString().slice(0, 10);
}

function dataValida(a, m, d) {
    const dt = new Date(Date.UTC(a, m - 1, d));
    return dt.getUTCFullYear() === a && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function pad(n) {
    return String(n).padStart(2, '0');
}

/** Converte o token após "@" em YYYY-MM-DD ou null. */
export function parsePrazo(token, hoje) {
    const t = normalizar(token);
    if (t === 'hoje') return hoje;
    if (t === 'amanha') return somarDias(hoje, 1);

    let m = t.match(/^\+(\d{1,3})d?$/);
    if (m) return somarDias(hoje, Number(m[1]));

    const dia = t.slice(0, 3);
    if (t.length >= 3 && dia in DIAS_SEMANA && /^[a-z]+$/.test(t)) {
        const [a, mo, d] = hoje.split('-').map(Number);
        const atual = new Date(Date.UTC(a, mo - 1, d)).getUTCDay();
        let delta = (DIAS_SEMANA[dia] - atual + 7) % 7;
        if (delta === 0) delta = 7; // "@sex" numa sexta = próxima sexta
        return somarDias(hoje, delta);
    }

    m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
        const [a, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
        return dataValida(a, mo, d) ? `${a}-${pad(mo)}-${pad(d)}` : null;
    }

    m = t.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/);
    if (m) {
        const d = Number(m[1]);
        const mo = Number(m[2]);
        const anoAtual = Number(hoje.slice(0, 4));
        let a = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : anoAtual;
        if (!dataValida(a, mo, d)) return null;
        let iso = `${a}-${pad(mo)}-${pad(d)}`;
        // Sem ano explícito e data já passou → assume o próximo ano
        if (!m[3] && iso < hoje) {
            a += 1;
            if (!dataValida(a, mo, d)) return null;
            iso = `${a}-${pad(mo)}-${pad(d)}`;
        }
        return iso;
    }
    return null;
}

/**
 * @param {string} texto  Mensagem crua
 * @param {object} opts   { projetos: string[], timeZone: string, agora: Date }
 * @returns {{ ok: boolean, erro?: string, tarefa?: object, avisos: string[] }}
 */
export function parseMensagemTarefa(texto, opts = {}) {
    const projetos = Array.isArray(opts.projetos) ? opts.projetos : [];
    const hoje = hojeISO(opts.timeZone, opts.agora);
    const avisos = [];

    const linhas = String(texto || '').replace(/\r/g, '').split('\n');
    let linha = (linhas.shift() || '').trim();
    const descricao = linhas.join('\n').trim();

    const tarefa = {
        title: '',
        description: descricao,
        project: null,
        priority: 'media',
        difficulty: 'media',
        dueDate: ''
    };

    // 1) Projeto com nome conhecido (pode conter espaços) — maior nome primeiro
    const conhecidos = [...projetos].sort((a, b) => b.length - a.length);
    const idxHash = linha.search(/(^|\s)#\S/);
    if (idxHash !== -1) {
        const inicio = linha.indexOf('#', idxHash);
        const resto = linha.slice(inicio + 1);
        const restoNorm = normalizar(resto);
        const achado = conhecidos.find(p => {
            const pn = normalizar(p);
            return restoNorm.startsWith(pn) && (restoNorm.length === pn.length || /\s/.test(restoNorm[pn.length]));
        });
        if (achado) {
            tarefa.project = achado;
            linha = (linha.slice(0, inicio) + ' ' + resto.slice(achado.length)).trim();
        }
    }

    // 2) Tokens restantes
    const sobras = [];
    for (const tok of linha.split(/\s+/).filter(Boolean)) {
        const prefixo = tok[0];
        const valor = tok.slice(1);
        if (prefixo === '#' && valor && !tarefa.project) {
            const nome = valor.replace(/_/g, ' ');
            tarefa.project = conhecidos.find(p => normalizar(p) === normalizar(nome)) || nome;
            continue;
        }
        if (prefixo === '!' && valor) {
            const p = PRIORIDADES[normalizar(valor)];
            if (p) { tarefa.priority = p; continue; }
        }
        if (prefixo === '~' && valor) {
            const d = DIFICULDADES[normalizar(valor)];
            if (d) { tarefa.difficulty = d; continue; }
        }
        if (prefixo === '@' && valor) {
            const prazo = parsePrazo(valor, hoje);
            if (prazo) { tarefa.dueDate = prazo; continue; }
            avisos.push(`Prazo "${tok}" não reconhecido — mantido no título.`);
        }
        sobras.push(tok);
    }

    tarefa.title = sobras.join(' ').trim().slice(0, 300);
    tarefa.description = tarefa.description.slice(0, 4000);

    if (!tarefa.title) {
        return { ok: false, erro: 'A tarefa precisa de um título (texto além das tags).', avisos };
    }
    return { ok: true, tarefa, avisos };
}

/** Normaliza apelidos de coluna para o id interno. */
export function parseColuna(token) {
    const t = normalizar(token).replace(/[\s_-]+/g, '');
    const mapa = {
        backlog: 'backlog', entrada: 'backlog', bl: 'backlog',
        todo: 'todo', proximas: 'todo', afazer: 'todo',
        progress: 'progress', inprogress: 'progress', andamento: 'progress', foco: 'progress', fazendo: 'progress', wip: 'progress',
        testing: 'testing', teste: 'testing', testes: 'testing', revisao: 'testing', review: 'testing',
        done: 'done', feito: 'done', feita: 'done', concluido: 'done', concluida: 'done', entregue: 'done'
    };
    return mapa[t] || null;
}
