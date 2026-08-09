import jsQR from 'jsqr';

// Camera QR scanner: native BarcodeDetector when available, jsQR on a
// downscaled canvas otherwise. Emits every decoded raw string to onCode.
export class Scanner {
    constructor(video, onCode) {
        this.video = video;
        this.onCode = onCode;
        this.stream = null;
        this.track = null;
        this.detector = null;
        this.timerId = null;
        this.running = false;
        this.lastRaw = null;
        this.lastRawAt = 0;
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        this.busy = false;
    }

    static async listCameras() {
        const devices = await navigator.mediaDevices.enumerateDevices();

        return devices.filter((device) => device.kind === 'videoinput');
    }

    // Decode from a recorded clip (mp4/webm) of a broadcasting screen:
    // same detection loop as the live camera, on a looping playback.
    async startFile(url) {
        this.stop();
        this.video.src = url;
        this.video.loop = true;
        this.video.muted = true;
        this.video.setAttribute('playsinline', '');

        try {
            await this.video.play();
        } catch (error) {
            // Chrome pauses video-only media in hidden or occluded tabs;
            // the detect loop keeps retrying playback, so don't fail hard.
            if (error.name !== 'AbortError') throw error;
        }

        await this.#setupDetector();
        this.running = true;
        this.#loop();
    }

    async start({ deviceId, facingMode = 'environment' } = {}) {
        this.stop();

        const video = deviceId
            ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
            : { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } };

        this.stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
        this.video.srcObject = this.stream;
        this.video.setAttribute('playsinline', '');
        this.video.muted = true;
        await this.video.play();

        this.track = this.stream.getVideoTracks()[0];
        await this.#setupDetector();

        this.running = true;
        this.#loop();
    }

    async #setupDetector() {
        this.detector = null;
        if (!('BarcodeDetector' in window)) return;

        try {
            const formats = await window.BarcodeDetector.getSupportedFormats();
            if (formats.includes('qr_code')) {
                this.detector = new window.BarcodeDetector({ formats: ['qr_code'] });
            }
        } catch {
            this.detector = null;
        }
    }

    // Timer-driven rather than rAF: detection keeps running even when
    // the page is partially occluded or not being repainted.
    #loop() {
        const tick = async () => {
            if (!this.running) return;
            if (this.video.paused && this.video.src && !this.stream) {
                this.video.play().catch(() => {});
            }
            if (!this.busy && this.video.readyState >= 2) {
                this.busy = true;
                try {
                    const raw = this.detector ? await this.#detectNative() : this.#detectJsqr();
                    if (raw) this.#emit(raw);
                } catch {
                    // A failed frame is just a missed frame: the fountain
                    // code makes the next ones catch up.
                } finally {
                    this.busy = false;
                }
            }
            this.timerId = setTimeout(tick, 33);
        };

        this.timerId = setTimeout(tick, 0);
    }

    async #detectNative() {
        const barcodes = await this.detector.detect(this.video);

        return barcodes.length > 0 ? barcodes[0].rawValue : null;
    }

    #detectJsqr() {
        const videoWidth = this.video.videoWidth;
        const videoHeight = this.video.videoHeight;
        if (!videoWidth || !videoHeight) return null;

        const scale = Math.min(1, 1000 / videoWidth);
        const width = Math.round(videoWidth * scale);
        const height = Math.round(videoHeight * scale);

        this.canvas.width = width;
        this.canvas.height = height;
        this.ctx.drawImage(this.video, 0, 0, width, height);

        const imageData = this.ctx.getImageData(0, 0, width, height);
        const result = jsQR(imageData.data, width, height, { inversionAttempts: 'dontInvert' });

        return result ? result.data : null;
    }

    #emit(raw) {
        const now = performance.now();
        if (raw === this.lastRaw && now - this.lastRawAt < 250) return;
        this.lastRaw = raw;
        this.lastRawAt = now;
        this.onCode(raw);
    }

    capabilities() {
        if (!this.track || typeof this.track.getCapabilities !== 'function') return {};

        try {
            return this.track.getCapabilities();
        } catch {
            return {};
        }
    }

    async setTorch(enabled) {
        if (!this.track) return;
        await this.track.applyConstraints({ advanced: [{ torch: enabled }] });
    }

    async setZoom(value) {
        if (!this.track) return;
        await this.track.applyConstraints({ advanced: [{ zoom: value }] });
    }

    stop() {
        this.running = false;
        if (this.timerId) clearTimeout(this.timerId);
        this.timerId = null;

        if (this.stream) {
            for (const track of this.stream.getTracks()) track.stop();
            this.stream = null;
            this.track = null;
        }

        this.video.srcObject = null;
        if (this.video.src) {
            this.video.removeAttribute('src');
            this.video.load();
        }
        this.lastRaw = null;
    }
}
