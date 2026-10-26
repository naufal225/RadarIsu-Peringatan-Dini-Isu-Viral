<?php

namespace Tests\Feature\Settings;

use App\Models\AuditLog;
use App\Models\Setting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * PRD §11 /settings/detection (F15). Rules are documented in docs/DETECTION_SETTINGS.md.
 */
class DetectionSettingsTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    private const URL = '/api/v1/settings/detection';

    public function test_admin_reads_seeded_values(): void
    {
        $this->actingAsRole('admin');

        $this->getJson(self::URL)
            ->assertOk()
            ->assertJsonPath('data.key', 'detection')
            ->assertJsonPath('data.value.z_threshold', 3)
            ->assertJsonPath('data.value.weights', ['spike' => 40, 'anomaly' => 30, 'sentiment' => 20, 'reach' => 10])
            ->assertJsonPath('data.updated_by', null);
    }

    public function test_other_roles_are_forbidden(): void
    {
        foreach (['analyst', 'leader'] as $role) {
            $this->actingAsRole($role);
            $this->getJson(self::URL)->assertForbidden();
            $this->putJson(self::URL, Setting::DETECTION_DEFAULTS)->assertForbidden();
            $this->resetAuth();
        }
    }

    public function test_seeded_defaults_pass_their_own_validation(): void
    {
        $this->actingAsRole('admin');

        $this->putJson(self::URL, Setting::DETECTION_DEFAULTS)->assertOk();
        $this->assertSame(0, AuditLog::where('action', 'settings.update')->count());
    }

    public function test_update_persists_audits_and_applies_immediately(): void
    {
        $admin = $this->actingAsRole('admin');
        $payload = $this->payload(['z_threshold' => 4.5, 'weights' => ['spike' => 35, 'anomaly' => 35, 'sentiment' => 20, 'reach' => 10]]);

        $this->putJson(self::URL, $payload)
            ->assertOk()
            ->assertJsonPath('data.value.z_threshold', 4.5)
            ->assertJsonPath('data.value.weights.anomaly', 35)
            ->assertJsonPath('data.updated_by', ['id' => $admin->id, 'name' => $admin->name]);

        $this->getJson(self::URL)->assertJsonPath('data.value.z_threshold', 4.5);
        $this->assertSame(4.5, Setting::detection()['z_threshold']);
        $this->assertSame($admin->id, Setting::find('detection')->updated_by);

        $log = AuditLog::where('action', 'settings.update')->sole();
        $this->assertSame($admin->id, $log->user_id);
        $this->assertSame('detection', $log->detail['key']);
        $this->assertEquals(
            [
                'z_threshold' => ['from' => 3, 'to' => 4.5],
                'weights.spike' => ['from' => 40, 'to' => 35],
                'weights.anomaly' => ['from' => 30, 'to' => 35],
            ],
            $log->detail['changes'],
        );
    }

    public function test_update_without_changes_writes_no_audit_row(): void
    {
        $this->actingAsRole('admin');

        $this->putJson(self::URL, $this->payload())->assertOk();
        $this->putJson(self::URL, $this->payload(['min_volume' => 25]))->assertOk();
        $this->putJson(self::URL, $this->payload(['min_volume' => 25]))->assertOk();

        $this->assertSame(1, AuditLog::where('action', 'settings.update')->count());
    }

    public function test_unknown_keys_are_not_stored(): void
    {
        $this->actingAsRole('admin');

        $this->putJson(self::URL, $this->payload(['evil' => 'x', 'weights' => ['spike' => 40, 'anomaly' => 30, 'sentiment' => 20, 'reach' => 10, 'extra' => 5]]))
            ->assertOk();

        $this->assertArrayNotHasKey('evil', Setting::find('detection')->value);
        $this->assertArrayNotHasKey('extra', Setting::find('detection')->value['weights']);
    }

    /**
     * @return array<string, array{array<string, mixed>, string}>
     */
    public static function invalidChanges(): array
    {
        return [
            'weights do not add up to 100' => [['weights' => ['spike' => 40, 'anomaly' => 30, 'sentiment' => 20, 'reach' => 20]], 'weights'],
            'weights below 100' => [['weights' => ['spike' => 10, 'anomaly' => 10, 'sentiment' => 10, 'reach' => 10]], 'weights'],
            'medium cutoff not below high' => [['severity_cutoffs' => ['medium' => 70, 'high' => 70]], 'severity_cutoffs.medium'],
            'min baseline above baseline' => [['baseline_hours' => 24, 'min_baseline_hours' => 48], 'min_baseline_hours'],
            'offsets out of order' => [['sensitivity_z_offset' => ['low' => 0.0, 'medium' => 1.0, 'high' => -0.5]], 'sensitivity_z_offset'],
            'z threshold below 2' => [['z_threshold' => 1.5], 'z_threshold'],
            'similarity above 1' => [['similarity_threshold' => 1.2], 'similarity_threshold'],
            'cluster of one account' => [['min_accounts_cluster' => 1], 'min_accounts_cluster'],
            'window beyond range' => [['coordination_window_minutes' => 181], 'coordination_window_minutes'],
            'negative weight' => [['weights' => ['spike' => 110, 'anomaly' => -10, 'sentiment' => 0, 'reach' => 0]], 'weights.anomaly'],
            'string instead of number' => [['min_volume' => 'banyak'], 'min_volume'],
            'numeric string' => [['min_volume' => '25'], 'min_volume'],
            'fraction for integer field' => [['young_account_days' => 30.5], 'young_account_days'],
            'spike window below range' => [['spike_current_window_minutes' => 14], 'spike_current_window_minutes'],
            'sample limit of zero' => [['spike_sample_limit' => 0], 'spike_sample_limit'],
            'synchronized window beyond range' => [['synchronized_window_minutes' => 61], 'synchronized_window_minutes'],
            'synchronized ratio below half' => [['synchronized_ratio' => 0.4], 'synchronized_ratio'],
            'impersonation window beyond a week' => [['impersonation_window_hours' => 169], 'impersonation_window_hours'],
            'negative cooldown' => [['cooldown_minutes' => -1], 'cooldown_minutes'],
            'cooldown as string' => [['cooldown_minutes' => '60'], 'cooldown_minutes'],
            'post cap too small' => [['coordination_max_posts' => 99], 'coordination_max_posts'],
        ];
    }

    /**
     * @param  array<string, mixed>  $changes
     */
    #[DataProvider('invalidChanges')]
    public function test_invalid_payload_is_rejected_without_side_effects(array $changes, string $field): void
    {
        $this->actingAsRole('admin');

        $this->putJson(self::URL, $this->payload($changes))
            ->assertUnprocessable()
            ->assertJsonValidationErrors([$field]);

        // jsonb does not keep key order or the ".0" of floats, so compare by value.
        $this->assertEquals(Setting::DETECTION_DEFAULTS, Setting::find('detection')->value);
        $this->assertSame(0, AuditLog::where('action', 'settings.update')->count());
    }

    public function test_missing_key_is_rejected(): void
    {
        $this->actingAsRole('admin');
        $payload = $this->payload();
        unset($payload['impersonation_threshold'], $payload['weights']['reach']);

        $this->putJson(self::URL, $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['impersonation_threshold', 'weights.reach']);
    }

    public function test_detection_falls_back_to_defaults_without_a_row(): void
    {
        Setting::whereKey('detection')->delete();

        $this->assertSame(Setting::DETECTION_DEFAULTS, Setting::detection());
    }

    public function test_detection_fills_keys_missing_from_the_stored_row(): void
    {
        Setting::whereKey('detection')->update(['value' => json_encode(['min_volume' => 99])]);

        $detection = Setting::detection();

        $this->assertSame(99, $detection['min_volume']);
        $this->assertSame(Setting::DETECTION_DEFAULTS['weights'], $detection['weights']);
    }

    public function test_detector_keys_default_to_the_prd_constants(): void
    {
        $detection = Setting::detection();

        $this->assertSame(60, $detection['spike_current_window_minutes']);
        $this->assertSame(10, $detection['spike_sample_limit']);
        $this->assertSame(5, $detection['synchronized_window_minutes']);
        $this->assertSame(0.8, $detection['synchronized_ratio']);
        $this->assertSame(24, $detection['impersonation_window_hours']);
    }

    public function test_row_saved_before_the_new_keys_still_reads_with_defaults(): void
    {
        $old = Setting::DETECTION_DEFAULTS;
        foreach (['cooldown_minutes', 'coordination_max_posts', 'impersonation_window_hours', 'synchronized_ratio',
            'synchronized_window_minutes', 'spike_current_window_minutes', 'spike_sample_limit'] as $key) {
            unset($old[$key]);
        }
        Setting::whereKey('detection')->update(['value' => json_encode($old)]);

        $this->assertSame(60, Setting::detection()['cooldown_minutes']);
        $this->assertSame(2000, Setting::detection()['coordination_max_posts']);
    }

    public function test_changing_a_new_key_is_audited(): void
    {
        $this->actingAsRole('admin');

        $this->putJson(self::URL, $this->payload(['cooldown_minutes' => 120]))
            ->assertOk()
            ->assertJsonPath('data.value.cooldown_minutes', 120);

        $this->assertEquals(
            ['cooldown_minutes' => ['from' => 60, 'to' => 120]],
            AuditLog::where('action', 'settings.update')->sole()->detail['changes'],
        );
    }

    /**
     * Valid payload; `$changes` replace top-level keys wholesale.
     *
     * @param  array<string, mixed>  $changes
     * @return array<string, mixed>
     */
    private function payload(array $changes = []): array
    {
        return array_replace(Setting::DETECTION_DEFAULTS, $changes);
    }
}
