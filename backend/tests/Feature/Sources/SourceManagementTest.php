<?php

namespace Tests\Feature\Sources;

use App\Models\AuditLog;
use App\Models\Source;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * PRD §9.2, §11 /sources (Phase 2).
 */
class SourceManagementTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    public static function validSources(): array
    {
        return [
            'rss' => [['type' => 'rss', 'name' => 'Berita', 'config' => ['url' => 'https://example.org/feed.xml'], 'interval_minutes' => 15],
                ['url' => 'https://example.org/feed.xml', 'max_items' => 50], 15],
            'youtube' => [['type' => 'youtube', 'name' => 'Video', 'config' => ['video_ids' => ['dQw4w9WgXcQ']], 'interval_minutes' => 30],
                ['video_ids' => ['dQw4w9WgXcQ']], 30],
            'csv' => [['type' => 'csv', 'name' => 'Impor manual'], [], null],
        ];
    }

    #[DataProvider('validSources')]
    public function test_admin_creates_source(array $payload, array $expectedConfig, ?int $expectedInterval): void
    {
        $admin = $this->actingAsRole('admin');

        $response = $this->postJson('/api/v1/sources', $payload)
            ->assertCreated()
            ->assertJsonPath('data.type', $payload['type'])
            ->assertJsonPath('data.last_status', 'never')
            ->assertJsonPath('data.is_simulated', false);

        $source = Source::findOrFail($response->json('data.id'));
        $this->assertSame($expectedConfig, $source->config);
        $this->assertSame($expectedInterval, $source->interval_minutes);
        $this->assertSame($admin->id, $source->created_by);
        $this->assertSame(1, AuditLog::where('action', 'source.create')->where('object_id', $source->id)->count());
    }

    public static function invalidSources(): array
    {
        return [
            'replay is internal' => [['type' => 'replay', 'name' => 'x'], 'type'],
            'unknown type' => [['type' => 'ftp', 'name' => 'x'], 'type'],
            'rss without url' => [['type' => 'rss', 'name' => 'x', 'config' => [], 'interval_minutes' => 15], 'config.url'],
            'rss non-http url' => [['type' => 'rss', 'name' => 'x', 'config' => ['url' => 'file:///etc/passwd'], 'interval_minutes' => 15], 'config.url'],
            'rss max_items too big' => [['type' => 'rss', 'name' => 'x', 'config' => ['url' => 'https://a.example/f', 'max_items' => 500], 'interval_minutes' => 15], 'config.max_items'],
            'rss interval too small' => [['type' => 'rss', 'name' => 'x', 'config' => ['url' => 'https://a.example/f'], 'interval_minutes' => 1], 'interval_minutes'],
            'youtube bad id' => [['type' => 'youtube', 'name' => 'x', 'config' => ['video_ids' => ['bad id!']], 'interval_minutes' => 15], 'config.video_ids.0'],
            'youtube no ids' => [['type' => 'youtube', 'name' => 'x', 'config' => ['video_ids' => []], 'interval_minutes' => 15], 'config.video_ids'],
            'csv with interval' => [['type' => 'csv', 'name' => 'x', 'interval_minutes' => 15], 'interval_minutes'],
            'missing name' => [['type' => 'csv'], 'name'],
        ];
    }

    #[DataProvider('invalidSources')]
    public function test_source_validation(array $payload, string $errorKey): void
    {
        $this->actingAsRole('admin');

        $this->postJson('/api/v1/sources', $payload)->assertUnprocessable()->assertJsonValidationErrors($errorKey);
        $this->assertSame(0, Source::count());
    }

    public function test_admin_updates_source_but_not_its_type(): void
    {
        $source = Source::factory()->create(['type' => 'rss', 'config' => ['url' => 'https://a.example/f', 'max_items' => 50], 'interval_minutes' => 15]);
        $this->actingAsRole('admin');

        $this->patchJson("/api/v1/sources/{$source->id}", ['name' => 'Baru', 'is_active' => false, 'interval_minutes' => 60])
            ->assertOk()
            ->assertJsonPath('data.name', 'Baru')
            ->assertJsonPath('data.is_active', false);

        $this->patchJson("/api/v1/sources/{$source->id}", ['type' => 'csv'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('type');

        $this->assertSame('rss', $source->fresh()->type);
        $this->assertSame(1, AuditLog::where('action', 'source.update')->count());
    }

    public function test_update_revalidates_config_for_existing_type(): void
    {
        $source = Source::factory()->create(['type' => 'rss', 'config' => ['url' => 'https://a.example/f', 'max_items' => 50], 'interval_minutes' => 15]);
        $this->actingAsRole('admin');

        $this->patchJson("/api/v1/sources/{$source->id}", ['config' => ['url' => 'ftp://a.example/f']])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('config.url');
    }

    public function test_admin_lists_sources_with_raw_item_counts(): void
    {
        Source::factory()->count(2)->create();
        $this->actingAsRole('admin');

        $this->getJson('/api/v1/sources')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonStructure(['data' => [['id', 'type', 'name', 'config', 'interval_minutes', 'is_active', 'last_status', 'last_fetched_at', 'last_error', 'raw_items_count']]]);
    }
}
