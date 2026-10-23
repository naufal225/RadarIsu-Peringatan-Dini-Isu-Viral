<?php

use Illuminate\Support\Facades\Route;

/*
| PRD §11. Index only: definitions live in routes/api/{file}.php, one file per owner
| (docs/OWNERSHIP.md). Every route except login: auth:sanctum + active + permission:<slug>.
*/

Route::prefix('v1')->group(function () {
    require __DIR__.'/api/auth.php';

    Route::middleware(['auth:sanctum', 'active'])->group(function () {
        foreach ([
            'users', 'sources', 'imports', 'topics', 'dashboard', 'alerts', 'briefings',
            'audit', 'replay', 'settings', 'labeling', 'evaluation', 'system',
        ] as $file) {
            require __DIR__."/api/{$file}.php";
        }
    });
});
