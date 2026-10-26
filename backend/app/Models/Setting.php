<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Table(key: 'key', keyType: 'string', incrementing: false)]
#[Fillable(['key', 'value', 'updated_by'])]
class Setting extends Model
{
    public const CREATED_AT = null;

    /** Initial detection thresholds and weights (PRD §9.6). Reference: docs/DETECTION_SETTINGS.md. */
    public const DETECTION_DEFAULTS = [
        'coordination_window_minutes' => 15,
        'z_threshold' => 3.0,
        'min_volume' => 20,
        'baseline_hours' => 168,
        'min_baseline_hours' => 24,
        'similarity_threshold' => 0.8,
        'min_accounts_cluster' => 5,
        'young_account_days' => 30,
        'impersonation_threshold' => 0.6,
        // Constants of PRD §10.5-§10.7 that were fixed in the text, kept here so no detector hardcodes them.
        'spike_current_window_minutes' => 60,
        'spike_sample_limit' => 10,
        'synchronized_window_minutes' => 5,
        'synchronized_ratio' => 0.8,
        'impersonation_window_hours' => 24,
        // Not in the PRD: bounds how often an alert reopens for the same subject, and how many posts one
        // topic contributes to a coordination window (docs/OPEN_QUESTIONS.md).
        'cooldown_minutes' => 60,
        'coordination_max_posts' => 2000,
        'weights' => ['spike' => 40, 'anomaly' => 30, 'sentiment' => 20, 'reach' => 10],
        'severity_cutoffs' => ['medium' => 40, 'high' => 70],
        'sensitivity_z_offset' => ['low' => 1.0, 'medium' => 0.0, 'high' => -0.5],
    ];

    protected function casts(): array
    {
        return ['value' => 'array'];
    }

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    /**
     * Detection thresholds and weights as calibrated from /admin/settings (OWNERSHIP: C → A contract).
     * Detectors read this instead of hardcoding values; it is not cached, so an update applies on
     * the next run. Keys missing from the stored row fall back to the defaults.
     *
     * @return array<string, mixed>
     */
    public static function detection(): array
    {
        return array_replace_recursive(self::DETECTION_DEFAULTS, self::find('detection')?->value ?? []);
    }
}
