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

    const sample = new TextEncoder().encode(
        'Qast — d\'un écran à l\'autre, sans réseau. '.repeat(30),
    );
    const payload = buildPayload({ t: 'text' }, sample);
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
