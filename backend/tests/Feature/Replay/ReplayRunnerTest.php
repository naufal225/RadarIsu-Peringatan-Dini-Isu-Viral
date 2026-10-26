<?php

namespace Tests\Feature\Replay;

use App\Models\Account;
use App\Models\MetricHourly;
use App\Models\Post;
use App\Models\ReplayScenario;
use App\Models\Source;
use App\Models\Topic;
use App\Services\Detection\DataClock;
use App\Services\Ingest\ReplayRunner;
use App\Services\Ingest\ReplayStateException;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use RuntimeException;
use Tests\Concerns\BuildsReplayScenarios;
use Tests\TestCase;

class ReplayRunnerTest extends TestCase
{
    use BuildsReplayScenarios;
    use RefreshDatabase;

    protected bool $seed = true;

    private ReplayRunner $runner;

    protected function setUp(): void
    {
        parent::setUp();

        $this->runner = app(ReplayRunner::class);
        Topic::factory()->create(['keywords' => ['institusi contoh']]);
    }

    /**
     * @return array{0: list<float>, 1: list<?string>} the sleeps and the clock after every batch
     */
    private function play(ReplayScenario $scenario): array
    {
        $sleeps = [];
        $clocks = [];
        $this->runner->run(
            $scenario,
            function (float $seconds) use (&$sleeps) {
                $sleeps[] = $seconds;
            },
            function () use (&$clocks) {
                $clocks[] = ReplayRunner::clockNow();
            },
        );

        return [$sleeps, $clocks];
    }

    public function test_begin_puts_the_end_of_the_baseline_at_now(): void
    {
        $scenario = $this->importScenario($this->smallScenarioCsv());
        $before = CarbonImmutable::now('UTC');

        $begun = $this->runner->begin($scenario, 60);

        $this->assertSame('running', $begun->status);
        $this->assertSame(60, $begun->speed_factor);
        $this->assertSame(1, $begun->run_number);
        $this->assertSame(0, $begun->progress_rows);
        $this->assertEqualsWithDelta($before->subSeconds(1800)->getTimestamp(), $begun->virtual_anchor_at->getTimestamp(), 5);

        $source = Source::findOrFail($begun->source_id);
        $this->assertSame('replay', $source->type);
        $this->assertTrue($source->is_simulated);
        $this->assertFalse($source->is_active, 'a replay source must not count as a live source');
    }

    public function test_the_script_goes_through_the_normal_pipeline(): void
    {
        $scenario = $this->runner->begin($this->importScenario($this->smallScenarioCsv()), 60);
        $anchor = $scenario->virtual_anchor_at;

        $this->play($scenario);

        $posts = Post::where('source_id', $scenario->source_id)->orderBy('posted_at')->get();
        $this->assertCount(6, $posts);
        $this->assertSame([true], $posts->pluck('is_simulated')->unique()->all());
        $this->assertSame(
            [0, 1800, 3600, 3610, 3620, 3700],
            $posts->map(fn ($p) => $p->posted_at->getTimestamp() - $anchor->getTimestamp())->all(),
        );
        $this->assertSame(
            ['organic', 'organic', 'anomalous', 'anomalous', 'organic', 'anomalous'],
            $posts->pluck('label_manual')->all(),
        );
        $this->assertSame(
            "replay:{$scenario->id}:1:".$scenario->rows()->where('offset_seconds', 3600)->value('id'),
            $posts[2]->external_id,
        );
        $this->assertSame(6, MetricHourly::sum('volume'), 'matched and aggregated like live data');
    }

    public function test_account_ages_follow_the_run_not_the_calendar(): void
    {
        $scenario = $this->runner->begin($this->importScenario($this->smallScenarioCsv()), 60);

        $this->play($scenario);

        $account = Account::where('handle', '@kampanye_1')->firstOrFail();
        $post = Post::where('account_id', $account->id)->firstOrFail();
        $this->assertSame(3 * 86400, $post->posted_at->getTimestamp() - $account->platform_created_at->getTimestamp());
        $this->assertSame('replay', $account->source_type);
    }

    public function test_the_incident_is_paced_by_the_speed_factor_and_the_clock_follows_the_data(): void
    {
        $scenario = $this->runner->begin($this->importScenario($this->smallScenarioCsv()), 60);
        $anchor = $scenario->virtual_anchor_at;

        [$sleeps, $clocks] = $this->play($scenario);

        // baseline | 3600..3620 | 3700: gaps of 1800 s and 80 s of script time, at 60 x
        $this->assertEqualsWithDelta(1800 / 60 + 80 / 60, array_sum($sleeps), 0.001);
        $this->assertLessThanOrEqual(1.0, max($sleeps), 'waits are sliced so a stop is noticed within a second');
        $this->assertSame(
            array_map(fn (int $offset) => $anchor->toImmutable()->addSeconds($offset)->utc()->format('Y-m-d\TH:i:s\Z'), [1800, 3620, 3700]),
            $clocks,
        );
        $this->assertNull(ReplayRunner::clockNow(), 'reset when the run ends');
        $this->assertEqualsWithDelta(time(), DataClock::now()->getTimestamp(), 5);
    }

    public function test_a_finished_run_records_its_progress(): void
    {
        $scenario = $this->runner->begin($this->importScenario($this->smallScenarioCsv()), 60);

        $this->play($scenario);

        $scenario->refresh();
        $this->assertSame('finished', $scenario->status);
        $this->assertSame(6, $scenario->progress_rows);
        $this->assertNotNull($scenario->finished_at);
        $this->assertNull($scenario->error);
    }

    public function test_a_stop_request_ends_the_run_between_batches(): void
    {
        $scenario = $this->runner->begin($this->importScenario($this->smallScenarioCsv()), 60);

        $this->runner->run($scenario, fn () => null, function () use ($scenario) {
            ReplayScenario::whereKey($scenario->id)->update(['status' => 'stopped']);
        });

        $scenario->refresh();
        $this->assertSame('stopped', $scenario->status);
        $this->assertSame(2, $scenario->progress_rows, 'only the baseline was delivered');
        $this->assertSame(2, Post::where('source_id', $scenario->source_id)->count());
        $this->assertNull(ReplayRunner::clockNow());
        $this->assertNotNull($scenario->finished_at);
    }

    public function test_a_failure_closes_the_run_and_resets_the_clock(): void
    {
        $scenario = $this->runner->begin($this->importScenario($this->smallScenarioCsv()), 60);

        try {
            $this->runner->run($scenario, fn () => null, function () {
                throw new RuntimeException('boom');
            });
            $this->fail('The failure should surface.');
        } catch (RuntimeException $e) {
            $this->assertSame('boom', $e->getMessage());
        }

        $scenario->refresh();
        $this->assertSame('stopped', $scenario->status);
        $this->assertSame('boom', $scenario->error);
        $this->assertNull(ReplayRunner::clockNow());
    }

    public function test_playing_again_is_a_new_run_with_its_own_posts(): void
    {
        $scenario = $this->importScenario($this->smallScenarioCsv());

        $this->play($this->runner->begin($scenario, 60));
        $second = $this->runner->begin($scenario->refresh(), 120);
        $this->play($second);

        $this->assertSame(2, $second->run_number);
        $this->assertSame(120, $second->speed_factor);
        $this->assertSame(12, Post::where('source_id', $second->source_id)->count());
        $this->assertSame(1, Source::where('type', 'replay')->count(), 'one source per scenario');
        $this->assertSame(12, Post::where('source_id', $second->source_id)->distinct()->count('external_id'));
    }

    public function test_a_running_scenario_cannot_be_started_again(): void
    {
        $scenario = $this->runner->begin($this->importScenario($this->smallScenarioCsv()), 60);

        $this->expectException(ReplayStateException::class);
        $this->expectExceptionMessage('already_running');

        $this->runner->begin($scenario, 60);
    }

    public function test_only_one_scenario_runs_at_a_time(): void
    {
        $this->runner->begin($this->importScenario($this->smallScenarioCsv(), ['name' => 'A']), 60);
        $other = $this->importScenario($this->smallScenarioCsv(), ['name' => 'B']);

        try {
            $this->runner->begin($other, 60);
            $this->fail('The second scenario should be refused.');
        } catch (ReplayStateException $e) {
            $this->assertSame('another_running', $e->getMessage());
        }

        $this->assertSame('idle', $other->refresh()->status);
    }

    public function test_a_run_that_stopped_beating_makes_room_for_the_next(): void
    {
        $dead = $this->runner->begin($this->importScenario($this->smallScenarioCsv(), ['name' => 'A']), 60);
        $this->runner->setClock(CarbonImmutable::now('UTC')->addDay());
        ReplayScenario::whereKey($dead->id)->update(['heartbeat_at' => now()->subSeconds(ReplayRunner::STALE_AFTER_SECONDS + 5)]);

        $next = $this->runner->begin($this->importScenario($this->smallScenarioCsv(), ['name' => 'B']), 60);

        $this->assertSame('running', $next->status);
        $dead->refresh();
        $this->assertSame('stopped', $dead->status);
        $this->assertSame('heartbeat_lost', $dead->error);
        $this->assertNull(ReplayRunner::clockNow(), 'a frozen virtual clock would hide live data');
    }

    public function test_a_scenario_without_rows_cannot_start(): void
    {
        $this->expectException(ReplayStateException::class);
        $this->expectExceptionMessage('empty_scenario');

        $this->runner->begin(ReplayScenario::factory()->create(), 60);
    }

    public function test_a_stop_during_a_wait_is_noticed(): void
    {
        $scenario = $this->runner->begin($this->importScenario($this->smallScenarioCsv()), 1);
        $slept = 0;

        $this->runner->run($scenario, function () use (&$slept, $scenario) {
            if (++$slept === 3) {
                ReplayScenario::whereKey($scenario->id)->update(['status' => 'stopped']);
            }
        });

        $this->assertSame(3, $slept, 'the 1800 s wait ends at the next slice after the stop');
        $this->assertSame(2, Post::where('source_id', $scenario->source_id)->count());
    }
}
