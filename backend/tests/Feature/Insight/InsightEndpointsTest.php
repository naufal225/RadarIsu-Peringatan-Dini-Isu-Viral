<?php

namespace Tests\Feature\Insight;

use App\Models\ReplayScenario;
use App\Models\Topic;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Endpoint insight (agregat baca-saja) untuk halaman audit, pelabelan, replay, topik, dan status sistem.
 */
class InsightEndpointsTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    public function test_audit_summary_counts_actions_and_days(): void
    {
        $this->actingAsRole('admin');
        $this->insertAudit('auth.login', '2026-11-10 09:00:00');
        $this->insertAudit('auth.login', '2026-11-10 10:00:00');
        $this->insertAudit('replay.start', '2026-11-11 08:00:00');

        $data = $this->getJson('/api/v1/audit-logs/summary')->assertOk()->json('data');

        $this->assertSame(3, $data['total']);
        $this->assertSame(2, $data['by_action']['auth.login']);
        $days = collect($data['by_day'])->mapWithKeys(fn ($d) => [$d['day'] => $d['total']]);
        $this->assertSame(2, $days['2026-11-10']);
        $this->assertSame(1, $days['2026-11-11']);
    }

    public function test_audit_summary_respects_date_range(): void
    {
        $this->actingAsRole('admin');
        $this->insertAudit('auth.login', '2026-11-10 09:00:00');
        $this->insertAudit('auth.login', '2026-11-20 09:00:00');

        $this->getJson('/api/v1/audit-logs/summary?from=2026-11-15&to=2026-11-30')
            ->assertOk()
            ->assertJsonPath('data.total', 1);
    }

    public function test_labeling_daily_groups_labels_by_posting_day(): void
    {
        $this->actingAsRole('analyst');
        $this->insertPost('2026-11-10 09:00:00', 'organic');
        $this->insertPost('2026-11-10 12:00:00', 'anomalous');
        $this->insertPost('2026-11-11 08:00:00', null);

        $days = collect($this->getJson('/api/v1/labeling/daily')->assertOk()->json('data'))->keyBy('day');

        $this->assertSame(['organic' => 1, 'anomalous' => 1, 'unlabeled' => 0], collect($days['2026-11-10'])->only(['organic', 'anomalous', 'unlabeled'])->all());
        $this->assertSame(1, $days['2026-11-11']['unlabeled']);
    }

    public function test_replay_composition_counts_phases_and_labels(): void
    {
        $this->actingAsRole('admin');
        $scenario = ReplayScenario::factory()->create();
        DB::table('replay_rows')->insert([
            ['scenario_id' => $scenario->id, 'offset_seconds' => 0, 'phase' => 'baseline', 'text' => 'a', 'account_handle' => 'x', 'label_manual' => 'organic', 'created_at' => now(), 'updated_at' => now()],
            ['scenario_id' => $scenario->id, 'offset_seconds' => 60, 'phase' => 'incident', 'text' => 'b', 'account_handle' => 'y', 'label_manual' => 'anomalous', 'created_at' => now(), 'updated_at' => now()],
            ['scenario_id' => $scenario->id, 'offset_seconds' => 120, 'phase' => 'incident', 'text' => 'c', 'account_handle' => 'z', 'label_manual' => null, 'created_at' => now(), 'updated_at' => now()],
        ]);

        $this->getJson("/api/v1/replay/scenarios/{$scenario->id}/composition")
            ->assertOk()
            ->assertJsonPath('data.total', 3)
            ->assertJsonPath('data.phases.baseline', 1)
            ->assertJsonPath('data.phases.incident', 2)
            ->assertJsonPath('data.labels.anomalous', 1)
            ->assertJsonPath('data.labels.unlabeled', 1);
    }

    public function test_topic_coverage_counts_matched_posts(): void
    {
        $this->actingAsRole('analyst');
        $topic = Topic::factory()->create(['name' => 'Topik uji']);
        $matched = $this->insertPost('2026-11-10 09:00:00', null);
        $this->insertPost('2026-11-10 10:00:00', null);
        DB::table('topic_matches')->insert(['post_id' => $matched, 'topic_id' => $topic->id]);

        $data = $this->getJson('/api/v1/topics/coverage')->assertOk()->json('data');

        $this->assertSame(2, $data['posts_total']);
        $this->assertSame(1, $data['posts_matched']);
        $row = collect($data['topics'])->firstWhere('id', $topic->id);
        $this->assertSame(1, $row['matched_posts']);
    }

    public function test_system_status_reports_sentiment_distribution(): void
    {
        $this->actingAsRole('admin');
        $this->insertPost('2026-11-10 09:00:00', null, 'neutral');
        $this->insertPost('2026-11-10 10:00:00', null, 'positive');

        $this->getJson('/api/v1/system/status')
            ->assertOk()
            ->assertJsonPath('data.sentiment.neutral', 1)
            ->assertJsonPath('data.sentiment.positive', 1)
            ->assertJsonPath('data.sentiment.negative', 0);
    }

    public function test_insight_endpoints_are_forbidden_without_permission(): void
    {
        $this->actingAsRole('leader');
        $this->getJson('/api/v1/audit-logs/summary')->assertForbidden();
        $this->getJson('/api/v1/labeling/daily')->assertForbidden();
    }

    private function insertAudit(string $action, string $createdAt): void
    {
        DB::table('audit_logs')->insert([
            'user_id' => null,
            'action' => $action,
            'detail' => '{}',
            'ip_address' => '203.0.113.1',
            'created_at' => $createdAt,
        ]);
    }

    private function insertPost(string $postedAt, ?string $label, string $sentiment = 'neutral'): int
    {
        $sourceId = DB::table('sources')->value('id') ?? \App\Models\Source::factory()->create()->id;
        $accountId = DB::table('accounts')->insertGetId([
            'source_type' => 'csv',
            'handle' => 'akun'.uniqid(),
            'first_seen_at' => $postedAt,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return DB::table('posts')->insertGetId([
            'source_id' => $sourceId,
            'account_id' => $accountId,
            'external_id' => 'uji-'.uniqid(),
            'text' => 'teks uji',
            'text_norm' => 'teks uji',
            'posted_at' => $postedAt,
            'sentiment' => $sentiment,
            'sentiment_score' => 0,
            'is_simulated' => true,
            'label_manual' => $label,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
