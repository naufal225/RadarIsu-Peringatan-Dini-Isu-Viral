<?php

use App\Support\PermissionsTypeScript;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('permissions:export-ts {--check : Fail if the generated file is out of date}', function () {
    $path = PermissionsTypeScript::defaultPath();
    $contents = PermissionsTypeScript::render();

    if ($this->option('check')) {
        if (! is_file($path) || file_get_contents($path) !== $contents) {
            $this->error("$path is out of date. Run `php artisan permissions:export-ts`.");

            return 1;
        }
        $this->info("$path is up to date.");

        return 0;
    }

    file_put_contents($path, $contents);
    $this->info("Wrote $path");

    return 0;
})->purpose('Generate frontend/src/lib/permissions.ts from config/permissions.php');
