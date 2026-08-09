import { mulberry32 } from './lt.js';

const FLAG = 'qast.offline-ready-seen';
const GRID = 9;

// First-visit celebration: once the service worker has precached the
// app-shell, the site works offline forever — make that moment visible.
export function watchOfflineReady(registration) {
    if (localStorage.getItem(FLAG)) return;

    if (registration.active) {
        show();
        return;
    }

    const worker = registration.installing || registration.waiting;
    if (!worker) return;

    worker.addEventListener('statechange', () => {
        if (worker.state === 'activated') show();
    });
}

function isFinderCell(row, col) {
    const inCorner = (r, c) => r < 3 && c < 3;

    return inCorner(row, col) || inCorner(row, GRID - 1 - col) || inCorner(GRID - 1 - row, col);
}

function buildGrid() {
    const grid = document.createElement('div');
    grid.className = 'op-grid';
    const rng = mulberry32(0x5153); // deterministic pattern, "QS"

    let order = 0;
    for (let row = 0; row < GRID; row++) {
        for (let col = 0; col < GRID; col++) {
            const cell = document.createElement('span');
            const filled = isFinderCell(row, col) || rng() < 0.52;
            cell.className = filled ? 'op-cell' : 'op-cell is-empty';
            if (filled) cell.style.setProperty('--i', String(order++ + Math.floor(rng() * 6)));
            grid.appendChild(cell);
        }
    }

    const badge = document.createElement('div');
    badge.className = 'op-badge';
    badge.innerHTML =
        '<span class="op-badge-circle">' +
        '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/></svg></span>';
    grid.appendChild(badge);

    return grid;
}

function show() {
    if (localStorage.getItem(FLAG)) return;
    localStorage.setItem(FLAG, '1');

    const overlay = document.createElement('div');
    overlay.className = 'offline-party';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'Qast est chargé et fonctionne hors-ligne');

    const card = document.createElement('div');
    card.className = 'offline-party-card';

    const pill = document.createElement('span');
    pill.className = 'pill';
    pill.textContent = 'Mise en cache terminée';

    const title = document.createElement('h2');
    title.className = 'op-title';
    title.textContent = 'C\'est chargé. Pour toujours.';

    const text = document.createElement('p');
    text.className = 'op-text';
    text.textContent =
        'Qast vit maintenant dans ton navigateur. Coupe le wifi, passe en mode avion : '
        + 'rien ne change, tout continue de marcher, hors-ligne, indéfiniment.';

    const button = document.createElement('button');
    button.className = 'btn btn-primary w-full op-cta';
    button.textContent = 'Compris';

    card.append(buildGrid(), pill, title, text, button);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    requestAnimationFrame(() => overlay.classList.add('is-visible'));

    let closed = false;
    const close = () => {
        if (closed) return;
        closed = true;
        overlay.classList.remove('is-visible');
        setTimeout(() => overlay.remove(), 350);
    };

    button.addEventListener('click', close);
    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) close();
    });
    setTimeout(close, 12000);

    if (navigator.vibrate) navigator.vibrate(60);
}
