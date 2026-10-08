/**
 * Scrumban Pessoal - Seletor de Datas Próprio
 * Modulo ES: substitui o calendário nativo dos <input type="date">.
 *
 * No app desktop (WebKitGTK no Linux), o calendário nativo é um popover GTK que
 * captura o mouse: cliques fora dele não chegam à página e ele só fechava com Esc.
 * Ele também aparecia em inglês e com o tema do sistema. Este seletor é HTML puro:
 * segue o tema do app, está em português e fecha ao clicar fora ou com Esc.
 * O <input type="date"> continua sendo a fonte do valor (YYYY-MM-DD) e ainda
 * aceita digitação direta pelo teclado.
 */

import { hojeISOLocal } from './state.js';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

let popover = null;
let inputAtivo = null;
let anoVisivel = 0;
let mesVisivel = 0;

const pad = (n) => String(n).padStart(2, '0');
const isoDe = (a, m, d) => `${a}-${pad(m + 1)}-${pad(d)}`;

function criarPopover() {
    const el = document.createElement('div');
    el.id = 'seletor-data';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Escolher data');
    el.className = 'seletor-data bg-white border border-beige rounded-sm shadow-lg p-3 select-none';
    el.addEventListener('click', aoClicarNoPopover);
    return el;
}

function renderizar() {
    const hoje = hojeISOLocal();
    const selecionada = inputAtivo ? inputAtivo.value : '';
    const primeiroDiaSemana = new Date(anoVisivel, mesVisivel, 1).getDay();
    const diasNoMes = new Date(anoVisivel, mesVisivel + 1, 0).getDate();

    let celulas = '';
    for (let i = 0; i < primeiroDiaSemana; i++) celulas += '<span></span>';
    for (let d = 1; d <= diasNoMes; d++) {
        const iso = isoDe(anoVisivel, mesVisivel, d);
        const classes = ['seletor-data-dia'];
        if (iso === hoje) classes.push('is-hoje');
        if (iso === selecionada) classes.push('is-selecionado');
        celulas += `<button type="button" class="${classes.join(' ')}" data-data="${iso}" aria-label="${d} de ${MESES[mesVisivel]} de ${anoVisivel}"${iso === selecionada ? ' aria-pressed="true"' : ''}>${d}</button>`;
    }

    const podeLimpar = inputAtivo && !inputAtivo.required && inputAtivo.value;
    popover.innerHTML = `
        <div class="flex items-center justify-between mb-2">
            <button type="button" class="seletor-data-nav" data-nav="-1" aria-label="Mês anterior">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
            </button>
            <span class="font-serif text-base font-bold text-dark">${MESES[mesVisivel]} ${anoVisivel}</span>
            <button type="button" class="seletor-data-nav" data-nav="1" aria-label="Próximo mês">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
            </button>
        </div>
        <div class="seletor-data-grade text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
            ${DIAS_SEMANA.map(d => `<span>${d}</span>`).join('')}
        </div>
        <div class="seletor-data-grade">${celulas}</div>
        <div class="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-beige text-xs font-sans">
            <button type="button" class="seletor-data-acao" data-acao="hoje">Hoje</button>
            ${podeLimpar ? '<button type="button" class="seletor-data-acao text-gray-500" data-acao="limpar">Limpar</button>' : ''}
        </div>
    `;
}

function posicionar() {
    if (!popover || !inputAtivo) return;
    const r = inputAtivo.getBoundingClientRect();
    const largura = popover.offsetWidth;
    const altura = popover.offsetHeight;
    let left = Math.min(r.left, window.innerWidth - largura - 8);
    let top = r.bottom + 4;
    if (top + altura > window.innerHeight - 8) top = Math.max(8, r.top - altura - 4); // abre para cima
    popover.style.left = `${Math.max(8, left)}px`;
    popover.style.top = `${top}px`;
}

function definirValor(iso) {
    if (!inputAtivo) return;
    inputAtivo.value = iso;
    inputAtivo.dispatchEvent(new Event('input', { bubbles: true }));
    inputAtivo.dispatchEvent(new Event('change', { bubbles: true }));
}

function aoClicarNoPopover(e) {
    const dia = e.target.closest('[data-data]');
    if (dia) {
        definirValor(dia.dataset.data);
        fecharSeletorData(true);
        return;
    }
    const nav = e.target.closest('[data-nav]');
    if (nav) {
        mesVisivel += Number(nav.dataset.nav);
        if (mesVisivel < 0) { mesVisivel = 11; anoVisivel--; }
        if (mesVisivel > 11) { mesVisivel = 0; anoVisivel++; }
        renderizar();
        posicionar();
        return;
    }
    const acao = e.target.closest('[data-acao]');
    if (acao) {
        definirValor(acao.dataset.acao === 'hoje' ? hojeISOLocal() : '');
        fecharSeletorData(true);
    }
}

export function abrirSeletorData(input) {
    if (inputAtivo === input && popover && popover.isConnected) return;
    fecharSeletorData(false);
    inputAtivo = input;
    const base = /^\d{4}-\d{2}-\d{2}$/.test(input.value) ? input.value : hojeISOLocal();
    anoVisivel = Number(base.slice(0, 4));
    mesVisivel = Number(base.slice(5, 7)) - 1;

    if (!popover) popover = criarPopover();
    // Dentro de um <dialog> modal, o popover precisa estar no mesmo "top layer"
    (input.closest('dialog') || document.body).appendChild(popover);
    renderizar();
    posicionar();
    input.setAttribute('aria-expanded', 'true');
}

export function fecharSeletorData(devolverFoco = false) {
    if (!popover || !popover.isConnected) return;
    popover.remove();
    if (inputAtivo) {
        inputAtivo.setAttribute('aria-expanded', 'false');
        if (devolverFoco) inputAtivo.focus();
    }
    inputAtivo = null;
}

export function seletorDataAberto() {
    return !!(popover && popover.isConnected);
}

export function inicializarSeletorDatas() {
    // Abre o nosso seletor e impede o calendário nativo
    document.addEventListener('mousedown', (e) => {
        const input = e.target.closest && e.target.closest('input[type="date"]');
        if (!input || input.disabled || input.readOnly) return;
        e.preventDefault();
        input.focus();
        if (seletorDataAberto() && inputAtivo === input) fecharSeletorData(false);
        else abrirSeletorData(input);
    }, true);

    // O WebKitGTK abre o popover nativo na ativação (click), não no mousedown
    document.addEventListener('click', (e) => {
        if (e.target.closest && e.target.closest('input[type="date"]')) e.preventDefault();
    }, true);

    // Fecha ao clicar fora
    document.addEventListener('pointerdown', (e) => {
        if (!seletorDataAberto()) return;
        if (e.target === inputAtivo || popover.contains(e.target)) return;
        fecharSeletorData(false);
    }, true);

    document.addEventListener('keydown', (e) => {
        const ehCampoData = e.target && e.target.matches && e.target.matches('input[type="date"]');
        if (ehCampoData && e.altKey && e.key === 'ArrowDown') {
            e.preventDefault();
            abrirSeletorData(e.target);
            return;
        }
        // Esc fecha só o calendário, sem fechar o modal por trás dele
        if (e.key === 'Escape' && seletorDataAberto()) {
            e.preventDefault();
            e.stopImmediatePropagation();
            fecharSeletorData(true);
        }
        // Digitar a data à mão atualiza o calendário aberto
        if (ehCampoData && seletorDataAberto()) requestAnimationFrame(renderizar);
    }, true);

    // O <dialog> também fecha no Esc via evento "cancel": bloqueia se o calendário estava aberto
    document.addEventListener('cancel', (e) => {
        if (seletorDataAberto()) {
            e.preventDefault();
            fecharSeletorData(true);
        }
    }, true);

    window.addEventListener('resize', () => fecharSeletorData(false));
    document.addEventListener('scroll', (e) => {
        if (seletorDataAberto() && !popover.contains(e.target)) posicionar();
    }, true);
}
