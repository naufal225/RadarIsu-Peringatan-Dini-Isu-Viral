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
            'detection' => [
                'coordination_window_minutes' => 15,
                'z_threshold' => 3.0,
                'min_volume' => 20,
                'baseline_hours' => 168,
                'min_baseline_hours' => 24,
                'similarity_threshold' => 0.8,
                'min_accounts_cluster' => 5,
                'young_account_days' => 30,
                'impersonation_threshold' => 0.6,
                'weights' => ['spike' => 40, 'anomaly' => 30, 'sentiment' => 20, 'reach' => 10],
                'severity_cutoffs' => ['medium' => 40, 'high' => 70],
                'sensitivity_z_offset' => ['low' => 1.0, 'medium' => 0.0, 'high' => -0.5],
            ],
            'offline_mode' => ['enabled' => false],
            'replay.clock' => ['now' => null],
        ];

        foreach ($defaults as $key => $value) {
            Setting::firstOrCreate(['key' => $key], ['value' => $value]);
        }
    }
}
