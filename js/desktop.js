/**
 * Scrumban Pessoal - Integração com o App Desktop (Tauri v2)
 * Modulo ES: detecta a casca nativa e oferece, com fallback para a web:
 * salvar arquivos com diálogo nativo, backups automáticos em disco,
 * tema nativo sincronizado, exibição da janela sem flash e tela cheia (F11).
 */

import { hojeISOLocal, escapeHTML } from './state.js';

const DEBOUNCE_BACKUP_MS = 20 * 1000;
let timerBackup = null;
let geradorBackup = null;
let ultimoBackupAuto = null;
let backupsConhecidos = [];

export function ehDesktop() {
    return !!(window.__TAURI__ && window.__TAURI__.core && typeof window.__TAURI__.core.invoke === 'function');
}

function invocar(comando, args = {}) {
    return window.__TAURI__.core.invoke(comando, args);
}

function janelaAtual() {
    return window.__TAURI__?.window?.getCurrentWindow?.() || null;
}

// ================= TEMA =================

/** Preferência de tema do sistema operacional. No desktop Linux vem da casca nativa,
 *  porque o matchMedia passa a refletir o tema que o próprio app aplica no GTK. */
export function sistemaPrefereEscuro() {
    const info = window.__SCRUMBAN_DESKTOP__;
    if (info && typeof info.sistemaEscuro === 'boolean' && navigator.userAgent.includes('Linux')) {
        return info.sistemaEscuro;
    }
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
}

/** Alinha barra de título, menus de <select> e calendário nativos ao tema do app. */
export function aplicarTemaNativo(escuro) {
    if (!ehDesktop()) return;
    invocar('aplicar_tema_nativo', { escuro }).catch(e => console.warn('Tema nativo não aplicado:', e));
}

// ================= JANELA =================

export async function mostrarJanela() {
    const janela = janelaAtual();
    if (!janela) return;
    try {
        await janela.show();
        await janela.setFocus();
    } catch (e) {
        console.warn('Não foi possível exibir a janela:', e);
    }
}

export async function minimizarJanela() {
    if (!ehDesktop()) return;
    try {
        await invocar('minimizar_janela');
    } catch (e) {
        console.warn('Erro ao minimizar janela:', e);
    }
}

export async function alternarMaximizar() {
    if (!ehDesktop()) return;
    try {
        const maximizada = await invocar('alternar_maximizar');
        atualizarIconeMaximizar(maximizada);
    } catch (e) {
        console.warn('Erro ao alternar maximizar:', e);
    }
}

export async function fecharJanela() {
    if (!ehDesktop()) return;
    try {
        await invocar('fechar_janela');
    } catch (e) {
        console.warn('Erro ao fechar janela:', e);
    }
}

export async function arrastarJanela() {
    if (!ehDesktop()) return;
    try {
        await invocar('arrastar_janela');
    } catch (_) {}
}

export function atualizarIconeMaximizar(maximizada) {
    const icon = document.getElementById('icon-desktop-maximizar');
    if (!icon) return;
    if (maximizada) {
        document.documentElement.classList.add('janela-maximizada');
        icon.innerHTML = '<rect x="6" y="3" width="15" height="15" rx="1.5" ry="1.5"></rect><polyline points="3 7 3 21 17 21"></polyline>';
        const btn = document.getElementById('btn-desktop-maximizar');
        if (btn) btn.title = 'Restaurar tamanho';
    } else {
        document.documentElement.classList.remove('janela-maximizada');
        icon.innerHTML = '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>';
        const btn = document.getElementById('btn-desktop-maximizar');
        if (btn) btn.title = 'Maximizar';
    }
}

async function alternarTelaCheia() {
    const janela = janelaAtual();
    if (!janela) return;
    try {
        await janela.setFullscreen(!(await janela.isFullscreen()));
    } catch (e) {
        console.warn('Tela cheia indisponível:', e);
    }
}

// ================= ARQUIVOS =================

/**
 * Salva um arquivo de texto. Desktop: diálogo nativo "Salvar como…".
 * Web: download pelo navegador.
 * @returns {Promise<{status: 'salvo'|'baixado'|'cancelado', caminho?: string}>}
 */
export async function salvarArquivo({ nome, conteudo, mime = 'text/plain', filtroNome = 'Arquivo', extensoes = [] }) {
    if (ehDesktop()) {
        const r = await invocar('salvar_arquivo', {
            nomeSugerido: nome,
            conteudo,
            filtroNome,
            extensoes
        });
        return r ? { status: 'salvo', caminho: r.caminho } : { status: 'cancelado' };
    }

    const blob = new Blob([conteudo], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = nome;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { status: 'baixado' };
}

// ================= BACKUPS AUTOMÁTICOS =================

/** Registra a função que monta o JSON completo do backup (evita import circular com storage.js). */
export function configurarGeradorBackup(fn) {
    geradorBackup = fn;
}

export function agendarBackupAutomatico(imediato = false) {
    if (!ehDesktop() || !geradorBackup) return;
    clearTimeout(timerBackup);
    timerBackup = setTimeout(executarBackupAutomatico, imediato ? 1500 : DEBOUNCE_BACKUP_MS);
}

async function executarBackupAutomatico() {
    try {
        const conteudo = JSON.stringify(await geradorBackup());
        backupsConhecidos = await invocar('backup_automatico', { dia: hojeISOLocal(), conteudo });
        ultimoBackupAuto = new Date();
        renderizarConfigDesktop();
    } catch (e) {
        console.warn('Backup automático falhou:', e);
    }
}

function formatarTamanho(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export async function abrirPastaBackups() {
    try {
        await invocar('abrir_pasta_backups');
    } catch (e) {
        window.mostrarToast?.(`Não foi possível abrir a pasta: ${e}`, 'erro');
    }
}

/** Lê um backup automático e devolve o objeto já parseado. */
export async function lerBackupAutomatico(nome) {
    return JSON.parse(await invocar('ler_backup', { nome }));
}

export async function renderizarConfigDesktop() {
    const card = document.getElementById('config-desktop-card');
    if (!card) return;
    if (!ehDesktop()) {
        card.classList.add('hidden');
        return;
    }
    card.classList.remove('hidden');

    const versao = document.getElementById('config-desktop-versao');
    if (versao) versao.textContent = `v${window.__SCRUMBAN_DESKTOP__?.versao || '?'}`;

    if (!backupsConhecidos.length) {
        try { backupsConhecidos = await invocar('listar_backups'); } catch (_) {}
    }

    const status = document.getElementById('config-desktop-status');
    if (status) {
        status.textContent = ultimoBackupAuto
            ? `Último backup automático: ${ultimoBackupAuto.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
            : (backupsConhecidos.length ? 'Backups automáticos ativos' : 'O primeiro backup será criado em instantes');
    }

    const lista = document.getElementById('config-desktop-backups');
    if (!lista) return;
    if (!backupsConhecidos.length) {
        lista.innerHTML = '<li class="text-xs text-gray-400 font-serif italic">Nenhum backup automático ainda.</li>';
        return;
    }
    lista.innerHTML = backupsConhecidos.map(b => {
        const dia = b.nome.replace('scrumban-auto-', '').replace('.json', '');
        const [a, m, d] = dia.split('-');
        return `
            <li class="flex items-center justify-between gap-3 p-2 bg-offwhite border border-beige rounded-sm text-sm">
                <span class="font-serif text-base text-dark">${d}/${m}/${a}</span>
                <span class="text-xs font-mono text-gray-500 ml-auto">${formatarTamanho(b.tamanho)}</span>
                <button type="button" data-backup="${escapeHTML(b.nome)}" class="btn-restaurar-backup text-xs text-terracota hover:underline font-sans">Restaurar</button>
            </li>`;
    }).join('');
}

// ================= BOOTSTRAP =================

export function inicializarDesktop({ aoRestaurarBackup } = {}) {
    if (!ehDesktop()) return;
    document.documentElement.classList.add('is-desktop');

    window.addEventListener('keydown', (e) => {
        if (e.key === 'F11') {
            e.preventDefault();
            alternarTelaCheia();
        }
        // Recarregar a webview no desktop não tem utilidade e pode descartar edições em andamento
        if ((e.key === 'F5' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r')) && !e.shiftKey) {
            e.preventDefault();
        }
    });

    // Menu de contexto do WebKit ("Voltar", "Recarregar"…) não faz sentido num app;
    // mantém apenas em campos de texto, onde copiar/colar/corretor são úteis.
    document.addEventListener('contextmenu', (e) => {
        const alvo = e.target;
        const editavel = alvo.closest && alvo.closest('input, textarea, [contenteditable="true"]');
        const temSelecao = String(window.getSelection && window.getSelection()).length > 0;
        if (!editavel && !temSelecao) e.preventDefault();
    });

    // Controles da barra de título personalizada
    const titlebar = document.getElementById('desktop-titlebar');
    if (titlebar) {
        titlebar.addEventListener('mousedown', (e) => {
            if (e.button === 0 && !e.target.closest('button')) {
                arrastarJanela();
            }
        });
        titlebar.addEventListener('dblclick', (e) => {
            if (!e.target.closest('button')) {
                alternarMaximizar();
            }
        });
    }

    document.getElementById('btn-desktop-minimizar')?.addEventListener('click', minimizarJanela);
    document.getElementById('btn-desktop-maximizar')?.addEventListener('click', alternarMaximizar);
    document.getElementById('btn-desktop-fechar')?.addEventListener('click', fecharJanela);

    window.addEventListener('resize', async () => {
        if (!ehDesktop()) return;
        try {
            const max = await invocar('janela_maximizada');
            atualizarIconeMaximizar(max);
        } catch (_) {}
    });

    // Checar estado inicial de maximização
    invocar('janela_maximizada').then(atualizarIconeMaximizar).catch(() => {});

    document.getElementById('config-desktop-backups')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-restaurar-backup');
        if (btn && typeof aoRestaurarBackup === 'function') aoRestaurarBackup(btn.dataset.backup);
    });

    agendarBackupAutomatico(true);
}
