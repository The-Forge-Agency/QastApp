@extends('layouts.app')

@section('title', "Qast — Envoyer ou recevoir, sans réseau")
@section('page', 'app')

@section('body')
<div class="min-h-screen flex flex-col">
    <header class="w-full max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
        @include('partials.brand', ['size' => 30])
        <div class="flex items-center gap-2">
            <span id="offline-badge" class="pill" style="font-size: 11px; padding: 4px 10px;" hidden>hors-ligne · ça marche</span>
            <span class="kicker">#15/52</span>
        </div>
    </header>

    <main class="flex-1 w-full max-w-lg mx-auto px-4 pb-14">
        <div class="mode-tabs" role="tablist" aria-label="Mode">
            <button class="mode-tab" id="tab-send" role="tab" aria-selected="true" aria-controls="send-panel">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/><path d="M13 3h3v3M21 8V3h-3M8 13H3v3M3 21h5v-3"/></svg>
                Envoyer
            </button>
            <button class="mode-tab" id="tab-receive" role="tab" aria-selected="false" aria-controls="receive-panel">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 8V6a2 2 0 0 1 2-2h2M22 8V6a2 2 0 0 0-2-2h-2M2 16v2a2 2 0 0 0 2 2h2M22 16v2a2 2 0 0 1-2 2h-2M4 12h16"/></svg>
                Recevoir
            </button>
        </div>

        {{-- ================== ÉMETTEUR ================== --}}
        <section id="send-panel" role="tabpanel" class="mt-5">
            <div class="flex flex-wrap gap-2" role="tablist" aria-label="Type de contenu">
                <button class="type-chip" data-type="file" aria-selected="true">Fichier</button>
                <button class="type-chip" data-type="text" aria-selected="false">Texte</button>
                <button class="type-chip" data-type="link" aria-selected="false">Lien</button>
                <button class="type-chip" data-type="md" aria-selected="false">Markdown</button>
            </div>

            <div class="mt-4">
                <div id="zone-file">
                    <div class="dropzone" id="dropzone" tabindex="0" role="button" aria-label="Choisir un fichier">
                        <svg class="mx-auto mb-3" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/></svg>
                        <p class="font-semibold">Dépose un fichier ici</p>
                        <p class="muted text-sm mt-1">ou touche pour choisir · tous les formats</p>
                        <p class="muted text-xs mt-2 mono">idéal &lt; 100 Ko · max 25 Mo</p>
                    </div>
                    <input type="file" id="file-input" class="sr-only" aria-label="Fichier à envoyer">
                    <div id="file-card" class="card mt-3 p-4 flex items-center gap-3" hidden>
                        <div class="step-num shrink-0" aria-hidden="true">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><path d="M14 2v6h6"/></svg>
                        </div>
                        <div class="flex-1 min-w-0">
                            <p id="file-name" class="font-semibold text-sm truncate"></p>
                            <p id="file-size" class="muted text-xs mono mt-0.5"></p>
                        </div>
                        <button class="btn btn-ghost btn-sm" id="file-remove" aria-label="Retirer le fichier">Retirer</button>
                    </div>
                </div>

                <div id="zone-text" hidden>
                    <textarea id="input-text" class="textarea" rows="6" placeholder="Tape ou colle ton texte ici…"></textarea>
                </div>

                <div id="zone-link" hidden>
                    <input id="input-link" class="input" type="url" inputmode="url" placeholder="https://exemple.com/ton-lien">
                    <p class="muted text-xs mt-2">Un lien court tient dans un seul QR : scannable par n'importe quelle appli caméra.</p>
                </div>

                <div id="zone-md" hidden>
                    <textarea id="input-md" class="textarea" rows="8" placeholder="# Ma note&#10;&#10;Du **markdown**, une liste :&#10;- point un&#10;- point deux"></textarea>
                </div>
            </div>

            <div class="card mt-4 p-4">
                <div class="flex items-center justify-between text-sm">
                    <span class="muted">Poids</span>
                    <span class="mono" id="gauge-size">0 o</span>
                </div>
                <div class="gauge mt-2"><div class="gauge-fill" id="gauge-fill" style="width: 0%"></div></div>
                <div class="flex items-center justify-between text-sm mt-2">
                    <span class="muted">Durée estimée</span>
                    <span class="mono" id="gauge-eta">—</span>
                </div>
                <p id="gauge-warn" class="text-sm mt-3 rounded-lg p-3" style="background: var(--danger-soft); color: var(--danger);" hidden></p>
            </div>

            <div class="card mt-4 p-4">
                <div class="flex items-center justify-between gap-4">
                    <label class="text-sm muted" for="density">Densité QR</label>
                    <select id="density" class="input" style="width: auto; padding: 8px 12px; font-size: 14px;">
                        <option value="auto" selected>Auto</option>
                        <option value="s">S · caméra loin</option>
                        <option value="m">M · équilibré</option>
                        <option value="l">L · caméra proche</option>
                        <option value="xl">XL · écran net &amp; proche</option>
                    </select>
                </div>
                <div class="flex items-center justify-between gap-4 mt-4">
                    <label class="text-sm muted shrink-0" for="fps">Vitesse</label>
                    <input type="range" id="fps" class="slider" min="2" max="30" step="1" value="10">
                    <span class="mono text-sm shrink-0" id="fps-value" style="width: 52px; text-align: right;">10 i/s</span>
                </div>
            </div>

            <button class="btn btn-primary w-full mt-5" id="btn-broadcast" disabled>Diffuser</button>
            <p class="muted text-xs text-center mt-3">Rien n'est envoyé nulle part : tout se passe dans ton navigateur, même en mode avion.</p>

            <details class="card mt-4 p-4">
                <summary class="text-sm font-semibold cursor-pointer" style="color: var(--accent);">Formats acceptés &amp; limites</summary>
                <div class="mt-3 text-sm muted leading-relaxed">
                    <p><strong style="color: var(--ink);">Fichier</strong> — tous les formats sans exception : image (jpg, png, webp, gif, svg…), PDF, zip, audio, texte, binaire… Limite dure : <span class="mono">25 Mo</span> (compte ~20 min en Turbo). Idéal : <span class="mono">&lt; 100 Ko</span> pour un transfert en quelques secondes.</p>
                    <p class="mt-2"><strong style="color: var(--ink);">Image</strong> — détectée automatiquement, aperçu miniature à la réception. Pense à compresser ou réduire avant d'envoyer une photo.</p>
                    <p class="mt-2"><strong style="color: var(--ink);">Texte &amp; Markdown</strong> — jusqu'à 25 Mo. Sous ~700 caractères, un seul QR statique suffit : scannable par n'importe quelle appli caméra.</p>
                    <p class="mt-2"><strong style="color: var(--ink);">Lien</strong> — toute URL http(s) jusqu'à 1 200 caractères, toujours en QR statique instantané.</p>
                    <p class="mt-2"><strong style="color: var(--ink);">Débit &amp; réglages</strong> — un écran filmé transporte d'environ <span class="mono">1 Ko/s</span> (S, 8 i/s) à <span class="mono">~20 Ko/s</span> (XL, 30 i/s). Pour un gros fichier : densité XL, vitesse au max, plein écran, écrans nets et stables, caméra bien cadrée. La jauge ci-dessus affiche poids et durée estimée avec tes réglages. Les frames ratées ne coûtent rien : les fountain codes les rattrapent.</p>
                </div>
            </details>
        </section>

        {{-- ================== RÉCEPTEUR ================== --}}
        <section id="receive-panel" role="tabpanel" class="mt-5" hidden>
            <div id="cam-start" class="card p-6 text-center">
                <svg class="mx-auto mb-4" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                <h2 class="font-display font-bold text-lg">Vise l'écran qui clignote</h2>
                <p class="muted text-sm mt-2">Ouvre la caméra et cadre les QR codes de l'émetteur. Les paquets s'accumulent tout seuls, l'ordre n'a aucune importance.</p>
                <button class="btn btn-primary w-full mt-5" id="btn-camera">Ouvrir la caméra</button>
                <button class="btn w-full mt-3" id="btn-video">Importer une vidéo de l'écran filmé</button>
                <input type="file" id="video-input" class="sr-only" accept="video/*" aria-label="Vidéo à décoder">
                <p class="muted text-xs mt-3">Tu as filmé la pellicule de QR ? Importe le clip (mp4, webm, mov…) : Qast le rejoue et reconstruit le contenu. L'image reste sur ton appareil. Rien ne part, jamais.</p>
            </div>

            <div id="cam-error" class="card p-6 text-center" hidden>
                <h2 class="font-display font-bold text-lg">Caméra indisponible</h2>
                <p class="muted text-sm mt-2" id="cam-error-msg">L'accès à la caméra a été refusé. Autorise la caméra pour ce site dans les réglages du navigateur, puis réessaie.</p>
                <button class="btn w-full mt-5" id="btn-camera-retry">Réessayer</button>
            </div>

            <div id="cam-live" hidden>
                <div class="cam-frame">
                    <video id="cam-video" playsinline muted></video>
                    <div class="cam-reticle" id="cam-reticle"></div>
                    <div class="cam-overlay">
                        <div class="flex items-center justify-end gap-2">
                            <button class="btn btn-sm" id="btn-torch" hidden aria-pressed="false">Torche</button>
                            <button class="btn btn-sm" id="btn-cam-switch" hidden>Changer de caméra</button>
                        </div>
                        <div id="cam-zoom-wrap" hidden>
                            <input type="range" id="cam-zoom" class="slider" aria-label="Zoom">
                        </div>
                    </div>
                </div>

                <div class="card mt-4 p-4" id="rx-progress">
                    <div class="flex items-center justify-between text-sm">
                        <span class="muted">Réception</span>
                        <span class="mono" id="rx-percent">en attente…</span>
                    </div>
                    <div class="progress mt-2"><div class="progress-fill" id="rx-bar" style="width: 0%"></div></div>
                    <div class="flex items-center justify-between mt-2 text-xs muted mono">
                        <span id="rx-blocks">—</span>
                        <span id="rx-packets">0 paquet capté</span>
                    </div>
                    <p class="text-xs mt-2" id="rx-hint" style="color: var(--accent);" hidden></p>
                </div>

                <button class="btn w-full mt-4" id="btn-cam-stop">Arrêter</button>
            </div>

            <div id="rx-result" hidden>
                <div class="card p-5">
                    <div class="flex items-center gap-2">
                        <span class="pill" id="rx-type-pill">Reçu</span>
                        <span class="muted text-xs mono" id="rx-meta"></span>
                    </div>
                    <div class="preview-box mt-4" id="rx-preview"></div>
                    <div class="flex flex-wrap gap-2 mt-4">
                        <button class="btn btn-primary btn-sm" id="btn-open" hidden>Ouvrir le lien</button>
                        <button class="btn btn-primary btn-sm" id="btn-download" hidden>Télécharger</button>
                        <button class="btn btn-sm" id="btn-copy" hidden>Copier</button>
                        <button class="btn btn-sm" id="btn-share" hidden>Partager</button>
                    </div>
                </div>
                <button class="btn w-full mt-4" id="btn-again">Recevoir autre chose</button>
            </div>
        </section>
    </main>

    {{-- ================== SCÈNE DE DIFFUSION ================== --}}
    <div class="stage-fullscreen" id="stage" hidden>
        <div class="flex items-center justify-between">
            <span class="pill" id="stage-mode">QR animés</span>
            <div class="flex gap-2">
                <button class="btn btn-sm" id="stage-fs">Plein écran</button>
                <button class="btn btn-sm" id="stage-close">Fermer</button>
            </div>
        </div>

        <div class="flex-1 flex items-center justify-center py-4">
            <div class="qr-stage w-full" style="max-width: min(92vw, 64vh);">
                <canvas id="stage-canvas" width="640" height="640"></canvas>
            </div>
        </div>

        <div class="w-full max-w-lg mx-auto">
            <p class="text-center text-sm muted" id="stage-hint">Fais cadrer cet écran par la caméra du récepteur.</p>
            <p class="text-center mono text-xs muted mt-1" id="stage-meta"></p>
            <div id="stage-controls" class="card mt-3 p-4">
                <div class="flex items-center justify-between gap-4">
                    <label class="text-sm muted shrink-0" for="stage-fps">Vitesse</label>
                    <input type="range" id="stage-fps" class="slider" min="2" max="30" step="1" value="10">
                    <span class="mono text-sm shrink-0" id="stage-fps-value" style="width: 52px; text-align: right;">10 i/s</span>
                </div>
                <div class="flex items-center justify-between gap-4 mt-3">
                    <label class="text-sm muted" for="stage-density">Densité</label>
                    <select id="stage-density" class="input" style="width: auto; padding: 8px 12px; font-size: 14px;">
                        <option value="s">S · caméra loin</option>
                        <option value="m">M · équilibré</option>
                        <option value="l">L · caméra proche</option>
                        <option value="xl">XL · écran net &amp; proche</option>
                    </select>
                </div>
                <button class="btn btn-sm w-full mt-3" id="stage-turbo">⚡ Turbo — XL à 30 i/s, caméra tout près de l'écran</button>
            </div>
            <button class="btn w-full mt-3" id="stage-animate" hidden>Diffuser en animé quand même</button>
        </div>
    </div>

    <div class="toast" id="toast" role="status"></div>
</div>
@endsection
