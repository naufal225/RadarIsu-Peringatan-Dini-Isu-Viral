<?php

namespace Tests\Feature\Settings;

use App\Models\AuditLog;
use App\Models\Setting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * PRD §11 settings (F15): Offline Mode switch, previously readable but not writable.
 */
class OfflineModeSettingsTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    private const URL = '/api/v1/settings/offline-mode';

    public function test_admin_reads_the_seeded_value(): void
    {
        $this->actingAsRole('admin');

        $this->getJson(self::URL)
            ->assertOk()
            ->assertJsonPath('data.key', 'offline_mode')
            ->assertJsonPath('data.value.enabled', false)
            ->assertJsonPath('data.updated_by', null);
    }

    public function test_other_roles_and_guests_are_rejected(): void
    {
        $this->getJson(self::URL)->assertUnauthorized();
        $this->putJson(self::URL, ['enabled' => true])->assertUnauthorized();

        foreach (['analyst', 'leader'] as $role) {
            $this->actingAsRole($role);
            $this->getJson(self::URL)->assertForbidden();
            $this->putJson(self::URL, ['enabled' => true])->assertForbidden();
            $this->resetAuth();
        }

        $this->assertFalse(Setting::find('offline_mode')->value['enabled']);
    }

    public function test_enabling_persists_and_writes_one_audit_row(): void
    {
        $admin = $this->actingAsRole('admin');

        $this->putJson(self::URL, ['enabled' => true])
            ->assertOk()
            ->assertJsonPath('data.value.enabled', true)
            ->assertJsonPath('data.updated_by', ['id' => $admin->id, 'name' => $admin->name]);

        $this->assertTrue(Setting::find('offline_mode')->value['enabled']);
        $log = AuditLog::where('action', 'settings.update')->sole();
        $this->assertSame('offline_mode', $log->detail['key']);
        $this->assertEquals(['enabled' => ['from' => false, 'to' => true]], $log->detail['changes']);
    }

    public function test_repeating_the_same_value_writes_nothing(): void
    {
        $this->actingAsRole('admin');

        $this->putJson(self::URL, ['enabled' => false])->assertOk();
        $this->putJson(self::URL, ['enabled' => true])->assertOk();
        $this->putJson(self::URL, ['enabled' => true])->assertOk();

        $this->assertSame(1, AuditLog::where('action', 'settings.update')->count());
    }

    public function test_it_can_be_switched_back_off(): void
    {
        $this->actingAsRole('admin');

        $this->putJson(self::URL, ['enabled' => true])->assertOk();
        $this->putJson(self::URL, ['enabled' => false])->assertOk()->assertJsonPath('data.value.enabled', false);

        $this->assertSame(2, AuditLog::where('action', 'settings.update')->count());
    }

    /**
     * @return array<string, array{array<string, mixed>}>
     */
    public static function invalidPayloads(): array
    {
        return [
            'missing' => [[]],
            'string' => [['enabled' => 'true']],
            'integer' => [['enabled' => 1]],
            'null' => [['enabled' => null]],
        ];
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    #[DataProvider('invalidPayloads')]
    public function test_invalid_payload_is_rejected_without_side_effects(array $payload): void
    {
        $this->actingAsRole('admin');

        $this->putJson(self::URL, $payload)->assertUnprocessable()->assertJsonValidationErrors(['enabled']);

        $this->assertFalse(Setting::find('offline_mode')->value['enabled']);
        $this->assertSame(0, AuditLog::where('action', 'settings.update')->count());
    }
}
