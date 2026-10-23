<?php

namespace Tests\Feature\Briefings;

use App\Models\Alert;
use App\Models\AuditLog;
use App\Models\Briefing;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * PRD §8.4, §9.6, §11.8 (F9 Briefing PDF).
 */
class BriefingTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
    }

    public function test_analyst_can_create_briefing_for_reviewing_alert(): void
    {
        $alert = Alert::factory()->status('reviewing')->create([
            'recommendation' => 'Tingkatkan pemantauan patroli siber pada klaster narasi.',
        ]);
        $analyst = $this->actingAsRole('analyst');

        $response = $this->postJson("/api/v1/alerts/{$alert->id}/briefings");

        $response->assertCreated()
            ->assertJsonPath('data.alert_id', $alert->id);

        $this->assertDatabaseHas('briefings', [
            'alert_id' => $alert->id,
            'created_by' => $analyst->id,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'briefing.create',
            'user_id' => $analyst->id,
            'object_type' => 'briefing',
        ]);
    }

    public function test_cannot_create_briefing_for_new_alert(): void
    {
        $alert = Alert::factory()->status('new')->create();
        $this->actingAsRole('analyst');

        $response = $this->postJson("/api/v1/alerts/{$alert->id}/briefings");

        $response->assertUnprocessable()
            ->assertJsonValidationErrors('status');

        $this->assertDatabaseEmpty('briefings');
    }

    public function test_leader_cannot_create_briefing(): void
    {
        $alert = Alert::factory()->status('escalated')->create();
        $this->actingAsRole('leader');

        $this->postJson("/api/v1/alerts/{$alert->id}/briefings")
            ->assertForbidden();

        $this->assertDatabaseEmpty('briefings');
    }

    public function test_analyst_and_leader_can_list_briefings_with_scoped_visibility(): void
    {
        $visibleAlert = Alert::factory()->status('escalated')->create();
        $hiddenAlert = Alert::factory()->status('reviewing')->create();

        $analyst = $this->actingAsRole('analyst');
        $b1 = Briefing::factory()->create(['alert_id' => $visibleAlert->id, 'created_by' => $analyst->id]);
        $b2 = Briefing::factory()->create(['alert_id' => $hiddenAlert->id, 'created_by' => $analyst->id]);

        // Analyst sees all
        $this->getJson('/api/v1/briefings')
            ->assertOk()
            ->assertJsonCount(2, 'data');

        // Leader only sees b1 (associated alert is escalated)
        $this->resetAuth();
        $this->actingAsRole('leader');
        $this->getJson('/api/v1/briefings')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $b1->id);
    }

    public function test_leader_can_download_briefing_for_visible_alert(): void
    {
        $alert = Alert::factory()->status('escalated')->create();
        $analyst = $this->actingAsRole('analyst');

        $briefing = Briefing::factory()->create([
            'alert_id' => $alert->id,
            'created_by' => $analyst->id,
            'file_path' => "briefings/test-{$alert->id}.pdf",
        ]);
        Storage::disk('local')->put($briefing->file_path, '%PDF-1.4 mock content');

        $leader = $this->actingAsRole('leader');
        $response = $this->get("/api/v1/briefings/{$briefing->id}/download");

        $response->assertOk();
        $response->assertHeader('content-type', 'application/pdf');

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'briefing.download',
            'user_id' => $leader->id,
            'object_type' => 'briefing',
            'object_id' => $briefing->id,
        ]);
    }

    public function test_leader_gets_404_when_downloading_briefing_for_invisible_alert(): void
    {
        $alert = Alert::factory()->status('reviewing')->create();
        $analyst = $this->actingAsRole('analyst');

        $briefing = Briefing::factory()->create([
            'alert_id' => $alert->id,
            'created_by' => $analyst->id,
            'file_path' => "briefings/test-{$alert->id}.pdf",
        ]);
        Storage::disk('local')->put($briefing->file_path, '%PDF-1.4 mock content');

        $this->actingAsRole('leader');
        $this->get("/api/v1/briefings/{$briefing->id}/download")
            ->assertNotFound();

        $this->assertDatabaseMissing('audit_logs', [
            'action' => 'briefing.download',
        ]);
    }

    public function test_admin_cannot_access_briefings(): void
    {
        $this->actingAsRole('admin');

        $this->getJson('/api/v1/briefings')->assertForbidden();
    }
}
