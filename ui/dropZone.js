// =============================================================
// ui/dropZone.js — Global drag-and-drop file handling
// =============================================================
// Accepts .txt / word lists and .json config files dropped
// anywhere on the page.

let _onFileDropped = null;

export function setupDragAndDrop(onFileDrop) {
    _onFileDropped = onFileDrop;

    let dragTimer;

    document.addEventListener('dragover', e => {
        if (_hasFiles(e)) {
            e.preventDefault();
            const dz = document.getElementById('drop-zone');
            if (dz) dz.classList.add('active');
            clearTimeout(dragTimer);
        }
    });

    document.addEventListener('dragleave', e => {
        if (_hasFiles(e)) {
            e.preventDefault();
            dragTimer = setTimeout(() => {
                const dz = document.getElementById('drop-zone');
                if (dz) dz.classList.remove('active');
            }, 100);
        }
    });

    document.addEventListener('drop', e => {
        const dz = document.getElementById('drop-zone');
        if (dz) dz.classList.remove('active');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            e.preventDefault();
            if (_onFileDropped) _onFileDropped(e.dataTransfer.files[0]);
        }
    });
}

function _hasFiles(e) {
    return e.dataTransfer.types && (
        e.dataTransfer.types.includes('Files') ||
        e.dataTransfer.types.includes('application/x-moz-file')
    );
}
