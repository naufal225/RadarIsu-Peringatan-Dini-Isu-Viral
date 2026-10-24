<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Seeder;

class SettingsSeeder extends Seeder
{
    /**
     * Initial detection thresholds and weights (PRD §9.6). Calibrated later from /admin/settings.
     */
    public function run(): void
    {
        $defaults = [
            'detection' => Setting::DETECTION_DEFAULTS,
            'offline_mode' => ['enabled' => false],
            'replay.clock' => ['now' => null],
        ];

        foreach ($defaults as $key => $value) {
            Setting::firstOrCreate(['key' => $key], ['value' => $value]);
        }
    }
}
