<?php

it('serves the landing page', function () {
    $response = $this->get('/');

    $response->assertOk()
        ->assertSee('Qast', false)
        ->assertSee('sans', false)
        ->assertSee('manifest.webmanifest', false);
});

it('serves the app page with sender and receiver panels', function () {
    $response = $this->get('/app');

    $response->assertOk()
        ->assertSee('Envoyer', false)
        ->assertSee('Recevoir', false)
        ->assertSee('Diffuser', false)
        ->assertSee('Ouvrir la caméra', false)
        ->assertSee('Importer une vidéo', false)
        ->assertSee('Formats acceptés', false)
        ->assertSee('max 5 Mo', false);
});

it('serves the service worker as cache-first javascript', function () {
    $response = $this->get('/sw.js');

    $response->assertOk()
        ->assertHeader('Content-Type', 'application/javascript; charset=utf-8');

    $body = $response->getContent();

    expect($body)
        ->toContain('CACHE_NAME')
        ->toContain("'/app'")
        ->toContain('caches.match');
});

it('ships a valid installable web manifest', function () {
    $manifest = json_decode(file_get_contents(public_path('manifest.webmanifest')), true);

    expect($manifest)->not->toBeNull()
        ->and($manifest['name'])->toContain('Qast')
        ->and($manifest['display'])->toBe('standalone')
        ->and($manifest['start_url'])->toBe('/app')
        ->and(collect($manifest['icons'])->pluck('sizes'))->toContain('512x512');

    foreach ($manifest['icons'] as $icon) {
        expect(file_exists(public_path($icon['src'])))->toBeTrue();
    }
});
