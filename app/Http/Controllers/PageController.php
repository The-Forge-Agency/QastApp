<?php

namespace App\Http\Controllers;

use Illuminate\View\View;

class PageController extends Controller
{
    public function landing(): View
    {
        return view('landing');
    }

    public function app(): View
    {
        return view('app');
    }
}
