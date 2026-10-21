<?php

namespace Tests\Feature\System;

use App\Models\Alert;
use App\Models\Source;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * PRD §11 GET /system/status: source health, queue, data counts.
 */
class SystemStatusTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    public function test_reports_sources_queue_and_counts(): void
    {
        $source = Source::factory()->create(['type' => 'csv', 'last_status' => 'error', 'last_error' => 'boom']);
        DB::table('raw_items')->insert([
            ['source_id' => $source->id, 'payload' => '{}', 'content_hash' => str_repeat('a', 64), 'fetched_at' => now(), 'processed_at' => null],
            ['source_id' => $source->id, 'payload' => '{}', 'content_hash' => str_repeat('b', 64), 'fetched_at' => now(), 'processed_at' => now()],
        ]);
        Alert::factory()->status('new')->create();
        Alert::factory()->status('closed')->create();
        DB::table('jobs')->insert(['queue' => 'default', 'payload' => '{}', 'attempts' => 0, 'available_at' => time(), 'created_at' => time()]);
        DB::table('failed_jobs')->insert([
            'uuid' => 'f-1', 'connection' => 'database', 'queue' => 'default',
            'payload' => '{"displayName":"App\\\\Jobs\\\\Example"}', 'exception' => "RuntimeException: gagal\n#0 trace", 'failed_at' => now(),
        ]);
        $this->actingAsRole('admin');

        $this->getJson('/api/v1/system/status')
            ->assertOk()
            ->assertJsonPath('data.sources.0.id', $source->id)
            ->assertJsonPath('data.sources.0.last_status', 'error')
            ->assertJsonPath('data.sources.0.last_error', 'boom')
            ->assertJsonPath('data.queue.pending_jobs', 1)
            ->assertJsonPath('data.queue.failed_jobs', 1)
            ->assertJsonPath('data.queue.recent_failures.0.job', 'App\\Jobs\\Example')
            ->assertJsonPath('data.queue.recent_failures.0.error', 'RuntimeException: gagal')
            ->assertJsonPath('data.counts.raw_items', 2)
            ->assertJsonPath('data.counts.unprocessed_raw_items', 1)
            ->assertJsonPath('data.counts.posts', 0)
            ->assertJsonPath('data.counts.open_alerts', 1)
            ->assertJsonPath('data.offline_mode', false);
    }
}
