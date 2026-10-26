<?php

namespace Tests\Feature\Detection;

use App\Models\Alert;
use App\Models\AlertEvidence;
use App\Models\Setting;
use App\Models\Source;
use App\Models\Topic;
use App\Services\Detection\IssueDetectionService;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Tests\Concerns\BuildsDetectionData;
use Tests\TestCase;

/**
 * F4 on the database with the real pg_trgm (PRD §10.6, §10.9, §19.3 item 3). Clock: 2026-10-26 12:30
 * UTC, so the coordination window is (12:15, 12:30].
 */
class CoordinationDetectionTest extends TestCase
{
    use BuildsDetectionData;
    use RefreshDatabase;

    protected bool $seed = true;

    private const CAMPAIGN = 'waspada penipuan atas nama satuan kami segera pindahkan dana ke rekening resmi berikut kode ';

    private CarbonImmutable $clock;

    private Source $source;

    protected function setUp(): void
    {
        parent::setUp();
        $this->clock = CarbonImmutable::parse('2026-10-26 12:30:00', 'UTC');
        $this->travelTo($this->clock);
        $this->source = $this->makeSource();
    }

    private function topic(array $attributes = []): Topic
    {
        return Topic::factory()->create($attributes + ['sensitivity' => 'medium']);
    }

    private function detect(): array
    {
        return app(IssueDetectionService::class)->run();
    }

    /**
     * `$accounts` accounts each post the campaign text once, `$gapSeconds` apart from 12:20.
     *
     * @return list<int> account ids
     */
    private function campaign(Topic $topic, int $accounts, int $gapSeconds = 20, string $prefix = 'camp', ?CarbonImmutable $createdAt = null, ?CarbonImmutable $start = null): array
    {
        $ids = $this->makeAccounts($accounts, $prefix, $createdAt ?? $this->clock->subYears(2));
        $start ??= $this->clock->subMinutes(10);
        $posts = [];
        foreach ($ids as $i => $accountId) {
            $posts[] = ['at' => $start->addSeconds($i * $gapSeconds), 'account_id' => $accountId, 'text' => self::CAMPAIGN.($i + 1), 'sentiment' => 'negative'];
        }
        $this->addPosts($this->source, $topic, $posts);
        $this->rebuildMetrics($topic);

        return $ids;
    }

    public function test_five_accounts_posting_the_same_text_open_an_alert_with_evidence_per_account(): void
    {
        $topic = $this->topic();
        $accounts = $this->campaign($topic, 5);

        $stats = $this->detect();

        $this->assertSame(1, $stats['coordination']);
        $this->assertSame(0, $stats['spike']);
        $this->assertSame(1, $stats['created']);
        $alert = Alert::sole();
        $this->assertSame($topic->id, $alert->topic_id);
        $this->assertSame('new', $alert->status);
        $this->assertGreaterThan(0, $alert->score_breakdown['anomaly']['raw']);

        $similar = AlertEvidence::where('alert_id', $alert->id)->where('reason', 'similar_text')->get();
        $this->assertCount(5, $similar);
        $this->assertEqualsCanonicalizing($accounts, $similar->pluck('account_id')->all());
        $detail = $similar->first()->detail;
        $this->assertGreaterThanOrEqual(0.8, $detail['similarity']);
        $this->assertSame(1, $detail['cluster_id']);
        $this->assertSame(5, $detail['cluster_accounts']);
        $this->assertSame(0.8, (float) $detail['thresholds']['similarity_threshold']);
        $this->assertFalse($detail['truncated']);
        $this->assertNotNull($similar->first()->post_id);
    }

    public function test_four_accounts_do_not_trigger(): void
    {
        $this->campaign($this->topic(), 4);

        $stats = $this->detect();

        $this->assertSame(0, $stats['coordination']);
        $this->assertSame(0, Alert::count());
    }

    public function test_one_account_spamming_is_not_coordination(): void
    {
        $topic = $this->topic();
        $account = $this->makeAccounts(1, 'spam')[0];
        $posts = [];
        for ($i = 0; $i < 30; $i++) {
            $posts[] = ['at' => $this->clock->subMinutes(10)->addSeconds($i * 10), 'account_id' => $account, 'text' => self::CAMPAIGN.'1'];
        }
        $this->addPosts($this->source, $topic, $posts);
        $this->rebuildMetrics($topic);

        $this->detect();

        $this->assertSame(0, Alert::count());
    }

    public function test_many_accounts_with_unrelated_text_do_not_trigger(): void
    {
        $topic = $this->topic();
        $accounts = $this->makeAccounts(12, 'organic');
        $this->addPosts($this->source, $topic, array_map(
            fn ($i) => ['at' => $this->clock->subMinutes(10)->addSeconds($i * 30), 'account_id' => $accounts[$i]],
            range(0, 11),
        ));
        $this->rebuildMetrics($topic);

        $this->detect();

        $this->assertSame(0, Alert::count());
    }

    public function test_posts_outside_the_window_do_not_count(): void
    {
        $topic = $this->topic();
        $this->campaign($topic, 4);                                                              // inside
        $this->campaign($topic, 3, 20, 'old', null, $this->clock->subMinutes(40));              // 40 minutes ago, outside

        $this->detect();

        $this->assertSame(0, Alert::count()); // 4 inside the window, not 7
    }

    public function test_a_topic_without_posts_is_not_an_error(): void
    {
        $this->topic();

        $stats = $this->detect();

        $this->assertSame(1, $stats['topics']);
        $this->assertSame(0, $stats['triggered']);
    }

    public function test_running_twice_for_the_same_window_creates_no_duplicates(): void
    {
        $topic = $this->topic();
        $this->campaign($topic, 6);

        $this->detect();
        $evidence = AlertEvidence::count();
        $second = $this->detect();

        $this->assertSame(1, Alert::count());
        $this->assertSame($evidence, AlertEvidence::count());
        $this->assertSame(1, $second['updated']);
        $this->assertSame(0, $second['created']);
    }

    public function test_young_accounts_get_young_account_evidence_and_old_ones_do_not(): void
    {
        $topic = $this->topic();
        $young = $this->campaign($topic, 3, 20, 'young', $this->clock->subDays(4));
        $old = $this->campaign($topic, 3, 20, 'old', $this->clock->subYears(2));

        $this->detect();

        $flagged = AlertEvidence::where('reason', 'young_account')->pluck('account_id')->all();
        $this->assertEqualsCanonicalizing($young, $flagged);
        $this->assertEmpty(array_intersect($old, $flagged));
        $detail = AlertEvidence::where('reason', 'young_account')->first()->detail;
        $this->assertSame(30, $detail['young_account_days']);
        $this->assertEqualsWithDelta(4.0, $detail['account_age_days'], 0.5);
    }

    public function test_accounts_with_unknown_age_are_not_called_young(): void
    {
        $topic = $this->topic();
        $accounts = $this->campaign($topic, 5);
        DB::table('accounts')->whereIn('id', $accounts)->update(['platform_created_at' => null]);

        $this->detect();

        $this->assertSame(1, Alert::count());
        $this->assertSame(0, AlertEvidence::where('reason', 'young_account')->count());
    }

    public function test_tight_bursts_get_synchronized_posting_evidence_and_slow_ones_do_not(): void
    {
        $fast = $this->topic();
        $this->campaign($fast, 5, 20);   // 80 seconds in all
        $slow = $this->topic();
        $this->campaign($slow, 5, 150, 'slow'); // 10 minutes in all

        $this->detect();

        $fastAlert = Alert::where('topic_id', $fast->id)->sole();
        $slowAlert = Alert::where('topic_id', $slow->id)->sole();
        $this->assertSame(5, AlertEvidence::where('alert_id', $fastAlert->id)->where('reason', 'synchronized_posting')->count());
        $this->assertSame(0, AlertEvidence::where('alert_id', $slowAlert->id)->where('reason', 'synchronized_posting')->count());
        $this->assertTrue(AlertEvidence::where('alert_id', $fastAlert->id)->where('reason', 'synchronized_posting')->first()->detail['synchronized']['is_synchronized']);
    }

    public function test_it_fills_anomalous_accounts_on_the_hourly_metrics_and_never_lowers_it(): void
    {
        $topic = $this->topic();
        $this->campaign($topic, 6);

        $this->detect();

        $row = DB::table('metrics_hourly')->where('topic_id', $topic->id)->where('hour', '2026-10-26 12:00:00+00')->first();
        $this->assertSame(6, $row->anomalous_accounts);
        $this->assertSame(6, $row->unique_accounts);

        // The campaign slides out of the window: the earlier finding stays.
        $this->travelTo($this->clock->addMinutes(20));
        $this->detect();
        $this->assertSame(6, DB::table('metrics_hourly')->where('topic_id', $topic->id)->where('hour', '2026-10-26 12:00:00+00')->value('anomalous_accounts'));
    }

    public function test_a_late_aggregation_does_not_erase_anomalous_accounts(): void
    {
        $topic = $this->topic();
        $this->campaign($topic, 6);
        $this->detect();

        $this->rebuildMetrics($topic);

        $this->assertSame(6, DB::table('metrics_hourly')->where('topic_id', $topic->id)->value('anomalous_accounts'));
    }

    public function test_coordination_and_spike_share_one_alert_with_both_kinds_of_evidence(): void
    {
        $topic = $this->topic();
        $filler = $this->makeAccounts(10, 'bg');
        $this->addHourlyHistory($this->source, $topic, $filler, $this->clock->startOfHour(), 48, 3);
        $this->campaign($topic, 25, 15);   // 25 near-identical posts in about 6 minutes: also a spike

        $stats = $this->detect();

        $this->assertSame(1, $stats['spike']);
        $this->assertSame(1, $stats['coordination']);
        $alert = Alert::sole();
        $reasons = AlertEvidence::where('alert_id', $alert->id)->pluck('reason')->unique()->sort()->values()->all();
        $this->assertSame(['similar_text', 'spike_sample', 'synchronized_posting'], $reasons);
        $this->assertGreaterThan(0, $alert->score_breakdown['spike']['raw']);
        $this->assertGreaterThan(0, $alert->score_breakdown['anomaly']['raw']);
    }

    public function test_the_alert_score_reflects_the_coordinated_share_of_accounts(): void
    {
        $topic = $this->topic();
        $this->campaign($topic, 5);
        $organic = $this->makeAccounts(5, 'organic');
        $this->addPosts($this->source, $topic, array_map(
            fn ($i) => ['at' => $this->clock->subMinutes(8)->addSeconds($i * 40), 'account_id' => $organic[$i]],
            range(0, 4),
        ));
        $this->rebuildMetrics($topic);

        $this->detect();

        $breakdown = Alert::sole()->score_breakdown;
        $this->assertSame(0.5, (float) $breakdown['anomaly']['raw']); // 5 of the 10 accounts in the window
        $this->assertSame(15.0, (float) $breakdown['anomaly']['value']);
    }

    public function test_thresholds_come_from_settings(): void
    {
        $topic = $this->topic();
        $this->campaign($topic, 3);
        $this->assertSame(0, $this->detect()['coordination']); // default needs 5 accounts

        $this->setDetection(['min_accounts_cluster' => 3]);
        $this->assertSame(1, $this->detect()['coordination']);

        $this->setDetection(['min_accounts_cluster' => 3, 'similarity_threshold' => 0.99]);
        Alert::query()->delete();
        $this->assertSame(0, $this->detect()['coordination']); // variants of the text are no longer "the same"
    }

    public function test_a_wider_window_catches_a_slow_campaign(): void
    {
        $topic = $this->topic();
        $this->campaign($topic, 5, 300); // posts 5 minutes apart: 20 minutes in all, from 12:20 to 12:40? start 12:20, last 12:40 > clock
        $this->travelTo($this->clock->addMinutes(15)); // 12:45: window (12:30, 12:45] holds only the last posts
        $this->assertSame(0, $this->detect()['coordination']);

        $this->setDetection(['coordination_window_minutes' => 60]);
        $this->assertSame(1, $this->detect()['coordination']);
    }

    public function test_a_window_over_the_post_cap_keeps_the_newest_and_says_so(): void
    {
        Log::spy();
        $topic = $this->topic();
        $this->setDetection(['coordination_max_posts' => 100]);
        $accounts = $this->makeAccounts(30, 'cap');
        $posts = [];
        for ($i = 0; $i < 120; $i++) {
            $posts[] = ['at' => $this->clock->subMinutes(10)->addSeconds($i * 4), 'account_id' => $accounts[$i % 30], 'text' => self::CAMPAIGN.($i % 9)];
        }
        $this->addPosts($this->source, $topic, $posts);
        $this->rebuildMetrics($topic);

        $this->detect();

        $detail = AlertEvidence::where('reason', 'similar_text')->firstOrFail()->detail;
        $this->assertTrue($detail['truncated']);
        Log::shouldHaveReceived('warning')->with('detection.coordination.truncated', \Mockery::on(fn ($c) => $c['posts_in_window'] === 120 && $c['kept'] === 100));
    }

    public function test_the_same_campaign_in_two_topics_raises_two_independent_alerts(): void
    {
        $a = $this->topic();
        $b = $this->topic();
        $accounts = $this->campaign($a, 5);
        $postIds = DB::table('topic_matches')->where('topic_id', $a->id)->pluck('post_id');
        DB::table('topic_matches')->insert($postIds->map(fn ($id) => ['post_id' => $id, 'topic_id' => $b->id])->all());
        $this->rebuildMetrics($b);

        $this->detect();

        $this->assertSame(2, Alert::count());
        $this->assertEqualsCanonicalizing([$a->id, $b->id], Alert::pluck('topic_id')->all());
        $this->assertCount(5, $accounts);
    }

    public function test_a_recently_resolved_alert_holds_back_a_new_one_for_the_cooldown(): void
    {
        $topic = $this->topic();
        $this->campaign($topic, 5);
        $resolved = Alert::factory()->status('false_positive')->create(['topic_id' => $topic->id]);
        $resolved->forceFill(['closed_at' => now()->subMinutes(5)])->save();

        $stats = $this->detect();

        $this->assertSame(1, $stats['cooldown']);
        $this->assertSame(1, Alert::count());
    }

    public function test_an_open_alert_keeps_its_status_when_coordination_continues(): void
    {
        $topic = $this->topic();
        $this->campaign($topic, 5);
        $alert = Alert::factory()->status('escalated')->create(['topic_id' => $topic->id, 'score' => 3, 'severity' => 'low']);

        $this->detect();

        $this->assertSame(1, Alert::count());
        $alert->refresh();
        $this->assertSame('escalated', $alert->status);
        $this->assertGreaterThan(3, $alert->score);
        $this->assertSame(0, DB::table('alert_actions')->where('alert_id', $alert->id)->count());
    }

    public function test_inactive_topics_are_not_examined(): void
    {
        $this->campaign($this->topic(['is_active' => false]), 6);

        $this->assertSame(0, $this->detect()['topics']);
        $this->assertSame(0, Alert::count());
    }

    public function test_the_trigram_operator_follows_the_similarity_threshold_setting(): void
    {
        $topic = $this->topic();
        $this->setDetection(['similarity_threshold' => 0.3]);
        $accounts = $this->makeAccounts(5, 'loose');
        $texts = ['kabar baik dari kantor pusat hari ini', 'kabar baik dari kantor cabang hari ini', 'kabar baik dari kantor wilayah hari ini', 'kabar baik dari kantor daerah hari ini', 'kabar baik dari kantor unit hari ini'];
        $this->addPosts($this->source, $topic, array_map(
            fn ($i) => ['at' => $this->clock->subMinutes(5)->addSeconds($i * 10), 'account_id' => $accounts[$i], 'text' => $texts[$i]],
            range(0, 4),
        ));
        $this->rebuildMetrics($topic);

        $this->assertSame(1, $this->detect()['coordination']);
    }

    /** @param array<string, mixed> $changes */
    private function setDetection(array $changes): void
    {
        Setting::whereKey('detection')->update(['value' => json_encode([...Setting::detection(), ...$changes])]);
    }
}
