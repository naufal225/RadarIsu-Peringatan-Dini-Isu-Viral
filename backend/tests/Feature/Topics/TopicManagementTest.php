<?php

namespace Tests\Feature\Topics;

use App\Jobs\MatchTopicsJob;
use App\Models\AuditLog;
use App\Models\MetricHourly;
use App\Models\Post;
use App\Models\Topic;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * PRD §9.8, §11 /topics (F2).
 */
class TopicManagementTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function payload(array $overrides = []): array
    {
        return $overrides + [
            'name' => 'Isu bansos',
            'category' => 'institution',
            'keywords' => ['bansos', 'bantuan sosial'],
            'sensitivity' => 'high',
        ];
    }

    public function test_analyst_and_leader_list_topics_with_the_templates_last(): void
    {
        Topic::factory()->create(['name' => 'Topik biasa']);

        foreach (['analyst', 'leader'] as $role) {
            $this->actingAsRole($role);
            $response = $this->getJson('/api/v1/topics')->assertOk();

            $response->assertJsonStructure(['data' => [['id', 'name', 'category', 'keywords', 'sensitivity', 'is_template', 'is_active']]]);
            $this->assertSame([false, true, true, true], array_column($response->json('data'), 'is_template'));
            $this->resetAuth();
        }
    }

    public function test_admin_cannot_read_or_change_topics(): void
    {
        $this->actingAsRole('admin');
        $topic = Topic::factory()->create();

        $this->getJson('/api/v1/topics')->assertForbidden();
        $this->postJson('/api/v1/topics', $this->payload())->assertForbidden();
        $this->patchJson("/api/v1/topics/{$topic->id}", ['name' => 'X'])->assertForbidden();
    }

    public function test_leader_can_read_but_not_change_topics(): void
    {
        $this->actingAsRole('leader');
        $topic = Topic::factory()->create();

        $this->postJson('/api/v1/topics', $this->payload())->assertForbidden();
        $this->patchJson("/api/v1/topics/{$topic->id}", ['name' => 'X'])->assertForbidden();
    }

    public function test_analyst_creates_a_topic_which_is_audited_and_queued_for_matching(): void
    {
        Queue::fake();
        $analyst = $this->actingAsRole('analyst');

        $response = $this->postJson('/api/v1/topics', $this->payload())
            ->assertCreated()
            ->assertJsonPath('data.name', 'Isu bansos')
            ->assertJsonPath('data.category', 'institution')
            ->assertJsonPath('data.keywords', ['bansos', 'bantuan sosial'])
            ->assertJsonPath('data.sensitivity', 'high')
            ->assertJsonPath('data.is_template', false)
            ->assertJsonPath('data.is_active', true);

        $topic = Topic::findOrFail($response->json('data.id'));
        $this->assertSame($analyst->id, $topic->created_by);
        $log = AuditLog::where('action', 'topic.create')->sole();
        $this->assertSame($topic->id, $log->object_id);
        $this->assertSame($analyst->id, $log->user_id);
        Queue::assertPushed(MatchTopicsJob::class, fn (MatchTopicsJob $job) => $job->topicId === $topic->id);
    }

    public function test_sensitivity_defaults_to_medium_and_keywords_are_trimmed_and_deduplicated(): void
    {
        Queue::fake();
        $this->actingAsRole('analyst');

        $this->postJson('/api/v1/topics', ['name' => 'T', 'category' => 'general', 'keywords' => ['  Hoaks ', 'hoaks', 'HOAKS', 'Disinformasi']])
            ->assertCreated()
            ->assertJsonPath('data.keywords', ['Hoaks', 'Disinformasi'])
            ->assertJsonPath('data.sensitivity', 'medium');
    }

    public function test_a_topic_created_inactive_is_not_matched(): void
    {
        Queue::fake();
        $this->actingAsRole('analyst');

        $this->postJson('/api/v1/topics', $this->payload(['is_active' => false]))->assertCreated()->assertJsonPath('data.is_active', false);

        Queue::assertNothingPushed();
    }

    public function test_keywords_that_still_hold_a_template_placeholder_are_rejected(): void
    {
        Queue::fake();
        $this->actingAsRole('analyst');
        $template = Topic::where('is_template', true)->first();

        // PRD §9.8: the template's own keywords, and any keyword with brackets.
        $this->postJson('/api/v1/topics', $this->payload(['keywords' => $template->keywords]))
            ->assertUnprocessable()->assertJsonValidationErrors(['keywords.0']);
        $this->postJson('/api/v1/topics', $this->payload(['keywords' => ['bansos', 'bantuan [wilayah]']]))
            ->assertUnprocessable()->assertJsonValidationErrors(['keywords.1']);
        $this->postJson('/api/v1/topics', $this->payload(['keywords' => ['bansos]']]))
            ->assertUnprocessable()->assertJsonValidationErrors(['keywords.0']);

        $this->assertSame(3, Topic::count(), 'only the seeded templates exist');
        $this->assertSame(0, AuditLog::where('action', 'topic.create')->count());
        Queue::assertNothingPushed();
    }

    public function test_keywords_that_could_never_match_are_rejected(): void
    {
        $this->actingAsRole('analyst');

        $this->postJson('/api/v1/topics', $this->payload(['keywords' => ['!!!', '...']]))
            ->assertUnprocessable()->assertJsonValidationErrors(['keywords']);
    }

    /**
     * @return array<string, array{array<string, mixed>, string}>
     */
    public static function invalidPayloads(): array
    {
        return [
            'missing name' => [['name' => null], 'name'],
            'name too long' => [['name' => str_repeat('a', 151)], 'name'],
            'unknown category' => [['category' => 'politik'], 'category'],
            'unknown sensitivity' => [['sensitivity' => 'ekstrem'], 'sensitivity'],
            'no keywords' => [['keywords' => null], 'keywords'],
            'empty keywords' => [['keywords' => []], 'keywords'],
            'keywords not an array' => [['keywords' => 'bansos'], 'keywords'],
            'too many keywords' => [['keywords' => array_map(fn ($i) => "kata$i", range(1, 51))], 'keywords'],
            'keyword too long' => [['keywords' => [str_repeat('a', 101)]], 'keywords.0'],
            'blank keyword' => [['keywords' => ['bansos', '   ']], 'keywords.1'],
            'keyword not a string' => [['keywords' => [123]], 'keywords.0'],
            'is_active not a boolean' => [['is_active' => 'mungkin'], 'is_active'],
        ];
    }

    /**
     * @param  array<string, mixed>  $changes
     */
    #[DataProvider('invalidPayloads')]
    public function test_invalid_input_is_rejected_without_side_effects(array $changes, string $field): void
    {
        Queue::fake();
        $this->actingAsRole('analyst');

        $this->postJson('/api/v1/topics', $this->payload($changes))->assertUnprocessable()->assertJsonValidationErrors([$field]);

        $this->assertSame(3, Topic::count());
        Queue::assertNothingPushed();
    }

    public function test_update_changes_fields_audits_them_and_rematches_when_keywords_change(): void
    {
        Queue::fake();
        $this->actingAsRole('analyst');
        $topic = Topic::factory()->create(['keywords' => ['hoaks'], 'sensitivity' => 'medium']);

        $this->patchJson("/api/v1/topics/{$topic->id}", ['name' => 'Nama baru', 'keywords' => ['hoaks', 'disinformasi'], 'sensitivity' => 'low'])
            ->assertOk()
            ->assertJsonPath('data.name', 'Nama baru')
            ->assertJsonPath('data.keywords', ['hoaks', 'disinformasi'])
            ->assertJsonPath('data.sensitivity', 'low');

        $log = AuditLog::where('action', 'topic.update')->sole();
        $this->assertSame($topic->id, $log->object_id);
        $this->assertEqualsCanonicalizing(['name', 'keywords', 'sensitivity'], $log->detail['changes']);
        Queue::assertPushed(MatchTopicsJob::class, 1);
    }

    public function test_changing_only_the_name_or_sensitivity_does_not_rematch(): void
    {
        Queue::fake();
        $this->actingAsRole('analyst');
        $topic = Topic::factory()->create();

        $this->patchJson("/api/v1/topics/{$topic->id}", ['name' => 'Lain', 'sensitivity' => 'high', 'category' => 'opsec'])->assertOk();

        Queue::assertNothingPushed();
        $this->assertSame(1, AuditLog::where('action', 'topic.update')->count());
    }

    public function test_deactivating_keeps_history_and_reactivating_rematches(): void
    {
        Queue::fake();
        $this->actingAsRole('analyst');
        $topic = Topic::factory()->create();

        $this->patchJson("/api/v1/topics/{$topic->id}", ['is_active' => false])->assertOk()->assertJsonPath('data.is_active', false);
        Queue::assertNothingPushed();

        $this->patchJson("/api/v1/topics/{$topic->id}", ['is_active' => true])->assertOk()->assertJsonPath('data.is_active', true);
        Queue::assertPushed(MatchTopicsJob::class, 1);
    }

    public function test_an_update_that_changes_nothing_writes_no_audit_row_and_queues_nothing(): void
    {
        Queue::fake();
        $this->actingAsRole('analyst');
        $topic = Topic::factory()->create(['name' => 'Sama', 'keywords' => ['hoaks']]);

        $this->patchJson("/api/v1/topics/{$topic->id}", ['name' => 'Sama', 'keywords' => ['hoaks']])->assertOk();

        $this->assertSame(0, AuditLog::where('action', 'topic.update')->count());
        Queue::assertNothingPushed();
    }

    public function test_update_validates_like_create(): void
    {
        $this->actingAsRole('analyst');
        $topic = Topic::factory()->create();

        $this->patchJson("/api/v1/topics/{$topic->id}", ['keywords' => ['[istilah sensitif]']])->assertUnprocessable()->assertJsonValidationErrors(['keywords.0']);
        $this->patchJson("/api/v1/topics/{$topic->id}", ['keywords' => []])->assertUnprocessable()->assertJsonValidationErrors(['keywords']);
        $this->patchJson("/api/v1/topics/{$topic->id}", ['category' => 'politik'])->assertUnprocessable()->assertJsonValidationErrors(['category']);
    }

    public function test_templates_cannot_be_changed(): void
    {
        Queue::fake();
        $this->actingAsRole('analyst');
        $template = Topic::where('is_template', true)->first();

        $this->patchJson("/api/v1/topics/{$template->id}", ['is_active' => true, 'keywords' => ['hoaks']])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['topic']);

        $this->assertFalse($template->fresh()->is_active);
        $this->assertSame(0, AuditLog::where('action', 'topic.update')->count());
        Queue::assertNothingPushed();
    }

    public function test_unknown_topic_is_not_found(): void
    {
        $this->actingAsRole('analyst');

        $this->patchJson('/api/v1/topics/999999', ['name' => 'X'])->assertNotFound();
    }

    public function test_creating_a_topic_fills_its_metrics_from_the_stored_posts(): void
    {
        $this->actingAsRole('analyst');
        Post::factory()->create(['text_norm' => 'bansos telat', 'posted_at' => '2026-10-20T08:10:00Z', 'sentiment' => 'negative']);
        Post::factory()->create(['text_norm' => 'bansos lancar', 'posted_at' => '2026-10-20T08:40:00Z', 'sentiment' => 'positive']);
        Post::factory()->create(['text_norm' => 'cuaca cerah', 'posted_at' => '2026-10-20T08:45:00Z']);

        // The test queue is `sync`: the rematch job runs inside the request.
        $id = $this->postJson('/api/v1/topics', $this->payload(['keywords' => ['bansos']]))->assertCreated()->json('data.id');

        $metric = MetricHourly::where('topic_id', $id)->sole();
        $this->assertSame([2, 1, 1], [$metric->volume, $metric->positive_count, $metric->negative_count]);
    }
}
