<?php

namespace Tests\Feature\Labeling;

use App\Models\Account;
use App\Models\AuditLog;
use App\Models\Post;
use App\Models\Source;
use App\Models\Topic;
use Database\Seeders\CoordinationDemoSeeder;
use Database\Seeders\LabelingDemoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class LabelingApiTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    public function test_the_queue_lists_posts_newest_first_with_progress(): void
    {
        $this->actingAsRole('analyst');
        $old = Post::factory()->create(['posted_at' => now()->subDay()]);
        $new = Post::factory()->create(['posted_at' => now()->subHour(), 'label_manual' => 'anomalous', 'is_simulated' => true]);
        Post::factory()->create(['posted_at' => now()->subHours(3), 'label_manual' => 'organic']);

        $response = $this->getJson('/api/v1/labeling/posts')->assertOk();

        $response->assertJsonPath('data.0.id', $new->id)
            ->assertJsonPath('data.0.label_manual', 'anomalous')
            ->assertJsonPath('data.0.is_simulated', true)
            ->assertJsonPath('data.2.id', $old->id)
            ->assertJsonPath('meta.total', 3)
            ->assertJsonPath('meta.progress', ['labeled' => 2, 'organic' => 1, 'anomalous' => 1, 'target' => 200]);
        $this->assertNotNull($response->json('data.0.account.handle'));
    }

    public function test_filters_narrow_the_queue(): void
    {
        $this->actingAsRole('analyst');
        $topic = Topic::factory()->create();
        $unlabeled = Post::factory()->create(['is_simulated' => true]);
        $organic = Post::factory()->create(['label_manual' => 'organic']);
        $anomalous = Post::factory()->create(['label_manual' => 'anomalous']);
        DB::table('topic_matches')->insert(['post_id' => $unlabeled->id, 'topic_id' => $topic->id]);

        $ids = fn (string $query) => collect($this->getJson('/api/v1/labeling/posts?'.$query)->assertOk()->json('data'))->pluck('id')->sort()->values()->all();

        $this->assertSame([$unlabeled->id], $ids('status=unlabeled'));
        $this->assertSame([$organic->id, $anomalous->id], $ids('status=labeled'));
        $this->assertSame([$organic->id], $ids('label=organic'));
        $this->assertSame([$unlabeled->id], $ids('is_simulated=1'));
        $this->assertSame([$unlabeled->id], $ids('topic_id='.$topic->id));
    }

    public function test_the_queue_is_paginated_and_validates_filters(): void
    {
        $this->actingAsRole('analyst');
        Post::factory()->count(3)->create();

        $this->getJson('/api/v1/labeling/posts?per_page=2')->assertOk()
            ->assertJsonCount(2, 'data')->assertJsonPath('meta.last_page', 2);
        foreach (['per_page=101', 'status=bogus', 'label=bogus', 'topic_id=999999', 'is_simulated=maybe'] as $query) {
            $this->getJson('/api/v1/labeling/posts?'.$query)->assertStatus(422);
        }
    }

    public function test_an_analyst_sets_changes_and_removes_a_label(): void
    {
        $analyst = $this->actingAsRole('analyst');
        $post = Post::factory()->create();

        $this->putJson("/api/v1/labeling/posts/{$post->id}", ['label_manual' => 'organic'])
            ->assertOk()->assertJsonPath('data.label_manual', 'organic');
        $this->putJson("/api/v1/labeling/posts/{$post->id}", ['label_manual' => 'anomalous'])->assertOk();
        $this->putJson("/api/v1/labeling/posts/{$post->id}", ['label_manual' => null])
            ->assertOk()->assertJsonPath('data.label_manual', null);

        $this->assertNull($post->refresh()->label_manual);
        $logs = AuditLog::where('action', 'label.set')->orderBy('id')->get();
        $this->assertCount(3, $logs);
        $this->assertEquals(['from' => 'anomalous', 'to' => null], $logs[2]->detail);
        $this->assertSame($analyst->id, $logs[0]->user_id);
        $this->assertSame($post->id, $logs[0]->object_id);
    }

    public function test_repeating_the_same_label_is_idempotent_and_audited_once(): void
    {
        $this->actingAsRole('analyst');
        $post = Post::factory()->create();

        $this->putJson("/api/v1/labeling/posts/{$post->id}", ['label_manual' => 'organic'])->assertOk();
        $this->putJson("/api/v1/labeling/posts/{$post->id}", ['label_manual' => 'organic'])->assertOk();

        $this->assertSame(1, AuditLog::where('action', 'label.set')->count());
    }

    public function test_an_invalid_label_is_rejected(): void
    {
        $this->actingAsRole('analyst');
        $post = Post::factory()->create(['label_manual' => 'organic']);

        foreach ([['label_manual' => 'spam'], [], ['label_manual' => ['organic']], ['label_manual' => 1]] as $body) {
            $this->putJson("/api/v1/labeling/posts/{$post->id}", $body)->assertStatus(422)->assertJsonValidationErrors('label_manual');
        }
        $this->assertSame('organic', $post->refresh()->label_manual);
        $this->assertSame(0, AuditLog::where('action', 'label.set')->count());
    }

    public function test_an_unknown_post_is_a_404(): void
    {
        $this->actingAsRole('analyst');

        $this->putJson('/api/v1/labeling/posts/999999', ['label_manual' => 'organic'])->assertNotFound();
    }

    public function test_admin_and_leader_are_forbidden_and_guests_unauthorized(): void
    {
        $post = Post::factory()->create();

        $this->putJson("/api/v1/labeling/posts/{$post->id}", ['label_manual' => 'organic'])->assertUnauthorized();
        $this->getJson('/api/v1/labeling/posts')->assertUnauthorized();

        foreach (['admin', 'leader'] as $role) {
            $this->resetAuth();
            $this->actingAsRole($role);
            $this->getJson('/api/v1/labeling/posts')->assertForbidden();
            $this->putJson("/api/v1/labeling/posts/{$post->id}", ['label_manual' => 'organic'])->assertForbidden();
        }
        $this->assertNull($post->refresh()->label_manual);
    }

    public function test_the_demo_seeder_labels_the_coordination_demo(): void
    {
        $this->seed(CoordinationDemoSeeder::class);
        $this->seed(LabelingDemoSeeder::class);
        $this->seed(LabelingDemoSeeder::class);

        $source = Source::where('name', CoordinationDemoSeeder::SOURCE_NAME)->firstOrFail();
        $labeled = fn () => Post::where('source_id', $source->id)->whereNotNull('label_manual');
        $this->assertSame(200, $labeled()->count());
        $this->assertSame(40, $labeled()->where('label_manual', 'anomalous')->count());
        $campaign = Account::where('handle', 'like', '@demo\_koordinasi\_%')->pluck('id');
        $this->assertSame(0, $labeled()->where('label_manual', 'organic')->whereIn('account_id', $campaign)->count());
    }
}
