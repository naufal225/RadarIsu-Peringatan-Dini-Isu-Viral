<?php

namespace Tests\Feature\Replay;

use App\Jobs\ReplayScenarioJob;
use App\Models\AuditLog;
use App\Models\Post;
use App\Models\ReplayScenario;
use App\Models\Topic;
use App\Services\Ingest\ReplayRunner;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Illuminate\Testing\TestResponse;
use Tests\Concerns\BuildsReplayScenarios;
use Tests\TestCase;

class ReplayApiTest extends TestCase
{
    use BuildsReplayScenarios;
    use RefreshDatabase;

    protected bool $seed = true;

    private function upload(string $csv, array $fields = []): TestResponse
    {
        return $this->post('/api/v1/replay/scenarios', array_replace([
            'file' => UploadedFile::fake()->createWithContent('skenario.csv', $csv),
            'name' => 'Skenario uji',
        ], $fields), ['Accept' => 'application/json']);
    }

    public function test_an_admin_uploads_a_scenario(): void
    {
        $admin = $this->actingAsRole('admin');

        $this->upload($this->smallScenarioCsv(), ['description' => 'catatan', 'default_speed_factor' => 300])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Skenario uji')
            ->assertJsonPath('data.total_rows', 6)
            ->assertJsonPath('data.status', 'idle')
            ->assertJsonPath('data.default_speed_factor', 300)
            ->assertJsonPath('data.incident_start_offset_seconds', 3600);

        $this->assertSame($admin->id, ReplayScenario::firstOrFail()->created_by);
    }

    public function test_a_bad_upload_is_a_422_with_the_reason(): void
    {
        $this->actingAsRole('admin');

        $this->upload($this->scenarioCsv(['x,baseline,t,@a,,,']))
            ->assertStatus(422)
            ->assertJsonPath('errors.file.0', 'invalid_rows')
            ->assertJsonPath('errors.rows.0', '2:invalid_offset_seconds');
        $this->post('/api/v1/replay/scenarios', ['name' => 'tanpa berkas'], ['Accept' => 'application/json'])
            ->assertStatus(422)->assertJsonValidationErrors('file');
        $this->upload($this->smallScenarioCsv(), ['name' => ''])->assertStatus(422)->assertJsonValidationErrors('name');
        $this->upload($this->smallScenarioCsv(), ['default_speed_factor' => 0])->assertStatus(422)->assertJsonValidationErrors('default_speed_factor');
        $this->assertSame(0, ReplayScenario::count());
    }

    public function test_scenarios_are_listed_newest_first_with_the_clock(): void
    {
        $this->actingAsRole('admin');
        $first = $this->importScenario($this->smallScenarioCsv(), ['name' => 'Lama']);
        $second = $this->importScenario($this->smallScenarioCsv(), ['name' => 'Baru']);

        $this->getJson('/api/v1/replay/scenarios')
            ->assertOk()
            ->assertJsonPath('data.0.id', $second->id)
            ->assertJsonPath('data.1.id', $first->id)
            ->assertJsonPath('meta.total', 2)
            ->assertJsonPath('meta.clock_now', null)
            ->assertJsonStructure(['data' => [['id', 'name', 'status', 'speed_factor', 'progress_rows', 'total_rows', 'virtual_anchor_at', 'error']], 'meta' => ['current_page', 'last_page', 'per_page', 'total', 'clock_now', 'data_now']]);
        $this->getJson('/api/v1/replay/scenarios?per_page=500')->assertStatus(422);
    }

    public function test_start_hands_the_run_to_a_job_and_is_audited(): void
    {
        Queue::fake();
        $admin = $this->actingAsRole('admin');
        $scenario = $this->importScenario($this->smallScenarioCsv(), ['default_speed_factor' => 600]);

        $this->postJson("/api/v1/replay/scenarios/{$scenario->id}/start", ['speed_factor' => 120])
            ->assertStatus(202)
            ->assertJsonPath('data.status', 'running')
            ->assertJsonPath('data.speed_factor', 120)
            ->assertJsonPath('data.run_number', 1);

        Queue::assertPushedOn('replay', ReplayScenarioJob::class, fn (ReplayScenarioJob $job) => $job->scenarioId === $scenario->id);
        $log = AuditLog::where('action', 'replay.start')->firstOrFail();
        $this->assertSame($admin->id, $log->user_id);
        $this->assertSame(120, $log->detail['speed_factor']);
    }

    public function test_start_uses_the_default_speed_when_none_is_given(): void
    {
        Queue::fake();
        $this->actingAsRole('admin');
        $scenario = $this->importScenario($this->smallScenarioCsv(), ['default_speed_factor' => 600]);

        $this->postJson("/api/v1/replay/scenarios/{$scenario->id}/start")->assertStatus(202)->assertJsonPath('data.speed_factor', 600);
    }

    public function test_start_rejects_a_bad_speed_and_a_busy_scenario(): void
    {
        Queue::fake();
        $this->actingAsRole('admin');
        $a = $this->importScenario($this->smallScenarioCsv(), ['name' => 'A']);
        $b = $this->importScenario($this->smallScenarioCsv(), ['name' => 'B']);

        $this->postJson("/api/v1/replay/scenarios/{$a->id}/start", ['speed_factor' => 0])->assertStatus(422);
        $this->postJson("/api/v1/replay/scenarios/{$a->id}/start", ['speed_factor' => 100001])->assertStatus(422);
        $this->postJson("/api/v1/replay/scenarios/{$a->id}/start", ['speed_factor' => 'fast'])->assertStatus(422);
        $this->assertSame('idle', $a->refresh()->status);

        $this->postJson("/api/v1/replay/scenarios/{$a->id}/start")->assertStatus(202);
        $this->postJson("/api/v1/replay/scenarios/{$a->id}/start")->assertStatus(409)->assertJsonPath('message', 'already_running');
        $this->postJson("/api/v1/replay/scenarios/{$b->id}/start")->assertStatus(409)->assertJsonPath('message', 'another_running');
        $this->postJson('/api/v1/replay/scenarios/9999/start')->assertNotFound();
        $this->assertSame(1, AuditLog::where('action', 'replay.start')->count(), 'refused starts are not audited');
    }

    public function test_a_scenario_without_rows_is_refused(): void
    {
        Queue::fake();
        $this->actingAsRole('admin');
        $scenario = ReplayScenario::factory()->create();

        $this->postJson("/api/v1/replay/scenarios/{$scenario->id}/start")->assertStatus(409)->assertJsonPath('message', 'empty_scenario');
    }

    public function test_stop_ends_a_running_scenario_and_is_audited(): void
    {
        Queue::fake();
        $this->actingAsRole('admin');
        $scenario = $this->importScenario($this->smallScenarioCsv());
        $this->postJson("/api/v1/replay/scenarios/{$scenario->id}/start")->assertStatus(202);

        $this->postJson("/api/v1/replay/scenarios/{$scenario->id}/stop")->assertOk()->assertJsonPath('data.status', 'stopped');

        $this->assertNotNull($scenario->refresh()->finished_at);
        $this->assertSame(1, AuditLog::where('action', 'replay.stop')->count());
        $this->postJson("/api/v1/replay/scenarios/{$scenario->id}/stop")->assertStatus(409)->assertJsonPath('message', 'not_running');
        $this->assertSame(1, AuditLog::where('action', 'replay.stop')->count());
    }

    public function test_stopping_an_idle_scenario_is_a_409(): void
    {
        $this->actingAsRole('admin');
        $scenario = $this->importScenario($this->smallScenarioCsv());

        $this->postJson("/api/v1/replay/scenarios/{$scenario->id}/stop")->assertStatus(409);
    }

    public function test_the_queued_run_plays_the_scenario_to_the_end(): void
    {
        // The test queue is `sync`, so the job runs inside the request; a huge speed keeps the waits at microseconds.
        Topic::factory()->create(['keywords' => ['institusi contoh']]);
        $this->actingAsRole('admin');
        $scenario = $this->importScenario($this->smallScenarioCsv());

        $this->postJson("/api/v1/replay/scenarios/{$scenario->id}/start", ['speed_factor' => 100000])
            ->assertStatus(202)
            ->assertJsonPath('data.status', 'finished')
            ->assertJsonPath('data.progress_rows', 6);

        $this->assertSame(6, Post::where('source_id', $scenario->refresh()->source_id)->count());
        $this->assertNull(ReplayRunner::clockNow());
    }

    public function test_the_job_ignores_a_scenario_that_is_no_longer_running(): void
    {
        $scenario = $this->importScenario($this->smallScenarioCsv());

        (new ReplayScenarioJob($scenario->id))->handle(app(ReplayRunner::class));
        (new ReplayScenarioJob(999999))->handle(app(ReplayRunner::class));

        $this->assertSame('idle', $scenario->refresh()->status);
        $this->assertSame(0, Post::count());
    }

    public function test_a_failed_job_closes_the_run(): void
    {
        Queue::fake();
        $this->actingAsRole('admin');
        $scenario = $this->importScenario($this->smallScenarioCsv());
        $this->postJson("/api/v1/replay/scenarios/{$scenario->id}/start")->assertStatus(202);

        (new ReplayScenarioJob($scenario->id))->failed(new \RuntimeException('worker killed'));

        $scenario->refresh();
        $this->assertSame('stopped', $scenario->status);
        $this->assertSame('worker killed', $scenario->error);
    }

    public function test_only_admins_may_use_replay(): void
    {
        $scenario = $this->importScenario($this->smallScenarioCsv());

        $this->getJson('/api/v1/replay/scenarios')->assertUnauthorized();

        foreach (['analyst', 'leader'] as $role) {
            $this->resetAuth();
            $this->actingAsRole($role);
            $this->getJson('/api/v1/replay/scenarios')->assertForbidden();
            $this->upload($this->smallScenarioCsv())->assertForbidden();
            $this->postJson("/api/v1/replay/scenarios/{$scenario->id}/start")->assertForbidden();
            $this->postJson("/api/v1/replay/scenarios/{$scenario->id}/stop")->assertForbidden();
        }

        $this->assertSame('idle', $scenario->refresh()->status);
    }
}
