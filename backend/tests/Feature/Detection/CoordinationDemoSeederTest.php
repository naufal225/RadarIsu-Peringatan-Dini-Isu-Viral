<?php

namespace Tests\Feature\Detection;

use App\Models\Alert;
use App\Models\AlertEvidence;
use App\Models\Topic;
use App\Services\Detection\IssueDetectionService;
use Database\Seeders\CoordinationDemoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Tests\TestCase;

/**
 * The demo scenario must always trigger the coordination detector, whatever minute it is seeded.
 */
class CoordinationDemoSeederTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    private function seedDemo(): void
    {
        $this->seed(CoordinationDemoSeeder::class);
    }

    private function topicId(): int
    {
        return Topic::where('name', CoordinationDemoSeeder::TOPIC_NAME)->value('id');
    }

    public function test_the_demo_is_a_coordinated_cluster_at_any_minute_of_the_hour(): void
    {
        foreach (['2026-10-26 12:02:00', '2026-10-26 12:30:00', '2026-10-26 12:59:00'] as $at) {
            $this->travelTo($at);
            $this->seedDemo();

            $stats = app(IssueDetectionService::class)->run();

            $this->assertSame(1, $stats['coordination'], "no coordination at {$at}");
            $alert = Alert::where('topic_id', $this->topicId())->sole();
            $count = fn (string $reason) => AlertEvidence::where('alert_id', $alert->id)->where('reason', $reason)->count();
            $this->assertSame(CoordinationDemoSeeder::CAMPAIGN_ACCOUNTS, $count('similar_text'));
            $this->assertSame(CoordinationDemoSeeder::YOUNG_ACCOUNTS, $count('young_account'));
            // Only the accounts inside the densest 5 minutes of a 6-minute burst: at least 80% of the 40.
            $this->assertGreaterThanOrEqual(32, $count('synchronized_posting'));
            $this->assertLessThanOrEqual(CoordinationDemoSeeder::CAMPAIGN_ACCOUNTS, $count('synchronized_posting'));
            $this->assertGreaterThan(0, $alert->score_breakdown['anomaly']['raw']);
        }
    }

    public function test_the_organic_posts_are_not_pulled_into_the_cluster(): void
    {
        $this->seedDemo();

        app(IssueDetectionService::class)->run();

        $handles = AlertEvidence::where('reason', 'similar_text')->join('accounts', 'accounts.id', '=', 'alert_evidence.account_id')->pluck('accounts.handle');
        $this->assertCount(CoordinationDemoSeeder::CAMPAIGN_ACCOUNTS, $handles);
        $this->assertTrue($handles->every(fn ($h) => str_starts_with($h, '@demo_koordinasi_')));
    }

    public function test_detection_over_the_demo_is_idempotent(): void
    {
        $this->seedDemo();

        app(IssueDetectionService::class)->run();
        $evidence = AlertEvidence::count();
        app(IssueDetectionService::class)->run();

        $this->assertSame(1, Alert::count());
        $this->assertSame($evidence, AlertEvidence::count());
    }

    public function test_reseeding_replaces_the_demo_instead_of_piling_up(): void
    {
        $this->seedDemo();
        app(IssueDetectionService::class)->run();
        $posts = DB::table('posts')->count();

        $this->seedDemo();

        $this->assertSame($posts, DB::table('posts')->count());
        $this->assertSame(1, Topic::where('name', CoordinationDemoSeeder::TOPIC_NAME)->count());
        $this->assertSame(0, Alert::count());
    }

    public function test_it_refuses_to_reset_a_demo_whose_alert_was_already_triaged(): void
    {
        $this->seedDemo();
        app(IssueDetectionService::class)->run();
        DB::table('alert_actions')->insert([
            'alert_id' => Alert::sole()->id, 'user_id' => null, 'action' => 'comment',
            'from_status' => 'new', 'to_status' => null, 'note' => 'x', 'created_at' => now(),
        ]);

        $this->expectException(RuntimeException::class);
        $this->seedDemo();
    }

    public function test_it_is_not_part_of_the_normal_seed(): void
    {
        $this->assertSame(0, Topic::where('name', CoordinationDemoSeeder::TOPIC_NAME)->count());
    }
}
