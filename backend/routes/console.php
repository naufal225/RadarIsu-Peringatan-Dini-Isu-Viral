<?php

use App\Jobs\NormalizePostsJob;
use App\Support\PermissionsTypeScript;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

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

// PRD §10.2. Imports and ingestors dispatch NormalizePostsJob themselves; the sweep picks up whatever
// a lost job or a stopped worker left behind. `radarisu:aggregate` is the safety net behind the
// event-driven AggregateMetricsJob.
Schedule::job(new NormalizePostsJob)->everyMinute()->withoutOverlapping();
Schedule::command('radarisu:aggregate')->everyFiveMinutes()->withoutOverlapping();
Schedule::command('radarisu:detect')->everyMinute()->withoutOverlapping();
