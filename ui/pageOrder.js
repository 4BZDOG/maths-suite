// =============================================================
// ui/pageOrder.js — Sortable page-order list (drag + keyboard)
// =============================================================
import { saveState } from '../core/storage.js';

export function setupSortableList(selectorOrId) {
    const id = (selectorOrId || '#page-order-list').replace(/^#/, '');
    const sortList = document.getElementById(id);
    if (!sortList) return;

    let draggedItem = null;

    sortList.addEventListener('dragstart', e => {
        draggedItem = e.target.closest('.sortable-item');
        if (!draggedItem) return;
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => draggedItem?.classList.add('dragging'), 0);
    });

    sortList.addEventListener('dragend', () => {
        if (draggedItem) draggedItem.classList.remove('dragging');
        draggedItem = null;
        saveState();
    });

    sortList.addEventListener('dragover', e => {
        e.preventDefault();
        const currentItem = document.querySelector('.dragging');
        if (!currentItem) return;
        const afterElement = _getDragAfterElement(sortList, e.clientY);
        if (afterElement == null) sortList.appendChild(currentItem);
        else sortList.insertBefore(currentItem, afterElement);
    });

    // Keyboard reorder: Alt+Up / Alt+Down
    sortList.querySelectorAll('.sortable-item').forEach(item => {
        item.setAttribute('tabindex', '0');
        item.addEventListener('keydown', e => {
            if (!e.altKey || !['ArrowUp', 'ArrowDown'].includes(e.key)) return;
            e.preventDefault();
            const items = [...sortList.querySelectorAll('.sortable-item')];
            const idx   = items.indexOf(item);
            if (e.key === 'ArrowUp'   && idx > 0)              sortList.insertBefore(item, items[idx - 1]);
            else if (e.key === 'ArrowDown' && idx < items.length - 1) sortList.insertBefore(items[idx + 1], item);
            item.focus();
            saveState();
        });
    });
}

function _getDragAfterElement(container, y) {
    const draggables = [...container.querySelectorAll('.sortable-item:not(.dragging)')];
    return draggables.reduce((closest, child) => {
        const box    = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) return { offset, element: child };
        return closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}
