import { Broadcaster } from './sender.js';
import { buildPayload } from './packet.js';

// The hero demo runs the real engine: a genuine LT/QR broadcast loop on
// the left screen, a looping reception mock on the right one.
export function initLanding() {
    const canvas = document.getElementById('demo-canvas');
    const bar = document.getElementById('demo-bar');
    const percentLabel = document.getElementById('demo-percent');
    const doneBox = document.getElementById('demo-done');
    if (!canvas) return;

    // Easter egg: the hero demo is a genuine broadcast. Film this page
    // with the Qast receiver and this note really lands on your device.
    const note = [
        '# Note de voyage ✈️',
        '',
        'Tu viens de décoder la démo de la page d\'accueil.',
        'Aucun réseau, aucun serveur : cette note a littéralement',
        'sauté d\'un écran à l\'autre, sous tes yeux.',
        '',
        'Bienvenue dans le club des curieux qui scannent tout.',
        '',
        '— Qast · app #15/52 · #52Apps',
        '',
        'PS : un café pour l\'équipe ? buymeacoffee.com/tfa.the.forge.agency',
    ].join('\n');
    const payload = buildPayload(
        { t: 'md', n: 'note-de-voyage.md', m: 'text/markdown' },
        new TextEncoder().encode(note),
    );
    const broadcaster = new Broadcaster(canvas, payload, { blockSize: 96, fps: 5, width: 480 });

    const observer = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) {
            broadcaster.start();
        } else {
            broadcaster.stop();
        }
    }, { threshold: 0.15 });
    observer.observe(canvas);

    if (!bar) return;

    let percent = 0;
    setInterval(() => {
        percent += 2 + Math.floor(Math.random() * 5);
        if (percent >= 112) percent = 0;
        const clamped = Math.min(100, percent);
        bar.style.width = `${clamped}%`;
        percentLabel.textContent = `${clamped} %`;
        bar.classList.toggle('is-done', clamped === 100);
        doneBox.style.opacity = clamped === 100 ? '1' : '0';
    }, 220);
}
