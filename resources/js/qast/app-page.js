import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { Broadcaster, renderStaticQr, DENSITIES, estimateTransfer } from './sender.js';
import { Scanner } from './receiver.js';
import { LTDecoder } from './lt.js';
import { decodePacket, buildPayload, parsePayload } from './packet.js';

const SOFT_LIMIT = 100 * 1024;
const HARD_LIMIT = 5 * 1024 * 1024;
const SINGLE_QR_TEXT_MAX = 700;
const SINGLE_QR_LINK_MAX = 1200;

const TYPE_LABELS = {
    link: 'Lien reçu',
    text: 'Texte reçu',
    md: 'Note markdown',
    image: 'Image reçue',
    file: 'Fichier reçu',
};

export function initAppPage() {
    const $ = (id) => document.getElementById(id);
    const encoder = new TextEncoder();

    const state = {
        type: 'file',
        file: null,
        fileBytes: null,
        broadcaster: null,
        stagePayload: null,
        scanner: null,
        decoder: null,
        transferId: null,
        packetsSeen: 0,
        cameras: [],
        cameraIndex: 0,
        torchOn: false,
        wakeLock: null,
        result: null,
        resultUrl: null,
        videoUrl: null,
        packetTimes: [],
    };

    const settings = {
        density: localStorage.getItem('qast.density') || 'auto',
        fps: parseInt(localStorage.getItem('qast.fps') || '10', 10),
    };

    /* ---------- Utilitaires ---------- */

    let toastTimer = null;
    function toast(message) {
        const el = $('toast');
        el.textContent = message;
        el.classList.add('is-visible');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => el.classList.remove('is-visible'), 2400);
    }

    function fmtBytes(n) {
        if (n < 1024) return `${n} o`;
        if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} Ko`;
        return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
    }

    function fmtDuration(seconds) {
        if (seconds < 1) return '< 1 s';
        if (seconds < 60) return `~${Math.ceil(seconds)} s`;
        return `~${Math.floor(seconds / 60)} min ${Math.ceil(seconds % 60)} s`;
    }

    function looksLikeUrl(text) {
        return /^https?:\/\/\S+$/i.test(text.trim());
    }

    function celebrate() {
        if (navigator.vibrate) navigator.vibrate([90, 40, 90]);
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.frequency.value = 880;
            gain.gain.setValueAtTime(0.08, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
            osc.connect(gain).connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.25);
        } catch {
            // No audio? The vibration or the UI will do.
        }
    }

    async function holdWakeLock() {
        try {
            state.wakeLock = await navigator.wakeLock?.request('screen');
        } catch {
            state.wakeLock = null;
        }
    }

    function releaseWakeLock() {
        state.wakeLock?.release().catch(() => {});
        state.wakeLock = null;
    }

    /* ---------- Contenu émetteur ---------- */

    function currentContent() {
        if (state.type === 'file') {
            if (!state.file || !state.fileBytes) return null;
            const isImage = (state.file.type || '').startsWith('image/');
            return {
                meta: { t: isImage ? 'image' : 'file', n: state.file.name, m: state.file.type || 'application/octet-stream' },
                bytes: state.fileBytes,
                raw: null,
            };
        }

        if (state.type === 'link') {
            const raw = $('input-link').value.trim();
            if (!raw) return null;
            return { meta: { t: 'link' }, bytes: encoder.encode(raw), raw };
        }

        const raw = (state.type === 'md' ? $('input-md') : $('input-text')).value;
        if (!raw.trim()) return null;
        return { meta: { t: state.type }, bytes: encoder.encode(raw), raw };
    }

    function fitsSingleQr(content) {
        if (!content || !content.raw) return false;
        if (content.meta.t === 'link') return content.raw.length <= SINGLE_QR_LINK_MAX;
        return content.bytes.length <= SINGLE_QR_TEXT_MAX;
    }

    function densityFor(byteLength) {
        if (settings.density !== 'auto') return settings.density;
        if (byteLength <= 2 * 1024) return 's';
        if (byteLength <= 60 * 1024) return 'm';
        if (byteLength <= 300 * 1024) return 'l';
        return 'xl';
    }

    function refreshGauge() {
        const content = currentContent();
        const warn = $('gauge-warn');
        const fill = $('gauge-fill');
        const cta = $('btn-broadcast');

        if (!content) {
            $('gauge-size').textContent = '0 o';
            $('gauge-eta').textContent = '—';
            fill.style.width = '0%';
            fill.classList.remove('is-warn');
            warn.hidden = true;
            cta.disabled = true;
            return;
        }

        const size = content.bytes.length;
        $('gauge-size').textContent = fmtBytes(size);
        fill.style.width = `${Math.min(100, (size / SOFT_LIMIT) * 100)}%`;
        fill.classList.toggle('is-warn', size > SOFT_LIMIT);

        if (fitsSingleQr(content)) {
            $('gauge-eta').textContent = 'instantané · 1 seul QR';
        } else {
            const density = densityFor(size);
            const estimate = estimateTransfer(size, density, settings.fps);
            $('gauge-eta').textContent = `${fmtDuration(estimate.seconds)} · ${estimate.k} blocs`;
        }

        if (size > HARD_LIMIT) {
            warn.textContent = `Trop lourd pour un transfert par écran (${fmtBytes(size)}). Qast est fait pour le petit et sûr : réduis l'image, compresse le fichier, ou reste sous ${fmtBytes(HARD_LIMIT)}.`;
            warn.hidden = false;
            cta.disabled = true;
            return;
        }

        if (size > SOFT_LIMIT) {
            const density = densityFor(size);
            const estimate = estimateTransfer(size, density, settings.fps);
            const best = estimateTransfer(size, 'xl', 30);
            const tip = estimate.seconds > best.seconds * 1.2
                ? ` En densité XL à 30 i/s : ${fmtDuration(best.seconds)} — il faut un écran net, stable, et une bonne caméra.`
                : ' Écrans propres et stables, plein écran conseillé.';
            warn.textContent = `Au-delà de ${fmtBytes(SOFT_LIMIT)}, ça prend du temps (${fmtDuration(estimate.seconds)} avec tes réglages).${tip}`;
            warn.hidden = false;
        } else {
            warn.hidden = true;
        }

        cta.disabled = false;
    }

    /* ---------- Onglets & types ---------- */

    function selectMode(mode) {
        const sending = mode === 'send';
        $('tab-send').setAttribute('aria-selected', String(sending));
        $('tab-receive').setAttribute('aria-selected', String(!sending));
        $('send-panel').hidden = !sending;
        $('receive-panel').hidden = sending;
        if (sending) stopCamera();
    }

    $('tab-send').addEventListener('click', () => selectMode('send'));
    $('tab-receive').addEventListener('click', () => selectMode('receive'));

    document.querySelectorAll('.type-chip').forEach((chip) => {
        chip.addEventListener('click', () => {
            state.type = chip.dataset.type;
            document.querySelectorAll('.type-chip').forEach((other) => {
                other.setAttribute('aria-selected', String(other === chip));
            });
            for (const zone of ['file', 'text', 'link', 'md']) {
                $(`zone-${zone}`).hidden = zone !== state.type;
            }
            refreshGauge();
        });
    });

    /* ---------- Fichier ---------- */

    async function acceptFile(file) {
        if (!file) return;
        if (file.size > HARD_LIMIT) {
            toast(`Trop lourd : ${fmtBytes(file.size)} (max ${fmtBytes(HARD_LIMIT)})`);
            return;
        }
        state.file = file;
        state.fileBytes = new Uint8Array(await file.arrayBuffer());
        $('file-name').textContent = file.name;
        $('file-size').textContent = `${fmtBytes(file.size)} · ${file.type || 'type inconnu'}`;
        $('file-card').hidden = false;
        $('dropzone').hidden = true;
        refreshGauge();
    }

    const dropzone = $('dropzone');
    dropzone.addEventListener('click', () => $('file-input').click());
    dropzone.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            $('file-input').click();
        }
    });
    dropzone.addEventListener('dragover', (event) => {
        event.preventDefault();
        dropzone.classList.add('is-over');
    });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('is-over'));
    dropzone.addEventListener('drop', (event) => {
        event.preventDefault();
        dropzone.classList.remove('is-over');
        acceptFile(event.dataTransfer.files[0]);
    });
    $('file-input').addEventListener('change', (event) => acceptFile(event.target.files[0]));
    $('file-remove').addEventListener('click', () => {
        state.file = null;
        state.fileBytes = null;
        $('file-input').value = '';
        $('file-card').hidden = true;
        $('dropzone').hidden = false;
        refreshGauge();
    });

    for (const id of ['input-text', 'input-link', 'input-md']) {
        $(id).addEventListener('input', refreshGauge);
    }

    /* ---------- Réglages ---------- */

    $('density').value = settings.density;
    $('fps').value = String(settings.fps);
    $('fps-value').textContent = `${settings.fps} i/s`;

    $('density').addEventListener('change', (event) => {
        settings.density = event.target.value;
        localStorage.setItem('qast.density', settings.density);
        refreshGauge();
    });

    $('fps').addEventListener('input', (event) => {
        settings.fps = parseInt(event.target.value, 10);
        localStorage.setItem('qast.fps', String(settings.fps));
        $('fps-value').textContent = `${settings.fps} i/s`;
        refreshGauge();
    });

    /* ---------- Scène de diffusion ---------- */

    function stageMeta(broadcaster) {
        const loop = broadcaster.k / settings.fps;
        return `${broadcaster.k} blocs · ${fmtBytes(broadcaster.encoder.totalLen)} · boucle ${fmtDuration(Math.max(1, loop))}`;
    }

    function startBroadcast(payloadBytes, densityKey) {
        state.broadcaster?.stop();
        const { blockSize, width } = DENSITIES[densityKey];
        state.broadcaster = new Broadcaster($('stage-canvas'), payloadBytes, {
            blockSize,
            fps: settings.fps,
            width,
        });
        state.broadcaster.start();
        $('stage-mode').textContent = 'QR animés';
        $('stage-meta').textContent = stageMeta(state.broadcaster);
        $('stage-hint').textContent = "Fais cadrer cet écran par la caméra du récepteur. L'ordre des images n'a pas d'importance.";
        $('stage-controls').hidden = false;
        $('stage-animate').hidden = true;
    }

    async function openStage() {
        const content = currentContent();
        if (!content) return;

        $('stage').hidden = false;
        document.body.style.overflow = 'hidden';
        await holdWakeLock();

        $('stage-density').value = densityFor(content.bytes.length);
        $('stage-fps').value = String(settings.fps);
        $('stage-fps-value').textContent = `${settings.fps} i/s`;

        if (fitsSingleQr(content)) {
            state.stagePayload = buildPayload(content.meta, content.bytes);
            await renderStaticQr($('stage-canvas'), content.raw);
            $('stage-mode').textContent = 'QR statique';
            $('stage-meta').textContent = 'tient dans un seul code';
            $('stage-hint').textContent = "Scannable par n'importe quelle appli caméra, même sans Qast en face.";
            $('stage-controls').hidden = true;
            $('stage-animate').hidden = false;
        } else {
            state.stagePayload = buildPayload(content.meta, content.bytes);
            startBroadcast(state.stagePayload, densityFor(content.bytes.length));
        }
    }

    function closeStage() {
        state.broadcaster?.stop();
        state.broadcaster = null;
        state.stagePayload = null;
        $('stage').hidden = true;
        document.body.style.overflow = '';
        releaseWakeLock();
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    }

    $('btn-broadcast').addEventListener('click', openStage);
    $('stage-close').addEventListener('click', closeStage);
    $('stage-fs').addEventListener('click', () => {
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
        } else {
            $('stage').requestFullscreen?.().catch(() => toast('Plein écran indisponible ici'));
        }
    });

    $('stage-fps').addEventListener('input', (event) => {
        settings.fps = parseInt(event.target.value, 10);
        localStorage.setItem('qast.fps', String(settings.fps));
        $('stage-fps-value').textContent = `${settings.fps} i/s`;
        $('fps').value = String(settings.fps);
        $('fps-value').textContent = `${settings.fps} i/s`;
        state.broadcaster?.setFps(settings.fps);
        if (state.broadcaster) $('stage-meta').textContent = stageMeta(state.broadcaster);
    });

    $('stage-density').addEventListener('change', (event) => {
        if (state.stagePayload && state.broadcaster) {
            startBroadcast(state.stagePayload, event.target.value);
        }
    });

    $('stage-animate').addEventListener('click', () => {
        if (state.stagePayload) {
            startBroadcast(state.stagePayload, $('stage-density').value);
        }
    });

    $('stage-turbo').addEventListener('click', () => {
        settings.fps = 30;
        localStorage.setItem('qast.fps', '30');
        for (const [slider, label] of [['stage-fps', 'stage-fps-value'], ['fps', 'fps-value']]) {
            $(slider).value = '30';
            $(label).textContent = '30 i/s';
        }
        $('stage-density').value = 'xl';
        if (state.stagePayload) startBroadcast(state.stagePayload, 'xl');
        toast('Turbo : rapproche bien la caméra de l\'écran');
    });

    /* ---------- Récepteur ---------- */

    function resetReception() {
        state.decoder = null;
        state.transferId = null;
        state.packetsSeen = 0;
        state.packetTimes = [];
        $('rx-percent').textContent = 'en attente…';
        $('rx-bar').style.width = '0%';
        $('rx-bar').classList.remove('is-done');
        $('rx-blocks').textContent = '—';
        $('rx-packets').textContent = '0 paquet capté';
        $('rx-hint').hidden = true;
    }

    function updateProgress() {
        const decoder = state.decoder;
        if (!decoder) return;
        const percent = Math.floor(decoder.progress * 100);
        $('rx-percent').textContent = `${percent} %`;
        $('rx-bar').style.width = `${percent}%`;
        $('rx-blocks').textContent = `${decoder.decodedCount}/${decoder.k} blocs · manque ${decoder.k - decoder.decodedCount}`;

        const now = performance.now();
        state.packetTimes = state.packetTimes.filter((t) => now - t < 3000);
        const rate = state.packetTimes.length / 3;
        $('rx-packets').textContent = `${state.packetsSeen} paquets · ${rate.toFixed(1)} QR/s`;

        const hint = $('rx-hint');
        if (state.packetsSeen > 5 && rate < 3) {
            hint.textContent = 'Débit faible : rapproche la caméra, stabilise, vérifie la netteté.';
            hint.hidden = false;
        } else if (rate >= 8) {
            hint.textContent = 'Excellent débit — tu peux monter la vitesse ou la densité côté émetteur.';
            hint.hidden = false;
        } else {
            hint.hidden = true;
        }
    }

    let reticleTimer = null;
    function flashReticle() {
        const reticle = $('cam-reticle');
        reticle.classList.add('is-locked');
        clearTimeout(reticleTimer);
        reticleTimer = setTimeout(() => reticle.classList.remove('is-locked'), 350);
    }

    function onCode(raw) {
        const packet = decodePacket(raw);

        if (!packet) {
            // Plain QR (a URL, a text) scanned with the Qast receiver:
            // deliver it directly unless an animated transfer is underway.
            if (!state.decoder) {
                finishReception(
                    { t: looksLikeUrl(raw) ? 'link' : 'text' },
                    encoder.encode(raw),
                );
            }
            return;
        }

        flashReticle();

        if (!state.decoder || state.transferId !== packet.transferId) {
            state.decoder = new LTDecoder({
                k: packet.k,
                blockSize: packet.blockSize,
                totalLen: packet.totalLen,
            });
            state.transferId = packet.transferId;
            state.packetsSeen = 0;
        }

        state.packetsSeen++;
        state.packetTimes.push(performance.now());
        state.decoder.addPacket(packet.ptype, packet.seed, packet.data);
        updateProgress();

        if (state.decoder.isComplete) {
            const parsed = parsePayload(state.decoder.payload());
            $('rx-bar').classList.add('is-done');
            if (parsed) {
                finishReception(parsed.meta, parsed.content);
            } else {
                toast('Contenu reçu illisible — réessaie');
                resetReception();
            }
        }
    }

    async function startCamera(deviceId) {
        $('cam-start').hidden = true;
        $('cam-error').hidden = true;

        if (!navigator.mediaDevices?.getUserMedia) {
            $('cam-error-msg').textContent = "Ce navigateur n'expose pas la caméra. Essaie Chrome, Edge, Firefox ou Safari récent, en HTTPS.";
            $('cam-error').hidden = false;
            return;
        }

        state.scanner ??= new Scanner($('cam-video'), onCode);
        $('cam-video').style.objectFit = '';

        try {
            await state.scanner.start(deviceId ? { deviceId } : {});
        } catch (error) {
            $('cam-error-msg').textContent = error?.name === 'NotAllowedError'
                ? "L'accès à la caméra a été refusé. Autorise la caméra pour ce site dans les réglages du navigateur, puis réessaie."
                : 'Impossible de démarrer la caméra. Vérifie qu\'aucune autre appli ne l\'utilise, puis réessaie.';
            $('cam-error').hidden = false;
            return;
        }

        $('cam-live').hidden = false;
        $('rx-result').hidden = true;
        resetReception();
        await holdWakeLock();

        try {
            state.cameras = await Scanner.listCameras();
        } catch {
            state.cameras = [];
        }
        $('btn-cam-switch').hidden = state.cameras.length < 2;

        const caps = state.scanner.capabilities();
        $('btn-torch').hidden = !caps.torch;
        state.torchOn = false;
        $('btn-torch').setAttribute('aria-pressed', 'false');

        if (caps.zoom && caps.zoom.max > caps.zoom.min) {
            const zoom = $('cam-zoom');
            zoom.min = caps.zoom.min;
            zoom.max = caps.zoom.max;
            zoom.step = caps.zoom.step || 0.1;
            zoom.value = caps.zoom.min;
            $('cam-zoom-wrap').hidden = false;
        } else {
            $('cam-zoom-wrap').hidden = true;
        }
    }

    function stopCamera() {
        state.scanner?.stop();
        releaseWakeLock();
        $('cam-live').hidden = true;
        if ($('rx-result').hidden) $('cam-start').hidden = false;
    }

    async function startVideoDecode(file) {
        $('cam-start').hidden = true;
        $('cam-error').hidden = true;
        $('rx-result').hidden = true;

        state.scanner ??= new Scanner($('cam-video'), onCode);
        if (state.videoUrl) URL.revokeObjectURL(state.videoUrl);
        state.videoUrl = URL.createObjectURL(file);

        try {
            await state.scanner.startFile(state.videoUrl);
        } catch {
            $('cam-error-msg').textContent = 'Impossible de lire cette vidéo. Formats supportés : mp4, webm, mov (selon le navigateur).';
            $('cam-error').hidden = false;
            return;
        }

        $('cam-video').style.objectFit = 'contain';
        $('cam-live').hidden = false;
        $('btn-cam-switch').hidden = true;
        $('btn-torch').hidden = true;
        $('cam-zoom-wrap').hidden = true;
        resetReception();
        $('rx-percent').textContent = 'lecture du clip…';
        await holdWakeLock();
    }

    $('btn-camera').addEventListener('click', () => startCamera());
    $('btn-camera-retry').addEventListener('click', () => startCamera());
    $('btn-cam-stop').addEventListener('click', () => stopCamera());
    $('btn-video').addEventListener('click', () => $('video-input').click());
    $('video-input').addEventListener('change', (event) => {
        const file = event.target.files[0];
        event.target.value = '';
        if (file) startVideoDecode(file);
    });

    $('btn-cam-switch').addEventListener('click', () => {
        if (state.cameras.length < 2) return;
        state.cameraIndex = (state.cameraIndex + 1) % state.cameras.length;
        startCamera(state.cameras[state.cameraIndex].deviceId);
    });

    $('btn-torch').addEventListener('click', async () => {
        state.torchOn = !state.torchOn;
        try {
            await state.scanner.setTorch(state.torchOn);
            $('btn-torch').setAttribute('aria-pressed', String(state.torchOn));
        } catch {
            toast('Torche indisponible');
        }
    });

    $('cam-zoom').addEventListener('input', (event) => {
        state.scanner?.setZoom(parseFloat(event.target.value)).catch(() => {});
    });

    /* ---------- Résultat ---------- */

    function finishReception(meta, contentBytes) {
        state.scanner?.stop();
        releaseWakeLock();
        celebrate();

        if (state.resultUrl) URL.revokeObjectURL(state.resultUrl);
        state.resultUrl = null;

        const type = TYPE_LABELS[meta.t] ? meta.t : 'file';
        const preview = $('rx-preview');
        preview.innerHTML = '';
        preview.classList.remove('md-body');

        let text = null;
        if (type === 'link' || type === 'text' || type === 'md') {
            text = new TextDecoder().decode(contentBytes);
        }

        $('rx-type-pill').textContent = TYPE_LABELS[type];
        $('rx-meta').textContent = meta.n
            ? `${meta.n} · ${fmtBytes(contentBytes.length)}`
            : fmtBytes(contentBytes.length);

        if (type === 'link') {
            const anchor = document.createElement('a');
            anchor.href = text;
            anchor.textContent = text;
            anchor.target = '_blank';
            anchor.rel = 'noopener noreferrer';
            anchor.style.color = 'var(--accent)';
            anchor.style.textDecoration = 'underline';
            preview.appendChild(anchor);
        } else if (type === 'text') {
            const block = document.createElement('div');
            block.style.whiteSpace = 'pre-wrap';
            block.textContent = text;
            preview.appendChild(block);
        } else if (type === 'md') {
            preview.classList.add('md-body');
            preview.innerHTML = DOMPurify.sanitize(marked.parse(text, { breaks: true, gfm: true }));
        } else {
            const blob = new Blob([contentBytes], { type: meta.m || 'application/octet-stream' });
            state.resultUrl = URL.createObjectURL(blob);
            if (type === 'image') {
                const img = document.createElement('img');
                img.src = state.resultUrl;
                img.alt = meta.n || 'Image reçue';
                preview.appendChild(img);
            } else {
                const info = document.createElement('div');
                info.className = 'text-center';
                info.innerHTML = '<p class="font-semibold"></p><p class="muted text-xs mono mt-1"></p>';
                info.querySelector('p').textContent = meta.n || 'fichier';
                info.querySelector('.muted').textContent = `${fmtBytes(contentBytes.length)} · ${meta.m || 'binaire'}`;
                preview.appendChild(info);
            }
        }

        state.result = { meta: { ...meta, t: type }, contentBytes, text };

        $('btn-open').hidden = type !== 'link';
        $('btn-copy').hidden = text === null || !navigator.clipboard;
        $('btn-download').hidden = !(type === 'image' || type === 'file' || type === 'md');
        $('btn-share').hidden = !navigator.share;

        $('cam-live').hidden = true;
        $('cam-start').hidden = true;
        $('rx-result').hidden = false;
    }

    $('btn-open').addEventListener('click', () => {
        if (state.result?.text) window.open(state.result.text, '_blank', 'noopener');
    });

    $('btn-copy').addEventListener('click', async () => {
        if (!state.result || state.result.text === null) return;
        try {
            await navigator.clipboard.writeText(state.result.text);
            toast('Copié !');
        } catch {
            toast('Copie impossible ici');
        }
    });

    function resultFile() {
        const { meta, contentBytes, text } = state.result;
        const name = meta.n || (meta.t === 'md' ? 'note.md' : 'qast-recu.bin');
        const mime = meta.m || (meta.t === 'md' ? 'text/markdown' : 'application/octet-stream');
        return new File([text !== null ? text : contentBytes], name, { type: mime });
    }

    $('btn-download').addEventListener('click', () => {
        const file = resultFile();
        const url = URL.createObjectURL(file);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = file.name;
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
    });

    $('btn-share').addEventListener('click', async () => {
        const { meta, text } = state.result;
        try {
            if (text !== null && meta.t !== 'md') {
                await navigator.share(meta.t === 'link' ? { url: text } : { text });
            } else {
                const file = resultFile();
                if (navigator.canShare?.({ files: [file] })) {
                    await navigator.share({ files: [file] });
                } else if (text !== null) {
                    await navigator.share({ text });
                } else {
                    toast('Partage de fichier non supporté ici');
                }
            }
        } catch {
            // User cancelled the share sheet: nothing to do.
        }
    });

    $('btn-again').addEventListener('click', () => {
        $('rx-result').hidden = true;
        state.result = null;
        startCamera();
    });

    /* ---------- Divers ---------- */

    function refreshOfflineBadge() {
        $('offline-badge').hidden = navigator.onLine;
    }
    window.addEventListener('online', refreshOfflineBadge);
    window.addEventListener('offline', refreshOfflineBadge);
    refreshOfflineBadge();

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && (state.broadcaster?.running || state.scanner?.running)) {
            holdWakeLock();
        }
    });

    window.addEventListener('pagehide', () => {
        state.broadcaster?.stop();
        state.scanner?.stop();
    });

    if (location.hash === '#recevoir') selectMode('receive');

    refreshGauge();
}
