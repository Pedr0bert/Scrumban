/**
 * Scrumban Pessoal - Drag and Drop & Gestos Touch Mobile
 * Modulo ES: Suporte nativo a DnD no desktop e suporte a gestos touch com ghost element em mobile.
 */

import { reordenarOuMoverTarefa } from './kanban.js';

let draggedTaskId = null;
let dropIndicator = null;
let touchDragState = null;

export function getOrCreateDropIndicator() {
    if (!dropIndicator) {
        dropIndicator = document.createElement('div');
        dropIndicator.className = 'drop-indicator';
    }
    return dropIndicator;
}

export function getDragAfterElement(container, x, y) {
    const isGrid = container.classList.contains('kanban-column-expanded-grid');
    const elements = [...container.querySelectorAll('.card-item:not(.dragging)')];
    
    if (elements.length === 0) return null;

    if (isGrid && typeof x === 'number') {
        let closestElement = null;
        let minDistance = Number.POSITIVE_INFINITY;
        
        for (const child of elements) {
            const box = child.getBoundingClientRect();
            const childCenterX = box.left + box.width / 2;
            const childCenterY = box.top + box.height / 2;
            
            if (y < box.bottom && (x < childCenterX || y < box.top + box.height / 2)) {
                const distance = Math.hypot(x - childCenterX, y - childCenterY);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestElement = child;
                }
            }
        }
        return closestElement;
    }

    return elements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) return { offset, element: child };
        return closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

export function vincularEventosDrag(card) {
    card.addEventListener('dragstart', function(e) {
        draggedTaskId = this.dataset.taskId;
        e.dataTransfer.setData('text/plain', draggedTaskId);
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => this.classList.add('dragging'), 0);
    });

    card.addEventListener('dragend', function() {
        this.classList.remove('dragging');
        draggedTaskId = null;
        document.querySelectorAll('.kanban-column, .column-collapsed-strip').forEach(c => c.classList.remove('drag-over'));
        if (dropIndicator && dropIndicator.parentNode) dropIndicator.remove();
    });
}

export function inicializarColunasDrop() {
    document.querySelectorAll('.kanban-column').forEach(column => {
        column.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            this.classList.add('drag-over');
            const afterElement = getDragAfterElement(this, e.clientX, e.clientY);
            const indicator = getOrCreateDropIndicator();
            if (afterElement) this.insertBefore(indicator, afterElement);
            else this.appendChild(indicator);
        });

        column.addEventListener('dragleave', function(e) {
            if (!e.relatedTarget || !this.contains(e.relatedTarget)) {
                this.classList.remove('drag-over');
                if (dropIndicator && dropIndicator.parentNode === this) dropIndicator.remove();
            }
        });

        column.addEventListener('drop', function(e) {
            e.preventDefault();
            this.classList.remove('drag-over');
            const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
            const afterElement = getDragAfterElement(this, e.clientX, e.clientY);
            if (dropIndicator && dropIndicator.parentNode) dropIndicator.remove();
            if (!taskId) return;
            const targetCol = this.id.replace('col-', '');
            const afterTaskId = afterElement ? afterElement.dataset.taskId : null;
            reordenarOuMoverTarefa(taskId, targetCol, afterTaskId);
        });
    });

    // Drop em colunas recolhidas quando outra coluna estiver expandida
    document.querySelectorAll('.column-collapsed-strip').forEach(strip => {
        strip.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            this.classList.add('drag-over');
        });

        strip.addEventListener('dragleave', function(e) {
            if (!e.relatedTarget || !this.contains(e.relatedTarget)) {
                this.classList.remove('drag-over');
            }
        });

        strip.addEventListener('drop', function(e) {
            e.preventDefault();
            this.classList.remove('drag-over');
            const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
            if (!taskId) return;
            const section = this.closest('section');
            const targetCol = section ? (section.dataset.column || section.getAttribute('data-column')) : null;
            if (targetCol) {
                reordenarOuMoverTarefa(taskId, targetCol, null);
            }
        });
    });
}

// Ação 4.2: Suporte a Gestos Touch para Reordenação Mobile
export function vincularEventosTouch(card) {
    let startY = 0;
    let isMoving = false;
    let cloneEl = null;

    card.addEventListener('touchstart', (e) => {
        if (e.touches.length > 1) return;
        const touch = e.touches[0];
        startY = touch.clientY;
        touchDragState = {
            taskId: card.dataset.taskId,
            cardEl: card,
            initialY: startY
        };
    }, { passive: true });

    card.addEventListener('touchmove', (e) => {
        if (!touchDragState || touchDragState.taskId !== card.dataset.taskId) return;
        const touch = e.touches[0];
        const diffY = Math.abs(touch.clientY - startY);

        if (diffY > 10 && !isMoving) {
            isMoving = true;
            card.classList.add('dragging');
            cloneEl = card.cloneNode(true);
            cloneEl.classList.add('touch-drag-ghost');
            cloneEl.style.width = `${card.offsetWidth}px`;
            document.body.appendChild(cloneEl);
        }

        if (isMoving && cloneEl) {
            e.preventDefault();
            cloneEl.style.transform = `translate3d(${touch.clientX - 40}px, ${touch.clientY - 25}px, 0)`;

            const elemBelow = document.elementFromPoint(touch.clientX, touch.clientY);
            if (elemBelow) {
                const colTarget = elemBelow.closest('.kanban-column');
                if (colTarget) {
                    const after = getDragAfterElement(colTarget, touch.clientY);
                    const indicator = getOrCreateDropIndicator();
                    if (after) colTarget.insertBefore(indicator, after);
                    else colTarget.appendChild(indicator);
                }
            }
        }
    }, { passive: false });

    card.addEventListener('touchend', (e) => {
        if (!touchDragState || touchDragState.taskId !== card.dataset.taskId) return;
        if (isMoving) {
            const touch = e.changedTouches[0];
            const elemBelow = document.elementFromPoint(touch.clientX, touch.clientY);
            if (elemBelow) {
                const colTarget = elemBelow.closest('.kanban-column');
                if (colTarget) {
                    const after = getDragAfterElement(colTarget, touch.clientY);
                    const targetCol = colTarget.id.replace('col-', '');
                    const afterTaskId = after ? after.dataset.taskId : null;
                    reordenarOuMoverTarefa(card.dataset.taskId, targetCol, afterTaskId);
                }
            }
        }
        card.classList.remove('dragging');
        if (cloneEl) cloneEl.remove();
        if (dropIndicator && dropIndicator.parentNode) dropIndicator.remove();
        touchDragState = null;
        isMoving = false;
    });

    card.addEventListener('touchcancel', () => {
        card.classList.remove('dragging');
        if (cloneEl) cloneEl.remove();
        if (dropIndicator && dropIndicator.parentNode) dropIndicator.remove();
        touchDragState = null;
        isMoving = false;
    });
}
