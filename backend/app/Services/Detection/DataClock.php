<?php

namespace App\Services\Detection;

use App\Models\Setting;
use Carbon\CarbonImmutable;

/**
 * The clock detectors read (PRD §10.3). Replay mode moves it by setting `settings.replay.clock.now`;
 * otherwise it is the wall clock. Detectors never call now() themselves, so a replay and a live run
 * see the same window logic.
 */
class DataClock
{
    public static function now(): CarbonImmutable
    {
        $virtual = Setting::find('replay.clock')?->value['now'] ?? null;

        return $virtual !== null ? CarbonImmutable::parse($virtual)->utc() : CarbonImmutable::now('UTC');
    }
}
