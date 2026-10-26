<?php

namespace Tests\Feature\Replay;

use App\Models\Alert;
use App\Models\AlertEvidence;
use App\Models\Post;
use App\Models\ReplayScenario;
use App\Models\Topic;
use App\Services\Detection\DataClock;
use App\Services\Ingest\ReplayRunner;
use Database\Seeders\DemoScenarioSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The F11 definition of done: a replay raises alerts through the same pipeline as live data (PRD §18, Phase 7).
 * The test queue is `sync`, so the pipeline jobs run inside the command.
 */
class ReplayDemoScenarioTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    private function seedDemo(): ReplayScenario
    {
        $this->seed(DemoScenarioSeeder::class);

        return ReplayScenario::where('name', DemoScenarioSeeder::SCENARIO_NAME)->firstOrFail();
    }

    public function test_the_seeder_builds_the_labelled_script_once(): void
    {
        $scenario = $this->seedDemo();
        $this->seed(DemoScenarioSeeder::class);

        $this->assertSame(1, ReplayScenario::count());
        $this->assertSame(1, Topic::where('name', DemoScenarioSeeder::TOPIC_NAME)->count());

        $baseline = DemoScenarioSeeder::BASELINE_HOURS;
        $this->assertSame($baseline * 3600, $scenario->incident_start_offset_seconds);
        $this->assertSame(DemoScenarioSeeder::CAMPAIGN_ACCOUNTS, $scenario->rows()->where('label_manual', 'anomalous')->count());
        $this->assertSame(0, $scenario->rows()->whereNull('label_manual')->count(), 'every row carries its manual label');
        $this->assertSame($scenario->rows()->count(), $scenario->total_rows);
        $this->assertGreaterThan(24 * 4, $scenario->rows()->where('phase', 'baseline')->count(), 'enough history for the baseline');
    }

    public function test_the_script_is_the_same_every_time_it_is_built(): void
    {
        $this->assertSame(DemoScenarioSeeder::sampleCsv(), DemoScenarioSeeder::sampleCsv());
    }

    public function test_a_synchronous_replay_raises_the_alert_through_the_normal_pipeline(): void
    {
        $scenario = $this->seedDemo();

        $this->artisan('radarisu:replay', ['scenario' => $scenario->id, '--sync' => true])->assertSuccessful();

        $scenario->refresh();
        $this->assertSame('finished', $scenario->status);
        $this->assertSame($scenario->total_rows, $scenario->progress_rows);
        $this->assertSame($scenario->total_rows, Post::where('source_id', $scenario->source_id)->count());
        $this->assertSame(DemoScenarioSeeder::CAMPAIGN_ACCOUNTS, Post::where('source_id', $scenario->source_id)->where('label_manual', 'anomalous')->count());
        $this->assertNull(ReplayRunner::clockNow());

        $topic = Topic::where('name', DemoScenarioSeeder::TOPIC_NAME)->firstOrFail();
        $alerts = Alert::where('topic_id', $topic->id)->where('kind', 'issue')->get();
        $this->assertCount(1, $alerts, 'one alert for the whole incident, not one per batch');

        $alert = $alerts->first();
        $evidence = AlertEvidence::where('alert_id', $alert->id)->get()->groupBy('reason');
        $this->assertCount(DemoScenarioSeeder::CAMPAIGN_ACCOUNTS, $evidence['similar_text']->pluck('account_id')->unique());
        $this->assertCount(DemoScenarioSeeder::YOUNG_ACCOUNTS, $evidence['young_account']->pluck('account_id')->unique());
        $this->assertTrue($evidence->has('synchronized_posting'));
        $this->assertGreaterThan(0, $alert->score_breakdown['spike']['value'] ?? 0, 'the burst is also a volume spike');

        // detected_at is on the data clock: after the incident began, before the wall clock caught up with the end of the script
        $incidentStart = $scenario->virtual_anchor_at->getTimestamp() + $scenario->incident_start_offset_seconds;
        $this->assertGreaterThanOrEqual($incidentStart, $alert->detected_at->getTimestamp());
        $this->assertLessThanOrEqual($incidentStart + 15 * 60, $alert->detected_at->getTimestamp(), 'found within minutes of the incident start');
    }

    public function test_the_command_refuses_what_it_cannot_run(): void
    {
        $scenario = $this->seedDemo();

        $this->artisan('radarisu:replay', ['scenario' => 'abc'])->assertFailed();
        $this->artisan('radarisu:replay', ['scenario' => 99999])->assertFailed();
        $this->artisan('radarisu:replay', ['scenario' => $scenario->id, '--speed' => '0'])->assertFailed();
        $this->artisan('radarisu:replay', ['scenario' => $scenario->id, '--speed' => '100001'])->assertFailed();
        $this->assertSame('idle', $scenario->refresh()->status);

        $this->artisan('radarisu:replay', ['scenario' => $scenario->id, '--sync' => true, '--speed' => '1200'])->assertSuccessful();
        $this->assertSame(1200, $scenario->refresh()->speed_factor);
    }

    public function test_after_the_run_detectors_see_the_wall_clock_again(): void
    {
        $scenario = $this->seedDemo();

        $this->artisan('radarisu:replay', ['scenario' => $scenario->id, '--sync' => true])->assertSuccessful();

        $this->assertEqualsWithDelta(time(), DataClock::now()->getTimestamp(), 5);
    }
}
