@extends('layouts.app')

@section('page', 'landing')

@section('body')
<div class="min-h-screen flex flex-col">
    <div class="w-full max-w-6xl mx-auto px-5 flex-1">
        <nav class="flex items-center justify-between py-5">
            @include('partials.brand')
            <div class="flex items-center gap-3 sm:gap-5">
                <a href="#comment" class="muted text-sm hover:text-[color:var(--ink)] transition-colors hidden sm:inline">Comment ça marche</a>
                <a href="https://github.com/The-Forge-Agency/QastApp" target="_blank" rel="noopener" class="muted text-sm hover:text-[color:var(--ink)] transition-colors hidden sm:inline">GitHub</a>
                <span class="kicker hidden sm:inline" style="border: 1px solid var(--bd); padding: 5px 13px; border-radius: 20px;">#15/52</span>
                <a href="{{ route('app') }}" class="btn btn-primary btn-sm">Ouvrir l'app</a>
            </div>
        </nav>

        <section class="text-center pt-10 sm:pt-16 pb-6 max-w-3xl mx-auto">
            <span class="pill">App #15/52 · 100% hors-ligne, même en mode avion</span>
            <h1 class="hero-title text-4xl sm:text-6xl mt-6 mb-5">D'un écran à l'autre, sans <span style="color: var(--accent);">réseau</span></h1>
            <p class="muted text-base sm:text-lg leading-relaxed max-w-xl mx-auto">
                Qast fait sauter un fichier, un lien ou une note d'un appareil à l'autre en QR codes animés
                que l'autre caméra filme. Ni wifi, ni Bluetooth, ni serveur, ni compte.
            </p>
            <div class="flex flex-col sm:flex-row gap-3 justify-center mt-8">
                <a href="{{ route('app') }}#envoyer" class="btn btn-primary">Envoyer quelque chose</a>
                <a href="{{ route('app') }}#recevoir" class="btn">Recevoir avec la caméra</a>
            </div>
            <p class="muted text-sm mt-4">Zéro compte · gratuit · open source</p>
        </section>

        <section class="mt-8 sm:mt-12 max-w-4xl mx-auto" aria-label="Démonstration">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div class="card p-5">
                    <p class="kicker mb-3">1 · L'émetteur clignote</p>
                    <div class="qr-stage">
                        <canvas id="demo-canvas" width="480" height="480" aria-label="QR codes animés de démonstration"></canvas>
                    </div>
                    <p class="muted text-xs mono mt-3 text-center">une nuée de QR en boucle · l'ordre n'importe pas</p>
                </div>
                <div class="card p-5 flex flex-col">
                    <p class="kicker mb-3">2 · Le récepteur filme</p>
                    <div class="flex-1 flex flex-col justify-center" style="background: var(--bg); border-radius: 14px; padding: 22px;">
                        <div class="flex items-center justify-between text-sm">
                            <span class="muted">Réception</span>
                            <span class="mono" id="demo-percent">0 %</span>
                        </div>
                        <div class="progress mt-2"><div class="progress-fill" id="demo-bar" style="width: 0%"></div></div>
                        <div class="mt-5 text-center transition-opacity duration-300" id="demo-done" style="opacity: 0;">
                            <span class="pill">note-de-voyage.md reconstruite ✓</span>
                        </div>
                    </div>
                    <p class="muted text-xs mono mt-3 text-center">wifi coupé des deux côtés · ça marche quand même</p>
                </div>
            </div>
        </section>

        <section id="comment" class="mt-16 sm:mt-24">
            <h2 class="font-display font-bold text-2xl sm:text-3xl text-center" style="letter-spacing: -0.6px;">Comment ça marche</h2>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8 max-w-4xl mx-auto">
                <div class="card p-5">
                    <div class="step-num mb-4">1</div>
                    <h3 class="font-display font-bold mb-2">Dépose</h3>
                    <p class="muted text-sm leading-relaxed">Un fichier, une image, un lien, un texte ou une note markdown. Tout reste dans ton navigateur : rien n'est envoyé nulle part.</p>
                </div>
                <div class="card p-5">
                    <div class="step-num mb-4">2</div>
                    <h3 class="font-display font-bold mb-2">Diffuse</h3>
                    <p class="muted text-sm leading-relaxed">Le contenu est découpé en paquets fountain codes et défile en QR animés. Frames ratées ? Elles se rattrapent toutes seules.</p>
                </div>
                <div class="card p-5">
                    <div class="step-num mb-4">3</div>
                    <h3 class="font-display font-bold mb-2">Filme</h3>
                    <p class="muted text-sm leading-relaxed">L'autre appareil vise l'écran avec sa caméra. Les paquets s'accumulent, le fichier se reconstruit, aperçu et téléchargement.</p>
                </div>
            </div>
            <p class="muted text-sm text-center mt-6 max-w-xl mx-auto">Et si le contenu tient dans un seul QR — un lien, une courte note — Qast affiche un code statique scannable par n'importe quelle appli caméra.</p>
        </section>

        <section class="mt-16 sm:mt-24 max-w-4xl mx-auto">
            <h2 class="font-display font-bold text-2xl sm:text-3xl text-center" style="letter-spacing: -0.6px;">Trois promesses, aucune exception</h2>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
                <div class="card p-5 text-center">
                    <h3 class="font-display font-bold" style="color: var(--accent);">Hors-ligne</h3>
                    <p class="muted text-sm mt-2 leading-relaxed">PWA installable, en cache dès le premier chargement. Avion, site isolé, machine air-gapped : ça marche, indéfiniment.</p>
                </div>
                <div class="card p-5 text-center">
                    <h3 class="font-display font-bold" style="color: var(--accent);">Sans compte</h3>
                    <p class="muted text-sm mt-2 leading-relaxed">Pas de login, pas d'email, pas de paywall, jamais. Gratuit, financé par des dons.</p>
                </div>
                <div class="card p-5 text-center">
                    <h3 class="font-display font-bold" style="color: var(--accent);">Rien ne part</h3>
                    <p class="muted text-sm mt-2 leading-relaxed">Aucun serveur au moment du transfert. Coupe le wifi en pleine démo : le fichier saute quand même d'un écran à l'autre.</p>
                </div>
            </div>
        </section>

        <section class="mt-16 sm:mt-24 text-center pb-4">
            <h2 class="font-display font-bold text-2xl sm:text-3xl" style="letter-spacing: -0.6px;">iPhone → Android → PC → Linux</h2>
            <p class="muted mt-3 max-w-xl mx-auto text-sm sm:text-base leading-relaxed">N'importe quels deux appareils avec un écran et une caméra. Pas d'AirDrop capricieux, pas d'appairage Bluetooth, pas de câble introuvable.</p>
            <a href="{{ route('app') }}" class="btn btn-primary mt-7">Essayer maintenant</a>
        </section>
    </div>

    <footer class="border-t mt-16" style="border-color: var(--bd);">
        <div class="w-full max-w-6xl mx-auto px-5 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm muted">
            <span>Qast · app #15/52 · TFA52</span>
            <span class="flex items-center gap-4">
                <a href="https://github.com/The-Forge-Agency/QastApp" target="_blank" rel="noopener" class="hover:text-[color:var(--ink)] transition-colors">Open source</a>
                <a href="https://buymeacoffee.com/tfa.the.forge.agency" target="_blank" rel="noopener" class="hover:text-[color:var(--ink)] transition-colors">Offrir un café</a>
            </span>
        </div>
    </footer>
</div>
@endsection
