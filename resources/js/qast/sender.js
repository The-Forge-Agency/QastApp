import QRCode from 'qrcode';
import { LTEncoder } from './lt.js';
import { encodePacket, PTYPE_LT, PTYPE_SYSTEMATIC } from './packet.js';

export const DENSITIES = {
    s: { blockSize: 96, label: 'S · caméra faible' },
    m: { blockSize: 220, label: 'M · équilibré' },
    l: { blockSize: 420, label: 'L · caméra proche' },
};

export const REDUNDANCY = 1.7;

export function estimateTransfer(byteLength, densityKey, fps) {
    const { blockSize } = DENSITIES[densityKey];
    const k = Math.max(1, Math.ceil(byteLength / blockSize));
    const frames = Math.ceil(k * REDUNDANCY);

    return { k, frames, seconds: frames / fps };
}

// Streams the payload as an endless loop of QR frames on a canvas:
// one systematic pass first (fast path for a steady camera), then LT
// packets with periodic systematic re-emissions to patch missed frames.
export class Broadcaster {
    constructor(canvas, payload, { blockSize = 220, fps = 8, width = 640 } = {}) {
        this.canvas = canvas;
        this.encoder = new LTEncoder(payload, blockSize);
        this.blockSize = blockSize;
        this.fps = fps;
        this.width = width;
        this.transferId = crypto.getRandomValues(new Uint32Array(1))[0];
        this.seedBase = crypto.getRandomValues(new Uint32Array(1))[0];
        this.frameNo = 0;
        this.running = false;
        this.rafId = null;
        this.lastTick = 0;
        this.rendering = false;
        // QR frames are drawn to a buffer then blitted: the qrcode lib
        // resets canvas dimensions on every render, which breaks
        // captureStream() recordings and forces reflows.
        this.buffer = document.createElement('canvas');
        this.canvas.width = width;
        this.canvas.height = width;
    }

    get k() {
        return this.encoder.k;
    }

    nextPacket() {
        const k = this.encoder.k;
        const n = this.frameNo++;
        let ptype;
        let seed;
        let data;

        if (n < k) {
            ptype = PTYPE_SYSTEMATIC;
            seed = n;
            data = this.encoder.systematic(n);
        } else if ((n - k) % 4 === 3) {
            ptype = PTYPE_SYSTEMATIC;
            seed = Math.floor((n - k) / 4) % k;
            data = this.encoder.systematic(seed);
        } else {
            ptype = PTYPE_LT;
            seed = (this.seedBase + n) >>> 0;
            data = this.encoder.encode(seed);
        }

        return encodePacket({
            ptype,
            transferId: this.transferId,
            k,
            totalLen: this.encoder.totalLen,
            seed,
            blockSize: this.blockSize,
            data,
        });
    }

    async renderFrame() {
        if (this.rendering) return;
        this.rendering = true;
        try {
            await QRCode.toCanvas(this.buffer, this.nextPacket(), {
                errorCorrectionLevel: 'L',
                margin: 2,
                width: this.width,
            });
            this.canvas.getContext('2d').drawImage(this.buffer, 0, 0, this.canvas.width, this.canvas.height);
        } catch (error) {
            console.error('[Qast] rendu QR impossible :', error);
            this.stop();
        } finally {
            this.rendering = false;
        }
    }

    start() {
        if (this.running) return;
        this.running = true;
        this.lastTick = 0;

        const loop = (timestamp) => {
            if (!this.running) return;
            if (timestamp - this.lastTick >= 1000 / this.fps) {
                this.lastTick = timestamp;
                this.renderFrame();
            }
            this.rafId = requestAnimationFrame(loop);
        };

        this.rafId = requestAnimationFrame(loop);
    }

    stop() {
        this.running = false;
        if (this.rafId) cancelAnimationFrame(this.rafId);
        this.rafId = null;
    }

    setFps(fps) {
        this.fps = fps;
    }
}

export async function renderStaticQr(canvas, text, width = 640) {
    await QRCode.toCanvas(canvas, text, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width,
    });
    canvas.style.width = '';
    canvas.style.height = '';
}
