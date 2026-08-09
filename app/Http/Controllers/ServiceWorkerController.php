<?php

namespace App\Http\Controllers;

use Illuminate\Http\Response;
use Illuminate\Support\Facades\File;

class ServiceWorkerController extends Controller
{
    /**
     * Serve the offline-first service worker with a precache list built
     * from the Vite build manifest, versioned by its content hash.
     */
    public function __invoke(): Response
    {
        [$version, $assets] = $this->buildAssets();

        $precache = array_values(array_unique(array_merge([
            '/',
            '/app',
            '/manifest.webmanifest',
            '/favicon.svg',
            '/icons/favicon-192.png',
            '/icons/favicon-512.png',
            '/icons/favicon-180.png',
        ], $assets)));

        $js = view('sw', [
            'cacheName' => 'qast-'.$version,
            'precache' => json_encode($precache),
        ])->render();

        return response($js, 200, [
            'Content-Type' => 'application/javascript; charset=utf-8',
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
        ]);
    }

    /**
     * @return array{0: string, 1: list<string>}
     */
    private function buildAssets(): array
    {
        $manifestPath = public_path('build/manifest.json');

        if (! File::exists($manifestPath)) {
            return ['dev', []];
        }

        $raw = File::get($manifestPath);
        $manifest = json_decode($raw, true) ?: [];
        $assets = [];

        foreach ($manifest as $entry) {
            foreach (array_merge(
                isset($entry['file']) ? [$entry['file']] : [],
                $entry['css'] ?? [],
                $entry['assets'] ?? [],
            ) as $file) {
                $assets[] = '/build/'.$file;
            }
        }

        return [md5($raw), $assets];
    }
}
