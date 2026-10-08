/**
 * Scrumban Pessoal - Armazenamento & Persistência
 * Modulo ES: IndexedDB, contingência localStorage, validação de schema e backups.
 */

import { DEFAULT_STATE, appState, setAppState, COLUNAS, garantirOrdemTarefas, hojeISOLocal } from './state.js';
import { mostrarToast } from './ui.js';
import { salvarArquivo, configurarGeradorBackup, agendarBackupAutomatico } from './desktop.js';

export const STORAGE_KEY = 'scrumban_pessoal_prod_store';
export const IDB_NAME = 'scrumban_pessoal_db';
export const IDB_VERSION = 2;
export const IDB_STORE = 'app_state';
export const IDB_STORE_IMAGES = 'task_images';

export let idbConectado = false;

// Helpers de IndexedDB baseados em Promises nativas.
// A conexão é aberta uma única vez e reutilizada (antes cada get/set abria uma nova).
let conexaoIDB = null;

export function abrirIndexedDB() {
    if (conexaoIDB) return conexaoIDB;
    conexaoIDB = new Promise((resolve, reject) => {
        if (!('indexedDB' in window)) {
            return reject(new Error('IndexedDB não suportado neste ambiente'));
        }
        const request = window.indexedDB.open(IDB_NAME, IDB_VERSION);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(IDB_STORE)) {
                db.createObjectStore(IDB_STORE);
            }
            if (!db.objectStoreNames.contains(IDB_STORE_IMAGES)) {
                db.createObjectStore(IDB_STORE_IMAGES);
            }
        };
        request.onsuccess = () => {
            const db = request.result;
            db.onversionchange = () => { db.close(); conexaoIDB = null; };
            db.onclose = () => { conexaoIDB = null; };
            resolve(db);
        };
        request.onerror = () => reject(request.error);
    }).catch(err => {
        conexaoIDB = null;
        throw err;
    });
    return conexaoIDB;
}

export async function idbGet(key, storeName = IDB_STORE) {
    const db = await abrirIndexedDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

export async function idbSet(key, value, storeName = IDB_STORE) {
    const db = await abrirIndexedDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.put(value, key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

export async function idbDelete(key, storeName = IDB_STORE) {
    const db = await abrirIndexedDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.delete(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

// ================= GESTÃO DE IMAGENS NO INDEXEDDB =================
export async function salvarImagemIndexedDB(imageId, dataUrl) {
    try {
        await idbSet(imageId, dataUrl, IDB_STORE_IMAGES);
        return imageId;
    } catch (e) {
        console.error('Erro ao salvar imagem no IndexedDB:', e);
        throw e;
    }
}

export async function obterImagemIndexedDB(imageId) {
    try {
        return await idbGet(imageId, IDB_STORE_IMAGES);
    } catch (e) {
        console.error('Erro ao obter imagem do IndexedDB:', e);
        return null;
    }
}

export async function excluirImagemIndexedDB(imageId) {
    try {
        await idbDelete(imageId, IDB_STORE_IMAGES);
    } catch (e) {
        console.error('Erro ao remover imagem do IndexedDB:', e);
    }
}

// Inicializa o armazenamento com migração automática e transparente de localStorage
export async function inicializarArmazenamento() {
    try {
        let dados = await idbGet('current_state');
        idbConectado = true;

        if (!dados) {
            // Migração: se houver dados no localStorage anterior, migra automaticamente
            const rawLocal = localStorage.getItem(STORAGE_KEY);
            if (rawLocal) {
                try {
                    const parsed = JSON.parse(rawLocal);
                    if (parsed && typeof parsed === 'object') {
                        dados = parsed;
                        await idbSet('current_state', dados);
                        console.info('Scrumban: Dados migrados com sucesso do localStorage para o IndexedDB.');
                    }
                } catch (eMig) {
                    console.warn('Erro ao migrar dados legados do localStorage:', eMig);
                }
            }
        }

        if (dados && typeof dados === 'object') {
            setAppState({
                settings: { ...DEFAULT_STATE.settings, ...(dados.settings || {}) },
                sprints: Array.isArray(dados.sprints) ? dados.sprints : [],
                tasks: Array.isArray(dados.tasks) ? dados.tasks : [],
                history: Array.isArray(dados.history) ? dados.history : []
            });
        } else {
            await idbSet('current_state', appState);
        }
    } catch (err) {
        console.warn('IndexedDB inacessível, utilizando fallback localStorage:', err);
        idbConectado = false;
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                setAppState({
                    settings: { ...DEFAULT_STATE.settings, ...(parsed.settings || {}) },
                    sprints: Array.isArray(parsed.sprints) ? parsed.sprints : [],
                    tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
                    history: Array.isArray(parsed.history) ? parsed.history : []
                });
            }
        } catch (e2) {
            console.error('Fallback localStorage também falhou:', e2);
        }
    }
    garantirOrdemTarefas();
}

// Observadores notificados após cada persistência (ex.: publicação do snapshot remoto em js/sync.js)
const observadoresSalvamento = new Set();
export function registrarObservadorSalvamento(fn) {
    if (typeof fn === 'function') observadoresSalvamento.add(fn);
}

export async function saveState() {
    try {
        if (idbConectado) {
            await idbSet('current_state', appState);
        }
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
        } catch (_) {}
        agendarBackupAutomatico();
        observadoresSalvamento.forEach(fn => {
            try { fn(); } catch (eObs) { console.warn('Observador de salvamento falhou:', eObs); }
        });
    } catch (e) {
        console.error('Falha ao salvar dados:', e);
        mostrarToast('Erro ao salvar dados localmente. Verifique o espaço em disco do navegador.', 'erro', 6000);
    }
}

export function atualizarIndicadorArmazenamento() {
    const label = document.getElementById('storage-type-label');
    const indicator = document.getElementById('storage-status-indicator');
    if (!label || !indicator) return;

    if (idbConectado) {
        label.innerText = 'IndexedDB Ativo';
        indicator.title = 'Armazenamento assíncrono via IndexedDB (~GBs disponíveis)';
    } else {
        label.innerText = 'LocalStorage (Fallback)';
        indicator.title = 'Modo de compatibilidade localStorage (~5MB)';
    }
}

// Lembretes preventivos de backup
export function verificarLembreteBackup() {
    const banner = document.getElementById('lembrete-backup-banner');
    const txt = document.getElementById('lembrete-backup-texto');
    const statusSidebar = document.getElementById('sidebar-backup-status');
    if (!banner) return;

    if (sessionStorage.getItem('scrumban_dismiss_backup_reminder')) {
        banner.classList.add('hidden');
        return;
    }

    const lastBackup = appState.settings.lastBackupDate;
    if (lastBackup) {
        const lastDate = new Date(lastBackup);
        const diffMs = Date.now() - lastDate.getTime();
        const dias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (statusSidebar) {
            statusSidebar.innerText = `Último backup: há ${dias === 0 ? 'pouco tempo' : dias === 1 ? '1 dia' : dias + ' dias'}`;
        }

        if (dias >= 7) {
            if (txt) {
                txt.innerText = `Já faz ${dias} dias desde o seu último backup JSON. Mantenha seus dados seguros exportando uma cópia preventiva.`;
            }
            banner.classList.remove('hidden');
        } else {
            banner.classList.add('hidden');
        }
    } else {
        if (statusSidebar) {
            statusSidebar.innerText = 'Nenhum backup exportado';
        }
        if (appState.tasks.length > 0 || appState.sprints.length > 0) {
            if (txt) {
                txt.innerText = 'Você ainda não gerou um backup de segurança. Recomendamos baixar uma cópia preventiva dos seus dados.';
            }
            banner.classList.remove('hidden');
        } else {
            banner.classList.add('hidden');
        }
    }
}

export function dispensarLembreteBackup() {
    sessionStorage.setItem('scrumban_dismiss_backup_reminder', 'true');
    const banner = document.getElementById('lembrete-backup-banner');
    if (banner) banner.classList.add('hidden');
}

export function executarBackupComLembrete() {
    exportarBackupJSON();
    dispensarLembreteBackup();
}

// Validação estrita de backup JSON
export function validarSchemaBackup(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return { valido: false, erro: 'O arquivo não contém um objeto JSON válido.' };
    }

    if (!data.settings || typeof data.settings !== 'object' || Array.isArray(data.settings)) {
        return { valido: false, erro: 'Campo "settings" ausente ou com formato incorreto.' };
    }
    const wip = data.settings.wipLimit;
    if (typeof wip !== 'number' || isNaN(wip) || wip < 0) {
        return { valido: false, erro: 'O limite de WIP (settings.wipLimit) deve ser um número maior ou igual a zero.' };
    }
    if (data.settings.replenishmentLimit !== undefined) {
        const rep = data.settings.replenishmentLimit;
        if (typeof rep !== 'number' || isNaN(rep) || rep < 0) {
            return { valido: false, erro: 'O limite de reabastecimento deve ser um número maior ou igual a zero.' };
        }
    }
    if (!Array.isArray(data.settings.projects) || data.settings.projects.length === 0) {
        return { valido: false, erro: 'A lista de projetos deve ser um array com pelo menos um projeto.' };
    }

    if (!Array.isArray(data.sprints)) {
        return { valido: false, erro: 'O campo "sprints" deve ser uma lista (array).' };
    }
    const statusSprintsValidos = ['past', 'current', 'future'];
    for (let i = 0; i < data.sprints.length; i++) {
        const s = data.sprints[i];
        if (!s || typeof s !== 'object') return { valido: false, erro: `A Sprint na posição ${i + 1} é inválida.` };
        if (!s.id || typeof s.id !== 'string') return { valido: false, erro: `A Sprint na posição ${i + 1} não possui um ID válido.` };
        if (!s.name || typeof s.name !== 'string') return { valido: false, erro: `A Sprint na posição ${i + 1} deve ter um nome válido.` };
        if (s.status && !statusSprintsValidos.includes(s.status)) {
            return { valido: false, erro: `Status inválido "${s.status}" na Sprint "${s.name}".` };
        }
    }

    if (!Array.isArray(data.tasks)) {
        return { valido: false, erro: 'O campo "tasks" deve ser uma lista (array).' };
    }
    const prioridadesValidas = ['alta', 'media', 'baixa'];
    const dificuldadesValidas = ['trivial', 'facil', 'media', 'dificil', 'muito_dificil'];
    for (let i = 0; i < data.tasks.length; i++) {
        const t = data.tasks[i];
        if (!t || typeof t !== 'object') return { valido: false, erro: `A tarefa na posição ${i + 1} é inválida.` };
        if (!t.id || typeof t.id !== 'string') return { valido: false, erro: `A tarefa na posição ${i + 1} sem ID válido.` };
        if (!t.title || typeof t.title !== 'string') return { valido: false, erro: `A tarefa na posição ${i + 1} sem título válido.` };
        if (!COLUNAS.includes(t.column)) return { valido: false, erro: `Coluna desconhecida "${t.column}".` };
        if (t.priority && !prioridadesValidas.includes(t.priority)) return { valido: false, erro: `Prioridade inválida "${t.priority}".` };
        if (t.difficulty && !dificuldadesValidas.includes(t.difficulty)) return { valido: false, erro: `Dificuldade inválida "${t.difficulty}".` };
    }

    if (!Array.isArray(data.history)) {
        return { valido: false, erro: 'O campo "history" deve ser uma lista (array).' };
    }
    for (let i = 0; i < data.history.length; i++) {
        const h = data.history[i];
        if (!h || typeof h !== 'object' || !h.id || !h.sprintName) {
            return { valido: false, erro: `Registro de histórico na posição ${i + 1} inválido.` };
        }
    }

    return { valido: true };
}

/**
 * Monta o backup completo: estado + imagens anexadas (que ficam em outro store do
 * IndexedDB e antes não eram exportadas, deixando referências órfãs ao restaurar).
 */
export async function montarBackupCompleto() {
    const imagesData = {};
    const ids = new Set();
    (appState.tasks || []).forEach(t => (t.images || []).forEach(img => img && img.id && ids.add(img.id)));
    for (const id of ids) {
        const dataUrl = await obterImagemIndexedDB(id);
        if (dataUrl) imagesData[id] = dataUrl;
    }
    return { ...appState, imagesData, exportedAt: new Date().toISOString() };
}

configurarGeradorBackup(montarBackupCompleto);

export async function exportarBackupJSON() {
    try {
        const anterior = appState.settings.lastBackupDate;
        appState.settings.lastBackupDate = new Date().toISOString();
        const backup = await montarBackupCompleto();

        const r = await salvarArquivo({
            nome: `scrumban_backup_${hojeISOLocal()}.json`,
            conteudo: JSON.stringify(backup, null, 2),
            mime: 'application/json',
            filtroNome: 'Backup do Scrumban (JSON)',
            extensoes: ['json']
        });

        if (r.status === 'cancelado') {
            appState.settings.lastBackupDate = anterior;
            return;
        }
        await saveState();
        verificarLembreteBackup();
        const totalImagens = Object.keys(backup.imagesData).length;
        const sufixo = totalImagens ? ` (inclui ${totalImagens} imagem${totalImagens > 1 ? 'ns' : ''})` : '';
        mostrarToast(r.status === 'salvo' ? `Backup salvo em ${r.caminho}${sufixo}` : `Backup exportado com sucesso!${sufixo}`, 'sucesso', 6000);
    } catch (err) {
        console.error('Erro ao exportar backup:', err);
        mostrarToast('Erro ao gerar arquivo de backup: ' + (err.message || err), 'erro');
    }
}

/** Valida e aplica um backup já parseado (arquivo JSON importado ou backup automático do desktop). */
export async function aplicarBackup(imported) {
    const validacao = validarSchemaBackup(imported);
    if (!validacao.valido) {
        mostrarToast(`Falha na validação do backup: ${validacao.erro}`, 'erro', 6500);
        return false;
    }

    let imagensRestauradas = 0;
    if (imported.imagesData && typeof imported.imagesData === 'object') {
        for (const [id, dataUrl] of Object.entries(imported.imagesData)) {
            if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image/')) {
                try {
                    await salvarImagemIndexedDB(id, dataUrl);
                    imagensRestauradas++;
                } catch (_) {}
            }
        }
    }

    setAppState({
        settings: { ...DEFAULT_STATE.settings, ...imported.settings },
        sprints: imported.sprints,
        tasks: imported.tasks,
        history: imported.history
    });
    garantirOrdemTarefas();
    await saveState();

    const sufixo = imagensRestauradas ? ` ${imagensRestauradas} imagem(ns) restaurada(s).` : '';
    mostrarToast(`Backup restaurado com sucesso!${sufixo}`, 'sucesso');
    verificarLembreteBackup();
    return true;
}

export function importarBackupJSON(event, onSucessoCallback) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const ok = await aplicarBackup(JSON.parse(e.target.result));
            if (ok && typeof onSucessoCallback === 'function') onSucessoCallback();
        } catch (err) {
            console.error('Erro ao importar backup:', err);
            mostrarToast('Erro ao ler arquivo JSON: ' + err.message, 'erro', 6000);
        } finally {
            event.target.value = '';
        }
    };
    reader.readAsText(file);
}

export function abrirModalLimparDados() {
    const modal = document.getElementById('modalLimparDados');
    if (!modal) return;

    const tarefasCount = Array.isArray(appState.tasks) ? appState.tasks.length : 0;
    const sprintsCount = Array.isArray(appState.sprints) ? appState.sprints.length : 0;
    const histCount = Array.isArray(appState.history) ? appState.history.length : 0;

    const elTarefas = document.getElementById('limpar-total-tarefas');
    const elSprints = document.getElementById('limpar-total-sprints');
    const elHist = document.getElementById('limpar-total-historico');

    if (elTarefas) elTarefas.innerText = tarefasCount;
    if (elSprints) elSprints.innerText = sprintsCount;
    if (elHist) elHist.innerText = histCount;

    const check = document.getElementById('checkConfirmarLimpeza');
    const input = document.getElementById('inputConfirmarLimpeza');
    const btn = document.getElementById('btnConfirmarExclusaoTotal');

    if (check) check.checked = false;
    if (input) input.value = '';
    if (btn) btn.disabled = true;

    modal.showModal();
}

export function fecharModalLimparDados() {
    const modal = document.getElementById('modalLimparDados');
    if (modal) modal.close();
}

export function verificarConfirmacaoLimparDados() {
    const check = document.getElementById('checkConfirmarLimpeza');
    const input = document.getElementById('inputConfirmarLimpeza');
    const btn = document.getElementById('btnConfirmarExclusaoTotal');

    const aceitou = check ? check.checked : false;
    const digitouCorreto = input ? input.value.trim().toUpperCase() === 'RESETAR' : false;

    if (btn) {
        btn.disabled = !(aceitou && digitouCorreto);
    }
}

export async function executarLimpezaTotalDados() {
    const check = document.getElementById('checkConfirmarLimpeza');
    const input = document.getElementById('inputConfirmarLimpeza');

    const aceitou = check ? check.checked : false;
    const digitouCorreto = input ? input.value.trim().toUpperCase() === 'RESETAR' : false;

    if (!aceitou || !digitouCorreto) {
        mostrarToast('Por favor, confirme a ciência e digite RESETAR para continuar.', 'erro');
        return;
    }

    try {
        setAppState(JSON.parse(JSON.stringify(DEFAULT_STATE)));
        await saveState();
        try {
            const db = await abrirIndexedDB();
            await new Promise((resolve, reject) => {
                const tx = db.transaction(IDB_STORE_IMAGES, 'readwrite');
                tx.objectStore(IDB_STORE_IMAGES).clear();
                tx.oncomplete = resolve;
                tx.onerror = () => reject(tx.error);
            });
        } catch (eImg) {
            console.warn('Não foi possível limpar as imagens:', eImg);
        }

        try {
            sessionStorage.removeItem('scrumban_dismiss_backup_reminder');
        } catch (_) {}

        fecharModalLimparDados();
        mostrarToast('Todos os dados foram resetados com sucesso para o estado inicial.', 'info', 3000);
        setTimeout(() => {
            location.reload();
        }, 400);
    } catch (err) {
        console.error('Erro ao resetar dados:', err);
        mostrarToast('Erro ao resetar dados: ' + (err.message || err), 'erro');
    }
}

export async function restaurarDadosPadrao() {
    abrirModalLimparDados();
}

