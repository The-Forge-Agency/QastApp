import { initAppPage } from './qast/app-page.js';
import { initLanding } from './qast/landing.js';
import { Broadcaster, renderStaticQr, DENSITIES, estimateTransfer } from './qast/sender.js';
import { Scanner } from './qast/receiver.js';
import { LTEncoder, LTDecoder } from './qast/lt.js';
import { encodePacket, decodePacket, buildPayload, parsePayload } from './qast/packet.js';

// The whole engine, exposed for the curious (and for debugging):
// everything runs client-side, poke around freely.
window.Qast = {
    Broadcaster,
    Scanner,
    LTEncoder,
    LTDecoder,
    renderStaticQr,
    encodePacket,
    decodePacket,
    buildPayload,
    parsePayload,
    DENSITIES,
    estimateTransfer,
};

const page = document.body.dataset.page;

if (page === 'app') initAppPage();
if (page === 'landing') initLanding();

if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            const { watchOfflineReady } = await import('./qast/offline-ready.js');
            watchOfflineReady(registration);
        } catch {
            // Offline mode will simply be unavailable; the app still works.
        }
    });
}
