/**
 * Scrumban Pessoal - Tema (Dark Mode & Light Mode)
 * Modulo ES: Preferência de tema, detecção de sistema operacional e sincronização de UI.
 */

import { mostrarToast } from './ui.js';

const ICONE_LUA = `<svg class="w-3.5 h-3.5 text-media shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>`;
const ICONE_SOL = `<svg class="w-3.5 h-3.5 text-media shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>`;

export function obterPreferenciaTema() {
    try {
        return localStorage.getItem('scrumban_theme') || 'system';
    } catch {
        return 'system';
    }
}

export function ehTemaEscuroAtivo() {
    return document.documentElement.classList.contains('dark');
}

export function aplicarTema(modo) {
    const prefereEscuroSistema = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    let deveFicarEscuro = modo === 'dark' || (modo !== 'light' && prefereEscuroSistema);

    if (deveFicarEscuro) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }

    atualizarUIModoTema(modo, deveFicarEscuro);
}

export function definirTema(modo) {
    try {
        if (modo === 'system') {
            localStorage.removeItem('scrumban_theme');
        } else {
            localStorage.setItem('scrumban_theme', modo);
        }
    } catch {}

    aplicarTema(modo);
    const msg = modo === 'dark' ? 'Modo Escuro ativado.' : (modo === 'light' ? 'Modo Claro ativado.' : 'Tema ajustado para seguir o sistema.');
    mostrarToast(msg, 'info', 2500);
}

export function toggleTemaDark() {
    const novoModo = ehTemaEscuroAtivo() ? 'light' : 'dark';
    definirTema(novoModo);
}

export function atualizarUIModoTema(modoConfigurado, estaEscuro) {
    const iconeEl = document.getElementById('tema-icone');
    const mobileIconeEl = document.getElementById('mobile-tema-icone');
    const textoEl = document.getElementById('tema-texto');
    const indicadorEl = document.getElementById('tema-indicador');
    const btnToggle = document.getElementById('btnToggleTema');

    const htmlIcone = estaEscuro ? ICONE_SOL : ICONE_LUA;
    if (iconeEl) iconeEl.innerHTML = htmlIcone;
    if (mobileIconeEl) mobileIconeEl.innerHTML = htmlIcone;
    if (textoEl) textoEl.textContent = estaEscuro ? 'Modo Claro' : 'Modo Escuro';
    if (indicadorEl) indicadorEl.textContent = modoConfigurado === 'system' ? 'Auto' : (estaEscuro ? 'Escuro' : 'Claro');
    if (btnToggle) btnToggle.title = estaEscuro ? 'Alternar para modo claro (D)' : 'Alternar para modo escuro (D)';

    const badgeConfig = document.getElementById('badge-tema-atual');
    if (badgeConfig) badgeConfig.textContent = estaEscuro ? 'Tema Escuro Ativo' : 'Tema Claro Ativo';

    const radios = document.querySelectorAll('input[name="opcaoTemaConfig"]');
    radios.forEach(r => { r.checked = (r.value === modoConfigurado); });
}

export function inicializarTemaDark() {
    const modoSalvo = obterPreferenciaTema();
    aplicarTema(modoSalvo);

    if (window.matchMedia) {
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        mq.addEventListener('change', () => {
            if (obterPreferenciaTema() === 'system') aplicarTema('system');
        });
    }
}
