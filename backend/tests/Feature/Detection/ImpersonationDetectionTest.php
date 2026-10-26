<?php

namespace Tests\Feature\Detection;

use App\Jobs\DetectJob;
use App\Models\Alert;
use App\Models\AlertEvidence;
use App\Models\OfficialAccount;
use App\Models\Setting;
use App\Services\Detection\AlertWriter;
use App\Services\Detection\ImpersonationDetectionService;
use App\Services\Detection\IssueDetectionService;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Tests\Concerns\BuildsDetectionData;
use Tests\TestCase;

/**
 * F13 on the database with the real pg_trgm (PRD §10.7, §19.3 item 4). Clock: 2026-10-26 12:30 UTC, so
 * the window of accounts first seen is (2026-10-25 12:30, 2026-10-26 12:30].
 */
class ImpersonationDetectionTest extends TestCase
{
    use BuildsDetectionData;
    use RefreshDatabase;

    protected bool $seed = true;

    private CarbonImmutable $clock;

    private OfficialAccount $official;

    protected function setUp(): void
    {
        parent::setUp();
        $this->clock = CarbonImmutable::parse('2026-10-26 12:30:00', 'UTC');
        $this->travelTo($this->clock);
        $this->official = OfficialAccount::factory()->create(['handle' => '@kodam_contoh', 'display_name' => 'Kodam Contoh']);
    }

    private function detect(): array
    {
        return app(ImpersonationDetectionService::class)->run();
    }

    private function newAccount(string $handle, ?string $display = null, ?CarbonImmutable $createdAt = null, ?CarbonImmutable $firstSeen = null): int
    {
        return $this->makeAccount($handle, $display, $firstSeen ?? $this->clock->subHours(2), $createdAt);
    }

    private function alertFor(int $accountId): ?Alert
    {
        return Alert::where('kind', 'impersonation')->where('subject_account_id', $accountId)->first();
    }

    public function test_look_alikes_are_flagged_with_the_rules_that_fired(): void
    {
        $zero = $this->newAccount('@kodam_c0ntoh');
        $official = $this->newAccount('@kodamcontoh_official');
        $dots = $this->newAccount('@kodam.contoh');
        $suffix = $this->newAccount('@kodam_contoh_id');
        $rn = $this->newAccount('@kodarn_contoh');
        $homoglyph = $this->newAccount('@kоdam_contoh'); // Cyrillic о
        $digits = $this->newAccount('@kodam_contoh2024');

        $stats = $this->detect();

        $this->assertSame(7, $stats['triggered']);
        $this->assertSame(7, $stats['created']);
        foreach ([$zero, $official, $dots, $suffix, $rn, $homoglyph, $digits] as $id) {
            $this->assertNotNull($this->alertFor($id), "account {$id} not flagged");
        }
        $rules = fn (int $id) => collect($this->alertFor($id)->evidence->firstWhere('reason', 'name_similarity')->detail['rules'])->pluck('rule')->all();
        $this->assertContains('confusable_chars', $rules($zero));
        $this->assertContains('affix_stripped', $rules($official));
        $this->assertContains('separators_removed', $rules($dots));
        $this->assertContains('affix_stripped', $rules($suffix));
        $this->assertContains('unicode_folded', $rules($homoglyph));
        $this->assertContains('trailing_digits_stripped', $rules($digits));
    }

    public function test_the_official_accounts_themselves_are_not_flagged(): void
    {
        // The official account is also a row in `accounts`, first seen inside the window.
        $self = $this->newAccount('@kodam_contoh', 'Kodam Contoh');
        $noAt = $this->newAccount('Kodam_Contoh', 'Kodam Contoh'); // same handle without @ and in other case, other source

        $stats = $this->detect();

        $this->assertSame(0, $stats['triggered']);
        $this->assertNull($this->alertFor($self));
        $this->assertNull($this->alertFor($noAt));
    }

    public function test_unrelated_accounts_are_not_flagged(): void
    {
        foreach (['@budi_santoso', '@warga_peduli', '@berita_harian', '@kopi_pagi', '@tentara_nasional'] as $handle) {
            $this->newAccount($handle, 'Orang Biasa');
        }

        $this->assertSame(0, $this->detect()['triggered']);
        $this->assertSame(0, Alert::count());
    }

    public function test_only_accounts_first_seen_inside_the_window_are_examined(): void
    {
        $old = $this->newAccount('@kodam_c0ntoh', null, null, $this->clock->subHours(30));
        $future = $this->newAccount('@kodam_c0ntoh2', null, null, $this->clock->addHour());
        $inside = $this->newAccount('@kodam_c0ntoh3', null, null, $this->clock->subHours(23));

        $stats = $this->detect();

        $this->assertSame(1, $stats['accounts']);
        $this->assertNull($this->alertFor($old));
        $this->assertNull($this->alertFor($future));
        $this->assertNotNull($this->alertFor($inside));
    }

    public function test_the_window_comes_from_settings(): void
    {
        $this->newAccount('@kodam_c0ntoh', null, null, $this->clock->subHours(5));
        $this->setDetection(['impersonation_window_hours' => 3]);
        $this->assertSame(0, $this->detect()['accounts']);

        $this->setDetection(['impersonation_window_hours' => 6]);
        $this->assertSame(1, $this->detect()['triggered']);
    }

    public function test_the_alert_scores_similarity_and_account_age_per_the_prd(): void
    {
        $young = $this->newAccount('@kodam_c0ntoh', null, $this->clock->subDays(3));
        $old = $this->newAccount('@kodam_c0ntoh_x', null, $this->clock->subYears(2));
        $unknown = $this->newAccount('@kodam_c0ntoh_y', null, null);

        $this->detect();

        $youngAlert = $this->alertFor($young);
        $this->assertSame('impersonation', $youngAlert->kind);
        $this->assertNull($youngAlert->topic_id);
        $this->assertSame('new', $youngAlert->status);
        $similarity = $youngAlert->score_breakdown['similarity']['raw'];
        $this->assertSame((int) round($similarity * 70) + 30, $youngAlert->score);
        $this->assertSame(30.0, (float) $youngAlert->score_breakdown['young_account']['value']);
        $this->assertSame((int) round($this->alertFor($old)->score_breakdown['similarity']['raw'] * 70), $this->alertFor($old)->score);
        $this->assertSame(0.0, (float) $this->alertFor($old)->score_breakdown['young_account']['value']);
        $this->assertSame(0.0, (float) $this->alertFor($unknown)->score_breakdown['young_account']['value']); // age unknown
        $this->assertSame(0.6, (float) $youngAlert->score_breakdown['thresholds']['impersonation_threshold']);
    }

    public function test_severity_follows_the_cutoffs_of_issue_alerts(): void
    {
        $id = $this->newAccount('@kodam_c0ntoh', null, $this->clock->subDays(2)); // 70 + 30 = 100

        $this->detect();
        $this->assertSame('high', $this->alertFor($id)->severity);

        $this->setDetection(['severity_cutoffs' => ['medium' => 40, 'high' => 101]]);
        $this->detect();
        $this->assertSame('medium', $this->alertFor($id)->refresh()->severity);

        $this->setDetection(['severity_cutoffs' => ['medium' => 101, 'high' => 102]]);
        $this->detect();
        $this->assertSame('low', $this->alertFor($id)->refresh()->severity);
    }

    public function test_evidence_names_the_official_account_the_similarity_and_the_account(): void
    {
        $id = $this->newAccount('@kodam_c0ntoh', 'Kodam C0ntoh', $this->clock->subDays(2));
        $postId = DB::table('posts')->insertGetId([
            'source_id' => $this->makeSource()->id, 'account_id' => $id, 'text' => 'halo', 'text_norm' => 'halo',
            'posted_at' => $this->clock->subHour(), 'is_simulated' => false, 'created_at' => now(), 'updated_at' => now(),
        ]);

        $this->detect();

        $alert = $this->alertFor($id);
        $evidence = $alert->evidence()->where('reason', 'name_similarity')->sole();
        $this->assertSame($id, $evidence->account_id);
        $this->assertSame($postId, $evidence->post_id);
        $detail = $evidence->detail;
        $this->assertSame($this->official->id, $detail['official']['id']);
        $this->assertSame('@kodam_contoh', $detail['official']['handle']);
        $this->assertSame(1.0, (float) $detail['similarity']);
        $this->assertTrue($detail['same_name']);
        $this->assertSame('handle', $detail['field']);
        $this->assertSame('kodamcontoh', $detail['compared']['account']);
        $this->assertSame('kodamcontoh', $detail['compared']['official']);
        $this->assertSame(0.6, (float) $detail['thresholds']['impersonation_threshold']);
        $this->assertSame(1, $alert->evidence()->where('reason', 'young_account')->count());
        $this->assertEqualsWithDelta(2.0, $alert->evidence()->where('reason', 'young_account')->sole()->detail['account_age_days'], 0.1);
        $this->assertTrue($alert->window_start->equalTo($this->clock->subHours(2)));
        $this->assertTrue($alert->detected_at->equalTo($this->clock));
    }

    public function test_the_display_name_alone_can_give_it_away(): void
    {
        $id = $this->newAccount('@pusat_info_77', 'K0dam Contoh Resmi');

        $this->detect();

        $detail = $this->alertFor($id)->evidence->firstWhere('reason', 'name_similarity')->detail;
        $this->assertSame('display_name', $detail['field']);
    }

    public function test_running_twice_creates_no_duplicates_and_keeps_evidence_ids(): void
    {
        $this->newAccount('@kodam_c0ntoh', null, $this->clock->subDays(2));
        $this->newAccount('@kodamcontoh_official');

        $this->detect();
        $ids = AlertEvidence::orderBy('id')->pluck('id')->all();
        $second = $this->detect();

        $this->assertSame(2, Alert::count());
        $this->assertSame(2, $second['updated']);
        $this->assertSame(0, $second['created']);
        $this->assertSame($ids, AlertEvidence::orderBy('id')->pluck('id')->all());
    }

    public function test_the_closest_official_is_reported_and_the_others_kept_as_evidence(): void
    {
        $other = OfficialAccount::factory()->create(['handle' => '@kodam_contoh2', 'display_name' => 'Kodam Contoh Dua']);
        $id = $this->newAccount('@kodam_c0ntoh');

        $this->detect();

        $detail = $this->alertFor($id)->evidence->firstWhere('reason', 'name_similarity')->detail;
        $this->assertSame($this->official->id, $detail['official']['id']);
        $this->assertSame([$other->id], array_column($detail['other_matches'], 'official_id'));
        $this->assertSame('@kodam_contoh2', $detail['other_matches'][0]['handle']);
    }

    public function test_evidence_follows_a_change_of_the_closest_official_instead_of_going_stale(): void
    {
        $id = $this->newAccount('@kodam_c0ntoh_baru');
        $this->detect();
        $first = $this->alertFor($id)->evidence->firstWhere('reason', 'name_similarity')->detail['official']['id'];
        $this->assertSame($this->official->id, $first);

        $closer = OfficialAccount::factory()->create(['handle' => '@kodamc0ntohbaru', 'display_name' => 'Kodam Contoh Baru']);
        $this->detect();

        $rows = AlertEvidence::where('alert_id', $this->alertFor($id)->id)->where('reason', 'name_similarity')->get();
        $this->assertCount(1, $rows);
        $this->assertSame($closer->id, $rows->first()->detail['official']['id']);
    }

    public function test_young_account_evidence_goes_away_when_the_account_is_no_longer_young(): void
    {
        $id = $this->newAccount('@kodam_c0ntoh', null, $this->clock->subDays(29));
        $this->detect();
        $this->assertSame(1, AlertEvidence::where('reason', 'young_account')->count());

        $this->travelTo($this->clock->addDays(3));
        DB::table('accounts')->where('id', $id)->update(['first_seen_at' => $this->clock->addDays(3)->subHour()]);
        $this->detect();

        $this->assertSame(0, AlertEvidence::where('reason', 'young_account')->count());
        $this->assertSame(1, AlertEvidence::where('reason', 'name_similarity')->count());
    }

    public function test_thresholds_come_from_settings(): void
    {
        $this->newAccount('@kodam_c0ntoh');
        $this->setDetection(['impersonation_threshold' => 1.0]);
        $this->assertSame(1, $this->detect()['triggered']); // same name once normalized: similarity 1.0

        Alert::query()->delete();
        $this->newAccount('@kodam_cont');
        $this->setDetection(['impersonation_threshold' => 0.99]);
        $this->assertSame(1, $this->detect()['triggered']); // only the exact look-alike reaches 0.99
    }

    public function test_a_threshold_of_one_still_lets_the_prd_exception_stand(): void
    {
        $this->newAccount('@kodam_contoh');
        $this->setDetection(['impersonation_threshold' => 0.3]);

        $this->assertSame(0, $this->detect()['triggered']);
    }

    public function test_a_recently_resolved_alert_holds_back_a_new_one(): void
    {
        $id = $this->newAccount('@kodam_c0ntoh');
        $resolved = Alert::factory()->create(['kind' => 'impersonation', 'topic_id' => null, 'subject_account_id' => $id, 'status' => 'false_positive']);
        $resolved->forceFill(['closed_at' => now()->subMinutes(5)])->save();

        $stats = $this->detect();

        $this->assertSame(1, $stats['cooldown']);
        $this->assertSame(1, Alert::count());
    }

    public function test_an_open_alert_keeps_its_status_when_the_account_is_seen_again(): void
    {
        $id = $this->newAccount('@kodam_c0ntoh');
        $alert = Alert::factory()->status('escalated')->create(['kind' => 'impersonation', 'topic_id' => null, 'subject_account_id' => $id, 'score' => 3, 'severity' => 'low']);

        $this->detect();

        $this->assertSame(1, Alert::count());
        $alert->refresh();
        $this->assertSame('escalated', $alert->status);
        $this->assertGreaterThan(3, $alert->score);
        $this->assertSame(0, DB::table('alert_actions')->where('alert_id', $alert->id)->count());
    }

    public function test_without_official_accounts_nothing_happens(): void
    {
        OfficialAccount::query()->delete();
        $this->newAccount('@kodam_c0ntoh');

        $stats = $this->detect();

        $this->assertSame(0, $stats['officials']);
        $this->assertSame(0, $stats['triggered']);
        $this->assertSame(0, Alert::count());
    }

    public function test_with_no_new_accounts_nothing_happens(): void
    {
        $stats = $this->detect();

        $this->assertSame(0, $stats['accounts']);
        $this->assertSame(0, Alert::count());
    }

    public function test_names_too_short_to_compare_are_ignored(): void
    {
        OfficialAccount::factory()->create(['handle' => '@ab', 'display_name' => 'AB']);
        $this->newAccount('@ab_', 'a');
        $this->newAccount('@__', null);

        $stats = $this->detect();

        $this->assertSame(0, $stats['triggered']);
    }

    public function test_an_account_without_a_display_name_is_still_compared_by_handle(): void
    {
        $id = $this->newAccount('@kodam_c0ntoh', null);

        $this->detect();

        $this->assertNotNull($this->alertFor($id));
    }

    public function test_many_accounts_are_read_in_chunks_and_the_look_alikes_found(): void
    {
        for ($i = 0; $i < 450; $i++) {
            $this->newAccount('@warga_biasa_'.dechex($i * 7919), 'Warga '.dechex($i * 104729));
        }
        $needle = $this->newAccount('@kodam_c0ntoh');

        $stats = $this->detect();

        $this->assertSame(451, $stats['accounts']);
        $this->assertSame(1, $stats['triggered']);
        $this->assertNotNull($this->alertFor($needle));
    }

    public function test_many_official_accounts_are_read_in_chunks(): void
    {
        for ($i = 0; $i < 320; $i++) {
            OfficialAccount::factory()->create(['handle' => '@resmi_'.dechex($i * 7919), 'display_name' => 'Resmi '.dechex($i * 104729)]);
        }
        $id = $this->newAccount('@kodam_c0ntoh');

        $this->detect();

        $this->assertSame($this->official->id, $this->alertFor($id)->evidence->firstWhere('reason', 'name_similarity')->detail['official']['id']);
    }

    public function test_detection_follows_the_data_clock_not_the_wall_clock(): void
    {
        $id = $this->newAccount('@kodam_c0ntoh', null, null, $this->clock->subHours(2));
        $this->travelTo($this->clock->addDays(30)); // wall clock far away: the account would be out of the window
        Setting::whereKey('replay.clock')->update(['value' => json_encode(['now' => $this->clock->toIso8601String()])]);

        $this->assertSame(1, $this->detect()['created']);
        $this->assertTrue($this->alertFor($id)->detected_at->equalTo($this->clock));
    }

    public function test_one_failing_account_does_not_stop_the_others_and_is_counted(): void
    {
        $this->newAccount('@kodam_c0ntoh');
        $this->newAccount('@kodam_c0ntoh_dua');
        $writer = $this->mock(AlertWriter::class);
        $writer->shouldReceive('upsertImpersonation')->once()->andThrow(new RuntimeException('boom'));
        $writer->shouldReceive('upsertImpersonation')->once()->andReturn(['outcome' => 'created', 'alert_id' => 1, 'evidence_added' => 0]);

        $stats = $this->detect();

        $this->assertSame(2, $stats['triggered']);
        $this->assertSame(1, $stats['failed']);
        $this->assertSame(1, $stats['created']);
    }

    public function test_the_job_runs_both_detectors_and_fails_when_an_account_failed(): void
    {
        $this->newAccount('@kodam_c0ntoh');
        (new DetectJob)->handle(app(IssueDetectionService::class), app(ImpersonationDetectionService::class));
        $this->assertSame(1, Alert::where('kind', 'impersonation')->count());

        $this->newAccount('@kodam_c0ntoh_tiga');
        $this->mock(AlertWriter::class)->shouldReceive('upsertImpersonation')->andThrow(new RuntimeException('boom'));
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Detection failed for 2 subject(s).');
        (new DetectJob)->handle(app(IssueDetectionService::class), app(ImpersonationDetectionService::class));
    }

    public function test_an_account_judged_clean_is_not_compared_again(): void
    {
        $this->newAccount('@budi_santoso', 'Orang Biasa');
        $this->newAccount('@warga_peduli', 'Orang Biasa');

        $first = $this->detect();
        $second = $this->detect();

        $this->assertSame(2, $first['evaluated']);
        $this->assertSame(0, $second['evaluated']);
        $this->assertSame(2, $second['accounts']); // still read, just not compared
    }

    public function test_look_alikes_are_never_cached_and_are_refreshed_every_pass(): void
    {
        $id = $this->newAccount('@kodam_c0ntoh', null, $this->clock->subDays(2));

        $this->detect();
        $second = $this->detect();

        $this->assertSame(1, $second['evaluated']);
        $this->assertSame(1, $second['updated']);
        $this->assertNotNull($this->alertFor($id));
    }

    public function test_a_new_official_account_re_examines_accounts_that_were_clean(): void
    {
        $id = $this->newAccount('@pusat_info_resmi', 'Info Pusat');
        $this->assertSame(0, $this->detect()['triggered']);

        OfficialAccount::factory()->create(['handle' => '@pusat_info', 'display_name' => 'Pusat Info']);
        $stats = $this->detect();

        $this->assertSame(1, $stats['evaluated']);
        $this->assertSame(1, $stats['triggered']);
        $this->assertNotNull($this->alertFor($id));
    }

    public function test_changing_the_threshold_re_examines_accounts_that_were_clean(): void
    {
        $this->newAccount('@kodam_cont');
        $this->setDetection(['impersonation_threshold' => 0.99]);
        $this->assertSame(0, $this->detect()['triggered']);

        $this->setDetection(['impersonation_threshold' => 0.5]);
        $stats = $this->detect();

        $this->assertSame(1, $stats['evaluated']);
        $this->assertSame(1, $stats['triggered']);
    }

    public function test_extending_the_mapping_tables_re_examines_accounts_that_were_clean(): void
    {
        $id = $this->newAccount('@kodam_contoh_palsu');
        $this->setDetection(['impersonation_threshold' => 0.9]);
        $this->assertSame(0, $this->detect()['triggered']);

        config(['impersonation.affixes' => [...config('impersonation.affixes'), 'palsu']]);
        $stats = $this->detect();

        $this->assertSame(1, $stats['evaluated']);
        $this->assertSame(1, $stats['triggered']);
        $this->assertNotNull($this->alertFor($id));
    }

    public function test_the_detect_command_raises_impersonation_alerts_too(): void
    {
        $id = $this->newAccount('@kodam_c0ntoh');

        $this->artisan('radarisu:detect --sync')->assertSuccessful();

        $this->assertNotNull($this->alertFor($id));
    }

    /** @param array<string, mixed> $changes */
    private function setDetection(array $changes): void
    {
        Setting::whereKey('detection')->update(['value' => json_encode([...Setting::detection(), ...$changes])]);
    }
}
