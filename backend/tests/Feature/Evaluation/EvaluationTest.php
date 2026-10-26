<?php

namespace Tests\Feature\Evaluation;

use App\Models\Account;
use App\Models\Alert;
use App\Models\AlertEvidence;
use App\Models\AuditLog;
use App\Models\EvaluationRun;
use App\Models\Post;
use App\Models\ReplayScenario;
use App\Models\Source;
use App\Models\User;
use Database\Seeders\DemoScenarioSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EvaluationTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    /** Labeled posts for three accounts plus an issue alert that flags two of them. */
    private function labeledWorld(): array
    {
        $source = Source::factory()->create();
        [$hit, $missed, $organicFlagged] = Account::factory()->count(3)->create()->all();
        Post::factory()->create(['source_id' => $source->id, 'account_id' => $hit->id, 'label_manual' => 'anomalous']);
        Post::factory()->create(['source_id' => $source->id, 'account_id' => $missed->id, 'label_manual' => 'anomalous']);
        Post::factory()->create(['source_id' => $source->id, 'account_id' => $organicFlagged->id, 'label_manual' => 'organic']);
        Post::factory()->create(['source_id' => $source->id, 'account_id' => $organicFlagged->id, 'label_manual' => 'organic']);

        $alert = Alert::factory()->create(['kind' => 'issue']);
        AlertEvidence::create(['alert_id' => $alert->id, 'account_id' => $hit->id, 'reason' => 'similar_text']);
        AlertEvidence::create(['alert_id' => $alert->id, 'account_id' => $organicFlagged->id, 'reason' => 'young_account']);
        // spike samples and impersonation alerts never predict an anomalous account
        AlertEvidence::create(['alert_id' => $alert->id, 'account_id' => $missed->id, 'reason' => 'spike_sample']);
        $impersonation = Alert::factory()->create(['kind' => 'impersonation', 'topic_id' => null, 'subject_account_id' => $missed->id]);
        AlertEvidence::create(['alert_id' => $impersonation->id, 'account_id' => $missed->id, 'reason' => 'name_similarity']);

        return [$source, $alert];
    }

    public function test_an_analyst_runs_an_evaluation_over_all_labeled_posts(): void
    {
        $analyst = $this->actingAsRole('analyst');
        $this->labeledWorld();

        $this->postJson('/api/v1/evaluation/run')
            ->assertCreated()
            ->assertJsonPath('data.labeled_posts', 4)
            ->assertJsonPath('data.tp', 1)
            ->assertJsonPath('data.fp', 1)
            ->assertJsonPath('data.fn', 1)
            ->assertJsonPath('data.precision', 0.5)
            ->assertJsonPath('data.recall', 0.5)
            ->assertJsonPath('data.f1', 0.5)
            ->assertJsonPath('data.detection_latency_seconds', null)
            ->assertJsonPath('data.run_by', $analyst->name);

        $this->assertSame(1, EvaluationRun::count());
        $this->assertSame(1, AuditLog::where('action', 'evaluation.run')->count());
    }

    public function test_an_admin_may_run_and_two_runs_make_two_rows(): void
    {
        $this->actingAsRole('admin');
        $this->labeledWorld();

        $this->postJson('/api/v1/evaluation/run')->assertCreated();
        $this->postJson('/api/v1/evaluation/run', ['scenario_id' => null])->assertCreated();

        $this->assertSame(2, EvaluationRun::count());
    }

    public function test_a_mixed_label_account_counts_as_anomalous(): void
    {
        $this->actingAsRole('analyst');
        $account = Account::factory()->create();
        Post::factory()->create(['account_id' => $account->id, 'label_manual' => 'organic']);
        Post::factory()->create(['account_id' => $account->id, 'label_manual' => 'anomalous']);

        $this->postJson('/api/v1/evaluation/run')->assertCreated()
            ->assertJsonPath('data.fn', 1)
            ->assertJsonPath('data.notes', ['no_predicted_positive', 'mixed_label_accounts:1']);
    }

    public function test_an_evaluation_without_labels_is_all_zero_with_notes(): void
    {
        $this->actingAsRole('analyst');

        $this->postJson('/api/v1/evaluation/run')->assertCreated()
            ->assertJsonPath('data.labeled_posts', 0)
            ->assertJsonPath('data.f1', 0)
            ->assertJsonPath('data.notes.0', 'no_labeled_accounts');
    }

    public function test_the_scenario_must_exist_and_have_been_replayed(): void
    {
        $this->actingAsRole('analyst');
        $never = ReplayScenario::factory()->create();

        $this->postJson('/api/v1/evaluation/run', ['scenario_id' => 999999])->assertStatus(422)->assertJsonValidationErrors('scenario_id');
        $this->postJson('/api/v1/evaluation/run', ['scenario_id' => 'abc'])->assertStatus(422);
        $this->postJson('/api/v1/evaluation/run', ['scenario_id' => $never->id])->assertStatus(422)
            ->assertJsonPath('errors.scenario_id.0', 'scenario_not_replayed');
        $this->assertSame(0, EvaluationRun::count());
    }

    public function test_the_leader_reads_aggregates_but_cannot_run(): void
    {
        $run = EvaluationRun::factory()->create();
        $this->actingAsRole('leader');

        $response = $this->getJson('/api/v1/evaluation/runs')->assertOk()
            ->assertJsonPath('data.0.id', $run->id)
            ->assertJsonPath('data.0.f1', 0.8)
            ->assertJsonPath('meta.total', 1);
        $keys = array_keys($response->json('data.0'));
        sort($keys);
        $this->assertSame(['created_at', 'detection_latency_seconds', 'f1', 'fn', 'fp', 'id', 'labeled_posts', 'notes', 'precision', 'recall', 'run_by', 'scenario', 'tp'], $keys);

        $this->postJson('/api/v1/evaluation/run')->assertForbidden();
    }

    public function test_history_is_newest_first_and_paginated(): void
    {
        $this->actingAsRole('analyst');
        $runs = EvaluationRun::factory()->count(3)->create();

        $this->getJson('/api/v1/evaluation/runs?per_page=2')->assertOk()
            ->assertJsonPath('data.0.id', $runs->last()->id)
            ->assertJsonCount(2, 'data')->assertJsonPath('meta.last_page', 2);
        $this->getJson('/api/v1/evaluation/runs?per_page=101')->assertStatus(422);
    }

    public function test_guests_are_unauthorized(): void
    {
        $this->getJson('/api/v1/evaluation/runs')->assertUnauthorized();
        $this->postJson('/api/v1/evaluation/run')->assertUnauthorized();
    }

    public function test_end_to_end_replay_then_labels_then_evaluation(): void
    {
        $this->seed(DemoScenarioSeeder::class);
        $scenario = ReplayScenario::where('name', DemoScenarioSeeder::SCENARIO_NAME)->firstOrFail();
        $this->artisan('radarisu:replay', ['scenario' => $scenario->id, '--sync' => true])->assertSuccessful();
        $scenario->refresh();

        $this->actingAsRole('analyst');
        $response = $this->postJson('/api/v1/evaluation/run', ['scenario_id' => $scenario->id])->assertCreated();

        $this->assertSame(Post::where('source_id', $scenario->source_id)->count(), $response->json('data.labeled_posts'));
        $this->assertSame(DemoScenarioSeeder::CAMPAIGN_ACCOUNTS, $response->json('data.tp'));
        $this->assertSame(0, $response->json('data.fn'));
        $this->assertEquals(1.0, $response->json('data.recall'));
        $this->assertGreaterThan(0.5, $response->json('data.precision'));
        $this->assertSame($scenario->id, $response->json('data.scenario.id'));

        $latency = $response->json('data.detection_latency_seconds');
        $this->assertGreaterThanOrEqual(0, $latency);
        $this->assertLessThanOrEqual(15 * 60, $latency, 'found within minutes of the incident start');
    }

    public function test_the_command_stores_a_run_for_the_first_admin(): void
    {
        $this->labeledWorld();

        $this->artisan('radarisu:evaluate')->assertSuccessful();
        $this->artisan('radarisu:evaluate', ['--scenario' => 99999])->assertFailed();
        $this->artisan('radarisu:evaluate', ['--user' => 99999])->assertFailed();

        $run = EvaluationRun::firstOrFail();
        $this->assertSame(User::whereHas('role', fn ($q) => $q->where('slug', 'admin'))->orderBy('id')->value('id'), $run->run_by);
        $this->assertSame(1, EvaluationRun::count());
    }
}
