/**
 * Scrumban Pessoal - Estado e Utilitários Centrais
 * Modulo ES: Gestão de estado reativo, definições de constantes e utilitários de ID/datas.
 */

export const COLUNAS = ['backlog', 'todo', 'progress', 'testing', 'done'];

export const DEFAULT_STATE = {
    settings: {
        wipLimit: 2,
        replenishmentLimit: 2,
        projects: ['Meu Produto', 'Freelance / Clientes', 'Estudos & R&D', 'Administrativo'],
        lastBackupDate: null,
        subtasksVisibility: 'all' // 'all' (todas no quadro) ou 'parent_only' (apenas tarefas pai no quadro)
    },
    sprints: [],
    tasks: [],
    history: []
};

// Estado da aplicação mantido em memória
export let appState = JSON.parse(JSON.stringify(DEFAULT_STATE));

export function setAppState(novoEstado) {
    appState = novoEstado;
}

// Configurações visuais de prioridades
export const PRIORIDADE_CONFIG = {
    alta: { cor: 'bg-terracota text-white', label: 'Alta Prioridade', border: 'border-terracota' },
    media: { cor: 'bg-media text-white', label: 'Média Prioridade', border: 'border-media' },
    baixa: { cor: 'bg-musgo text-white', label: 'Baixa Prioridade', border: 'border-musgo' }
};

// Configurações de Dificuldade / Complexidade (Item 1)
// Trivial (verde claro), Fácil (verde mais forte), Média (amarelo gema), Difícil (vermelho), Muito Difícil (vermelho escuro)
export const DIFICULDADE_CONFIG = {
    trivial: { label: 'Trivial', corDot: 'bg-[#86efac]', hex: '#86efac', border: 'border-[#4ade80]' },
    facil: { label: 'Fácil', corDot: 'bg-[#16a34a]', hex: '#16a34a', border: 'border-[#15803d]' },
    media: { label: 'Média', corDot: 'bg-[#facc15]', hex: '#facc15', border: 'border-[#eab308]' },
    dificil: { label: 'Difícil', corDot: 'bg-[#ef4444]', hex: '#ef4444', border: 'border-[#dc2626]' },
    muito_dificil: { label: 'Muito Difícil', corDot: 'bg-[#991b1b]', hex: '#991b1b', border: 'border-[#7f1d1d]' }
};

export const COLUNA_NOMES = {
    backlog: 'Backlog (Entrada)',
    todo: 'TODO (Próximas)',
    progress: 'In Progress (Em Foco)',
    testing: 'Testing (Revisão)',
    done: 'Done (Entregue)'
};

// Filtros em memória
export const uiFilters = {
    search: '',
    project: 'all',
    priority: 'all',
    onlyOverdue: false
};

// Garante que todas as tarefas possuam o atributo 'order' sequencial por coluna
export function garantirOrdemTarefas() {
    COLUNAS.forEach(col => {
        const tasksCol = appState.tasks.filter(t => t.column === col);
        tasksCol.forEach((t, idx) => {
            if (typeof t.order !== 'number') {
                t.order = idx;
            }
        });
    });
}

// Gerador de IDs criptograficamente seguros
export function gerarId(prefixo = '') {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        const uuid = crypto.randomUUID();
        return prefixo ? `${prefixo}-${uuid}` : uuid;
    }
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
        const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
        return prefixo ? `${prefixo}-${uuid}` : uuid;
    }
    const fallback = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    return prefixo ? `${prefixo}-${fallback}` : fallback;
}

// Formatação de datas
export function formatarData(dataIso) {
    if (!dataIso) return '';
    try {
        const [ano, mes, dia] = dataIso.split('-');
        return `${dia}/${mes}/${ano}`;
    } catch {
        return dataIso;
    }
}

export function formatarDataCurta(dataIso) {
    if (!dataIso) return '';
    try {
        const [, mes, dia] = dataIso.split('-');
        return `${dia}/${mes}`;
    } catch {
        return dataIso;
    }
}

// Escape de HTML para evitar XSS
export function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

// Tracking de prazos (Overdue / Hoje / Futuro)
export function calcularStatusPrazo(dueDateStr, isDone) {
    if (!dueDateStr) return { status: 'none', label: 'Sem prazo', badgeText: '', dias: 0 };
    if (isDone) return { status: 'done', label: 'Concluída', badgeText: formatarDataCurta(dueDateStr), dias: 0 };

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const partes = dueDateStr.split('-');
    if (partes.length !== 3) return { status: 'none', label: 'Data inválida', badgeText: '', dias: 0 };

    const [ano, mes, dia] = partes.map(Number);
    const dataLimite = new Date(ano, mes - 1, dia);
    dataLimite.setHours(0, 0, 0, 0);

    const diffMs = dataLimite.getTime() - hoje.getTime();
    const diffDias = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDias < 0) {
        const atraso = Math.abs(diffDias);
        return {
            status: 'overdue',
            dias: atraso,
            label: atraso === 1 ? '1 dia de atraso' : `${atraso} dias de atraso`,
            badgeText: atraso === 1 ? '1d atrasado' : `${atraso}d atrasado`,
            fullDate: formatarData(dueDateStr)
        };
    } else if (diffDias === 0) {
        return {
            status: 'today',
            dias: 0,
            label: 'Vence hoje',
            badgeText: 'Hoje',
            fullDate: formatarData(dueDateStr)
        };
    } else if (diffDias === 1) {
        return {
            status: 'tomorrow',
            dias: 1,
            label: 'Vence amanhã',
            badgeText: 'Amanhã',
            fullDate: formatarData(dueDateStr)
        };
    } else {
        return {
            status: 'future',
            dias: diffDias,
            label: `Restam ${diffDias} dias`,
            badgeText: formatarDataCurta(dueDateStr),
            fullDate: formatarData(dueDateStr)
        };
    }
}

// Verifica se a tarefa deve ser exibida no quadro de acordo com a configuração de visibilidade de sub-tarefas
export function tarefaVisivelNoQuadro(tarefa) {
    if (appState.settings && appState.settings.subtasksVisibility === 'parent_only' && tarefa.parentId) {
        return false;
    }
    return true;
}

// Filtro de tarefas baseado nos inputs da UI e configuração de visibilidade
export function tarefaCorrespondeFiltros(tarefa) {
    if (!tarefaVisivelNoQuadro(tarefa)) return false;

    if (uiFilters.onlyOverdue) {
        if (tarefa.column === 'done') return false;
        if (calcularStatusPrazo(tarefa.dueDate, false).status !== 'overdue') return false;
    }
    if (uiFilters.project !== 'all' && tarefa.project !== uiFilters.project) return false;
    if (uiFilters.priority !== 'all' && tarefa.priority !== uiFilters.priority) return false;
    if (uiFilters.search.trim()) {
        const termo = uiFilters.search.toLowerCase();
        const matchTitulo = (tarefa.title || '').toLowerCase().includes(termo);
        const matchDesc = (tarefa.description || '').toLowerCase().includes(termo);
        const matchProj = (tarefa.project || '').toLowerCase().includes(termo);
        let matchPai = false;
        if (tarefa.parentId) {
            const pai = appState.tasks.find(t => t.id === tarefa.parentId);
            if (pai && (pai.title || '').toLowerCase().includes(termo)) {
                matchPai = true;
            }
        }
        if (!matchTitulo && !matchDesc && !matchProj && !matchPai) return false;
    }
    return true;
}

// Utilitários de Hierarquia de Cards (Árvore de Tarefas)
export function obterTarefasFilhas(parentId) {
    if (!parentId) return [];
    return appState.tasks.filter(t => t.parentId === parentId);
}

export function obterTarefaPai(childTaskId) {
    const tarefa = appState.tasks.find(t => t.id === childTaskId);
    if (!tarefa || !tarefa.parentId) return null;
    return appState.tasks.find(t => t.id === tarefa.parentId) || null;
}

export function obterDescendentesIds(taskId) {
    const ids = new Set();
    function coletar(pId) {
        const filhas = appState.tasks.filter(t => t.parentId === pId);
        filhas.forEach(f => {
            ids.add(f.id);
            coletar(f.id);
        });
    }
    coletar(taskId);
    return ids;
}

