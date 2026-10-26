<?php

namespace Tests\Feature\Detection;

use App\Models\Alert;
use App\Models\AlertEvidence;
use App\Models\Topic;
use App\Services\Detection\SpikeDetectionService;
use Database\Seeders\SpikeDemoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Tests\TestCase;

/**
 * The demo scenario must always trigger the detector, whatever time of day it is seeded.
 */
class SpikeDemoSeederTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    private function seedDemo(): void
    {
        $this->seed(SpikeDemoSeeder::class);
    }

    public function test_the_demo_triggers_an_alert_at_any_minute_of_the_hour(): void
    {
        foreach (['2026-10-26 12:02:00', '2026-10-26 12:30:00', '2026-10-26 12:59:00'] as $at) {
            $this->travelTo($at);
            $this->seedDemo();

            $stats = app(SpikeDetectionService::class)->run();

            $this->assertSame(1, $stats['triggered'], "no spike at {$at}");
            $alert = Alert::where('topic_id', Topic::where('name', SpikeDemoSeeder::TOPIC_NAME)->value('id'))->sole();
            $this->assertContains($alert->severity, ['low', 'medium', 'high']);
            $this->assertGreaterThan(0, $alert->score);
            $this->assertSame(10, AlertEvidence::where('alert_id', $alert->id)->count());
            // Reseeding replaces the demo, so the next iteration starts clean.
        }
    }

    public function test_detection_over_the_demo_is_idempotent(): void
    {
        $this->seedDemo();

        app(SpikeDetectionService::class)->run();
        app(SpikeDetectionService::class)->run();

        $this->assertSame(1, Alert::count());
        $this->assertSame(10, AlertEvidence::count());
    }

    public function test_reseeding_replaces_the_demo_instead_of_piling_up(): void
    {
        $this->seedDemo();
        app(SpikeDetectionService::class)->run();
        $posts = DB::table('posts')->count();

        $this->seedDemo();

        $this->assertSame($posts, DB::table('posts')->count());
        $this->assertSame(1, Topic::where('name', SpikeDemoSeeder::TOPIC_NAME)->count());
        $this->assertSame(0, Alert::count()); // the old alert went with the old data
    }

    public function test_it_refuses_to_reset_a_demo_whose_alert_was_already_triaged(): void
    {
        $this->seedDemo();
        app(SpikeDetectionService::class)->run();
        $alert = Alert::sole();
        DB::table('alert_actions')->insert([
            'alert_id' => $alert->id, 'user_id' => null, 'action' => 'comment',
            'from_status' => 'new', 'to_status' => null, 'note' => 'x', 'created_at' => now(),
        ]);

        $this->expectException(RuntimeException::class);
        $this->seedDemo();
    }

    public function test_it_is_not_part_of_the_normal_seed(): void
    {
        $this->assertSame(0, Topic::where('name', SpikeDemoSeeder::TOPIC_NAME)->count());
    }
}
