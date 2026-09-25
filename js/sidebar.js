/**
 * Scrumban Pessoal - Barra Lateral & Drawer Mobile
 * Modulo ES: Sidebar retrátil/expansível e Drawer deslizante para dispositivos móveis (< 768px).
 */

export function toggleBarraLateral() {
    const sidebar = document.getElementById('barra-lateral');
    const icon = document.getElementById('iconToggleSidebar');
    const btn = document.getElementById('btnToggleSidebar');
    if (!sidebar) return;

    const isCollapsed = sidebar.classList.toggle('collapsed');
    try {
        localStorage.setItem('scrumban_sidebar_collapsed', isCollapsed ? 'true' : 'false');
    } catch {}

    if (icon) {
        if (isCollapsed) icon.classList.add('rotate-180');
        else icon.classList.remove('rotate-180');
    }
    if (btn) btn.title = isCollapsed ? 'Expandir menu lateral ([)' : 'Recolher menu lateral ([)';
}

export function inicializarBarraLateral() {
    let isCollapsed = false;
    try {
        isCollapsed = localStorage.getItem('scrumban_sidebar_collapsed') === 'true';
    } catch { isCollapsed = false; }

    const sidebar = document.getElementById('barra-lateral');
    const icon = document.getElementById('iconToggleSidebar');
    const btn = document.getElementById('btnToggleSidebar');
    if (sidebar && isCollapsed) {
        sidebar.classList.add('collapsed');
        if (icon) icon.classList.add('rotate-180');
        if (btn) btn.title = 'Expandir menu lateral ([)';
    }
}

export function toggleMobileMenu() {
    const sidebar = document.getElementById('barra-lateral');
    const overlay = document.getElementById('mobile-drawer-overlay');
    if (!sidebar) return;

    const aberto = sidebar.classList.toggle('mobile-open');
    if (overlay) {
        if (aberto) overlay.classList.remove('hidden');
        else overlay.classList.add('hidden');
    }
}

export function fecharMobileMenu() {
    const sidebar = document.getElementById('barra-lateral');
    const overlay = document.getElementById('mobile-drawer-overlay');
    if (sidebar) sidebar.classList.remove('mobile-open');
    if (overlay) overlay.classList.add('hidden');
}
