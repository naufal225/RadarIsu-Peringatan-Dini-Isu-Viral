<?php

namespace Tests\Feature\Detection;

use App\Jobs\DetectJob;
use App\Models\Alert;
use App\Models\AlertEvidence;
use App\Models\Setting;
use App\Models\Source;
use App\Models\Topic;
use App\Services\Detection\AlertWriter;
use App\Services\Detection\ImpersonationDetectionService;
use App\Services\Detection\IssueDetectionService;
use Carbon\CarbonImmutable;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use RuntimeException;
use Tests\Concerns\BuildsDetectionData;
use Tests\TestCase;

/**
 * F3 end to end on the database (PRD §10.5, §10.9, §19.2 item 8). Clock: 2026-10-26 12:30 UTC, so the
 * running hour is 12:00 and the current window is (11:30, 12:30].
 */
class SpikeDetectionTest extends TestCase
{
    use BuildsDetectionData;
    use RefreshDatabase;

    protected bool $seed = true;

    private CarbonImmutable $clock;

    private Source $source;

    /** @var list<int> */
    private array $accounts;

    protected function setUp(): void
    {
        parent::setUp();
        $this->clock = CarbonImmutable::parse('2026-10-26 12:30:00', 'UTC');
        $this->travelTo($this->clock);
        $this->source = $this->makeSource();
        $this->accounts = $this->makeAccounts(30);
    }

    private function topic(array $attributes = []): Topic
    {
        return Topic::factory()->create($attributes + ['sensitivity' => 'medium']);
    }

    /** A quiet topic (5/hour for `$hours`) that then gets `$spike` posts between 12:00 and 12:29. */
    private function topicWithSpike(int $hours = 48, int $spike = 60, array $attributes = []): Topic
    {
        $topic = $this->topic($attributes);
        $this->addHourlyHistory($this->source, $topic, $this->accounts, $this->clock->startOfHour(), $hours, 5);
        $posts = [];
        for ($i = 0; $i < $spike; $i++) {
            $posts[] = [
                'at' => $this->clock->startOfHour()->addMinutes($i % 30),
                'account_id' => $this->accounts[$i % count($this->accounts)],
                'sentiment' => $i % 3 === 0 ? 'negative' : 'neutral',
            ];
        }
        $this->addPosts($this->source, $topic, $posts);
        $this->rebuildMetrics($topic);

        return $topic;
    }

    private function detect(): array
    {
        return app(IssueDetectionService::class)->run();
    }

    public function test_a_spike_opens_one_alert_with_score_breakdown_and_evidence(): void
    {
        $topic = $this->topicWithSpike();

        $stats = $this->detect();

        $this->assertSame(1, $stats['triggered']);
        $this->assertSame(1, $stats['created']);
        $alert = Alert::sole();
        $this->assertSame('issue', $alert->kind);
        $this->assertSame($topic->id, $alert->topic_id);
        $this->assertSame('new', $alert->status);
        $this->assertGreaterThan(0, $alert->score);
        $this->assertTrue($alert->detected_at->equalTo($this->clock));
        $this->assertTrue($alert->window_start->equalTo($this->clock->subMinutes(60)));
        $this->assertGreaterThan(0, $alert->score_breakdown['spike']['raw']);
        $this->assertSame(3.0, (float) $alert->score_breakdown['thresholds']['z']);

        $evidence = AlertEvidence::where('alert_id', $alert->id)->get();
        $this->assertCount(10, $evidence);
        $this->assertSame(['spike_sample'], $evidence->pluck('reason')->unique()->all());
        $first = $evidence->first();
        $this->assertNotNull($first->post_id);
        // 60 spike posts plus the 4 history posts of hour 11 that fall at minutes 56-59 of the 11:30 window.
        $this->assertSame(64, $first->detail['current']);
        $this->assertSame(5.0, (float) $first->detail['baseline_mean']);
        $this->assertSame(48, $first->detail['baseline_hours']);
        $this->assertEquals(3.0, $first->detail['thresholds']['z_effective']);
        $this->assertSame(20, $first->detail['thresholds']['min_volume']);
    }

    public function test_running_twice_for_the_same_window_creates_no_duplicates(): void
    {
        $this->topicWithSpike();

        $this->detect();
        $second = $this->detect();

        $this->assertSame(1, Alert::count());
        $this->assertSame(10, AlertEvidence::count());
        $this->assertSame(1, $second['updated']);
        $this->assertSame(0, $second['created']);
    }

    public function test_a_topic_with_too_little_history_is_not_judged(): void
    {
        $this->topicWithSpike(hours: 10);

        $stats = $this->detect();

        $this->assertSame(0, $stats['triggered']);
        $this->assertSame(0, Alert::count());
    }

    public function test_a_small_topic_below_min_volume_does_not_fire(): void
    {
        $topic = $this->topic();
        $this->addHourlyHistory($this->source, $topic, $this->accounts, $this->clock->startOfHour(), 48, 2);
        $this->addPosts($this->source, $topic, array_map(
            fn ($i) => ['at' => $this->clock->startOfHour()->addMinutes($i), 'account_id' => $this->accounts[$i]],
            range(0, 5),
        ));
        $this->rebuildMetrics($topic);

        $this->detect();

        $this->assertSame(0, Alert::count());
    }

    public function test_a_topic_without_posts_is_not_an_error(): void
    {
        $this->topic();

        $stats = $this->detect();

        $this->assertSame(1, $stats['topics']);
        $this->assertSame(0, Alert::count());
    }

    public function test_inactive_topics_are_skipped(): void
    {
        $this->topicWithSpike(attributes: ['is_active' => false]);

        $this->assertSame(0, $this->detect()['topics']);
        $this->assertSame(0, Alert::count());
    }

    public function test_an_open_alert_is_refreshed_and_its_status_is_left_alone(): void
    {
        $topic = $this->topicWithSpike();
        $alert = Alert::factory()->status('escalated')->create([
            'topic_id' => $topic->id, 'score' => 5, 'severity' => 'low',
            'window_end' => $this->clock->subHour(),
        ]);

        $stats = $this->detect();

        $this->assertSame(1, Alert::count());
        $this->assertSame(1, $stats['updated']);
        $alert->refresh();
        $this->assertSame('escalated', $alert->status);
        $this->assertGreaterThan(5, $alert->score);
        $this->assertTrue($alert->window_end->equalTo($this->clock));
        $this->assertSame(0, DB::table('alert_actions')->where('alert_id', $alert->id)->count());
    }

    public function test_a_recently_resolved_alert_holds_the_next_one_back_until_the_cooldown_passes(): void
    {
        $topic = $this->topicWithSpike();
        $resolved = Alert::factory()->status('false_positive')->create(['topic_id' => $topic->id]);
        $resolved->forceFill(['closed_at' => now()->subMinutes(10)])->save();

        $held = $this->detect();
        $this->assertSame(1, $held['cooldown']);
        $this->assertSame(1, Alert::count());

        $resolved->forceFill(['closed_at' => now()->subMinutes(61)])->save();
        $released = $this->detect();
        $this->assertSame(1, $released['created']);
        $this->assertSame(2, Alert::count());
    }

    public function test_zero_cooldown_follows_the_prd_and_reopens_immediately(): void
    {
        $topic = $this->topicWithSpike();
        Setting::whereKey('detection')->update(['value' => json_encode([...Setting::detection(), 'cooldown_minutes' => 0])]);
        $resolved = Alert::factory()->status('closed')->create(['topic_id' => $topic->id]);
        $resolved->forceFill(['closed_at' => now()->subMinute()])->save();

        $this->assertSame(1, $this->detect()['created']);
    }

    public function test_spike_samples_never_exceed_the_limit_across_runs(): void
    {
        $topic = $this->topicWithSpike();
        $this->detect();

        $this->travelTo($this->clock->addMinutes(5));
        $late = [];
        for ($i = 0; $i < 20; $i++) {
            $late[] = ['at' => $this->clock->addMinutes(1 + $i % 4), 'account_id' => $this->accounts[$i]];
        }
        $this->addPosts($this->source, $topic, $late);
        $this->rebuildMetrics($topic);
        $this->detect();

        $this->assertSame(1, Alert::count());
        $this->assertSame(10, AlertEvidence::where('reason', 'spike_sample')->count());
    }

    public function test_detection_follows_the_data_clock_not_the_wall_clock(): void
    {
        $topic = $this->topicWithSpike();
        $this->travelTo($this->clock->addDays(30)); // wall clock far away: the window would be empty
        Setting::whereKey('replay.clock')->update(['value' => json_encode(['now' => $this->clock->toIso8601String()])]);

        $this->assertSame(1, $this->detect()['created']);
        $this->assertTrue(Alert::sole()->detected_at->equalTo($this->clock));
        $this->assertSame($topic->id, Alert::sole()->topic_id);
    }

    public function test_one_failing_topic_does_not_stop_the_others_and_is_counted(): void
    {
        $this->topicWithSpike();
        $this->topicWithSpike();
        $writer = $this->mock(AlertWriter::class);
        $writer->shouldReceive('upsertIssue')->once()->andThrow(new RuntimeException('boom'));
        $writer->shouldReceive('upsertIssue')->once()->andReturn(['outcome' => 'created', 'alert_id' => 1, 'evidence_added' => 0]);

        $stats = $this->detect();

        $this->assertSame(2, $stats['triggered']);
        $this->assertSame(1, $stats['failed']);
        $this->assertSame(1, $stats['created']);
    }

    public function test_the_job_fails_so_it_is_retried_when_a_topic_failed(): void
    {
        $this->topicWithSpike();
        $this->mock(AlertWriter::class)->shouldReceive('upsertIssue')->andThrow(new RuntimeException('boom'));

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Detection failed for 1 subject(s).');

        (new DetectJob)->handle(app(IssueDetectionService::class), app(ImpersonationDetectionService::class));
    }

    public function test_the_job_is_unique_bounded_and_retried(): void
    {
        $job = new DetectJob;

        $this->assertInstanceOf(ShouldBeUnique::class, $job);
        $this->assertSame('detect', $job->uniqueId());
        $this->assertSame(3, $job->tries);
        $this->assertSame([10, 30, 60], $job->backoff);
        $this->assertSame(240, $job->timeout);
    }

    public function test_the_detect_command_queues_the_pass(): void
    {
        Queue::fake();

        $this->artisan('radarisu:detect')->assertSuccessful();

        Queue::assertPushed(DetectJob::class, 1);
    }

    public function test_the_detect_command_can_run_the_pass_in_the_foreground(): void
    {
        $this->topicWithSpike();

        $this->artisan('radarisu:detect --sync')->assertSuccessful();

        $this->assertSame(1, Alert::count());
    }

    public function test_the_detect_command_is_scheduled_every_minute(): void
    {
        $event = collect(app(Schedule::class)->events())
            ->first(fn ($e) => str_contains($e->command, 'radarisu:detect'));

        $this->assertNotNull($event);
        $this->assertSame('* * * * *', $event->expression);
        $this->assertTrue($event->withoutOverlapping);
    }

    public function test_the_same_evidence_cannot_be_attached_twice(): void
    {
        $topic = $this->topicWithSpike();
        $this->detect();
        $row = AlertEvidence::first();

        $this->expectException(QueryException::class);
        DB::table('alert_evidence')->insert([
            'alert_id' => $row->alert_id, 'post_id' => $row->post_id, 'account_id' => $row->account_id,
            'reason' => $row->reason, 'detail' => '{}', 'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    public function test_sensitivity_changes_whether_a_borderline_topic_fires(): void
    {
        // History alternates 0/40 per hour (std 20), so z for 70 posts/hour is 2.5.
        $make = function (string $sensitivity) {
            $topic = $this->topic(['sensitivity' => $sensitivity]);
            $posts = [];
            for ($h = 48; $h >= 1; $h--) {
                $count = $h % 2 === 0 ? 0 : 40;
                for ($i = 0; $i < $count; $i++) {
                    $posts[] = ['at' => $this->clock->startOfHour()->subHours($h)->addMinutes($i % 60), 'account_id' => $this->accounts[$i % 30]];
                }
            }
            for ($i = 0; $i < 70; $i++) {
                $posts[] = ['at' => $this->clock->startOfHour()->addMinutes($i % 30), 'account_id' => $this->accounts[$i % 30]];
            }
            $this->addPosts($this->source, $topic, $posts);
            $this->rebuildMetrics($topic);

            return $topic;
        };
        $high = $make('high');
        $medium = $make('medium');

        $this->detect();

        $this->assertTrue(Alert::where('topic_id', $high->id)->exists());
        $this->assertFalse(Alert::where('topic_id', $medium->id)->exists());
    }

    public function test_thresholds_come_from_settings_not_from_code(): void
    {
        $this->topicWithSpike();
        Setting::whereKey('detection')->update(['value' => json_encode([...Setting::detection(), 'min_volume' => 500])]);

        $this->detect();

        $this->assertSame(0, Alert::count());
    }
}
