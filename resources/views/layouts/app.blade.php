<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="csrf-token" content="{{ csrf_token() }}">

    <title>@yield('title', 'Qast — D\'un écran à l\'autre, sans réseau')</title>
    <meta name="description" content="@yield('description', 'Fais passer un fichier, un lien ou une note d\'un appareil à l\'autre en QR codes animés. Sans wifi, sans Bluetooth, sans serveur, sans compte. 100% hors-ligne, gratuit et open source.')">

    <link rel="icon" href="{{ asset('favicon.svg') }}" type="image/svg+xml">
    <link rel="icon" href="{{ asset('favicon-32.png') }}" type="image/png" sizes="32x32">
    <link rel="apple-touch-icon" href="{{ asset('apple-touch-icon.png') }}">
    <link rel="manifest" href="{{ asset('manifest.webmanifest') }}">
    <meta name="theme-color" content="#0C0A12">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="Qast">

    <meta property="og:title" content="@yield('og_title', 'Qast')">
    <meta property="og:description" content="D'un écran à l'autre, sans réseau. Transfert par QR codes animés, 100% hors-ligne.">
    <meta property="og:type" content="website">

    @fonts
    @vite(['resources/css/app.css', 'resources/js/app.js'])
    @stack('head')
</head>
<body class="min-h-screen antialiased" data-page="@yield('page')">
@yield('body')
</body>
</html>
