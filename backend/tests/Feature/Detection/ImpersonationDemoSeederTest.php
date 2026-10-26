<?php

namespace Tests\Feature\Detection;

use App\Models\Alert;
use App\Models\AlertEvidence;
use App\Services\Detection\ImpersonationDetectionService;
use Database\Seeders\ImpersonationDemoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Tests\TestCase;

/**
 * The demo scenario must always trigger the impersonation detector on the same accounts, and only them.
 */
class ImpersonationDemoSeederTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    private function seedDemo(): void
    {
        $this->seed(ImpersonationDemoSeeder::class);
    }

    /** @return list<string> handles with an impersonation alert */
    private function flaggedHandles(): array
    {
        return Alert::where('kind', 'impersonation')->join('accounts', 'accounts.id', '=', 'alerts.subject_account_id')
            ->orderBy('accounts.handle')->pluck('accounts.handle')->all();
    }

    public function test_exactly_the_impersonators_are_flagged_at_any_minute_of_the_day(): void
    {
        $expected = array_keys(ImpersonationDemoSeeder::IMPERSONATORS);

        foreach (['2026-10-26 00:05:00', '2026-10-26 12:30:00', '2026-10-26 23:58:00'] as $at) {
            $this->travelTo($at);
            $this->seedDemo();

            $stats = app(ImpersonationDetectionService::class)->run();

            $this->assertSame(count($expected), $stats['triggered'], "wrong count at {$at}");
            $this->assertEqualsCanonicalizing($expected, $this->flaggedHandles(), "wrong accounts at {$at}");
        }
    }

    public function test_decoys_officials_and_the_old_look_alike_are_left_alone(): void
    {
        $this->seedDemo();

        app(ImpersonationDetectionService::class)->run();

        $flagged = $this->flaggedHandles();
        foreach ([...array_keys(ImpersonationDemoSeeder::DECOYS), ...array_keys(ImpersonationDemoSeeder::OFFICIALS), ImpersonationDemoSeeder::OLD_LOOKALIKE] as $handle) {
            $this->assertNotContains($handle, $flagged, $handle);
        }
    }

    public function test_each_alert_names_the_official_account_it_copies(): void
    {
        $this->seedDemo();

        app(ImpersonationDetectionService::class)->run();

        $detail = fn (string $handle) => AlertEvidence::where('reason', 'name_similarity')
            ->whereIn('account_id', DB::table('accounts')->where('handle', $handle)->select('id'))->firstOrFail()->detail;
        $this->assertSame('@demo_kodam', $detail('@demo_k0dam')['official']['handle']);
        $this->assertSame('@demo_humas_kodam', $detail('@demo_humas_kodam_resmi')['official']['handle']);
        $this->assertSame('display_name', $detail('@pusat_informasi_77')['field']);
    }

    public function test_young_accounts_score_higher_than_old_ones_and_unknown_age_is_not_young(): void
    {
        $this->seedDemo();

        app(ImpersonationDetectionService::class)->run();

        $score = fn (string $handle) => Alert::join('accounts', 'accounts.id', '=', 'alerts.subject_account_id')->where('accounts.handle', $handle)->value('alerts.score');
        $this->assertGreaterThan($score('@demo.kodam'), $score('@demo_kodam_official')); // young vs 400 days old
        $this->assertSame(0.0, (float) Alert::join('accounts', 'accounts.id', '=', 'alerts.subject_account_id')
            ->where('accounts.handle', '@demo_kodam2024')->first()->score_breakdown['young_account']['value']);
    }

    public function test_detection_over_the_demo_is_idempotent(): void
    {
        $this->seedDemo();

        app(ImpersonationDetectionService::class)->run();
        $evidence = AlertEvidence::count();
        app(ImpersonationDetectionService::class)->run();

        $this->assertSame(count(ImpersonationDemoSeeder::IMPERSONATORS), Alert::count());
        $this->assertSame($evidence, AlertEvidence::count());
    }

    public function test_reseeding_replaces_the_demo_instead_of_piling_up(): void
    {
        $this->seedDemo();
        app(ImpersonationDetectionService::class)->run();
        $accounts = DB::table('accounts')->count();
        $posts = DB::table('posts')->count();

        $this->seedDemo();

        $this->assertSame($accounts, DB::table('accounts')->count());
        $this->assertSame($posts, DB::table('posts')->count());
        $this->assertSame(count(ImpersonationDemoSeeder::OFFICIALS), DB::table('official_accounts')->where('handle', 'like', '@demo\_%')->count());
        $this->assertSame(0, Alert::count());
    }

    public function test_it_refuses_to_reset_a_demo_whose_alert_was_already_triaged(): void
    {
        $this->seedDemo();
        app(ImpersonationDetectionService::class)->run();
        DB::table('alert_actions')->insert([
            'alert_id' => Alert::first()->id, 'user_id' => null, 'action' => 'comment',
            'from_status' => 'new', 'to_status' => null, 'note' => 'x', 'created_at' => now(),
        ]);

        $this->expectException(RuntimeException::class);
        $this->seedDemo();
    }

    public function test_it_is_not_part_of_the_normal_seed(): void
    {
        $this->assertSame(0, DB::table('official_accounts')->count());
    }
}
