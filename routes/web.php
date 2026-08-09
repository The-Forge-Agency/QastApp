<?php

use App\Http\Controllers\PageController;
use App\Http\Controllers\ServiceWorkerController;
use Illuminate\Support\Facades\Route;

Route::get('/', [PageController::class, 'landing'])->name('landing');
Route::get('/app', [PageController::class, 'app'])->name('app');
Route::get('/sw.js', ServiceWorkerController::class)->name('sw');
