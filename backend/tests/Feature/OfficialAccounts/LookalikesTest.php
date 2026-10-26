<?php

namespace Tests\Feature\OfficialAccounts;

use App\Models\Alert;
use App\Models\OfficialAccount;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Concerns\BuildsDetectionData;
use Tests\TestCase;

/**
 * GET /official-accounts/lookalikes (F13): accounts that look like an official one. Analysts only.
 */
class LookalikesTest extends TestCase
{
    use BuildsDetectionData;
    use RefreshDatabase;

    protected bool $seed = true;

    private const URL = '/api/v1/official-accounts/lookalikes';

    private CarbonImmutable $clock;

    private OfficialAccount $official;

    protected function setUp(): void
    {
        parent::setUp();
        $this->clock = CarbonImmutable::parse('2026-10-26 12:30:00', 'UTC');
        $this->travelTo($this->clock);
        $this->official = OfficialAccount::factory()->create(['handle' => '@kodam_contoh', 'display_name' => 'Kodam Contoh']);
    }

    private function newAccount(string $handle, ?string $display = null, ?CarbonImmutable $createdAt = null): int
    {
        return $this->makeAccount($handle, $display, $this->clock->subHours(2), $createdAt);
    }

    public function test_analyst_sees_the_look_alikes_with_the_official_account_and_the_rules(): void
    {
        $id = $this->newAccount('@kodam_c0ntoh_official', 'Kodam Contoh Resmi', $this->clock->subDays(3));
        $this->newAccount('@budi_santoso', 'Budi');
        $this->actingAsRole('analyst');

        $response = $this->getJson(self::URL)
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('meta.current_page', 1)
            ->assertJsonPath('meta.last_page', 1)
            ->assertJsonPath('meta.per_page', 25)
            ->assertJsonPath('meta.officials_count', 1)
            ->assertJsonPath('meta.as_of', '2026-10-26T12:30:00Z');

        $row = $response->json('data.0');
        $this->assertSame($id, $row['account']['id']);
        $this->assertSame('@kodam_c0ntoh_official', $row['account']['handle']);
        $this->assertSame($this->official->id, $row['official']['id']);
        $this->assertSame('@kodam_contoh', $row['official']['handle']);
        $this->assertGreaterThanOrEqual(0.6, $row['similarity']);
        $this->assertTrue($row['young']);
        $this->assertEqualsWithDelta(3.0, $row['age_days'], 0.1);
        $this->assertContains('affix_stripped', array_column($row['rules'], 'rule'));
        $this->assertNull($row['alert']);
        $this->assertSame('2026-10-26T10:30:00Z', $row['account']['first_seen_at']);
    }

    public function test_it_is_read_only_and_does_not_open_alerts(): void
    {
        $this->newAccount('@kodam_c0ntoh');
        $this->actingAsRole('analyst');

        $this->getJson(self::URL)->assertOk();

        $this->assertSame(0, Alert::count());
        $this->assertSame(0, DB::table('alert_evidence')->count());
    }

    public function test_it_shows_the_open_alert_of_an_account_once_there_is_one(): void
    {
        $id = $this->newAccount('@kodam_c0ntoh');
        $this->artisan('radarisu:detect --sync')->assertSuccessful();
        $alert = Alert::where('subject_account_id', $id)->sole();
        $this->actingAsRole('analyst');

        $this->getJson(self::URL)->assertOk()->assertJsonPath('data.0.alert', ['id' => $alert->id, 'status' => 'new']);
    }

    public function test_the_official_accounts_themselves_are_not_listed(): void
    {
        $this->newAccount('@kodam_contoh', 'Kodam Contoh');
        $this->actingAsRole('analyst');

        $this->getJson(self::URL)->assertOk()->assertJsonPath('meta.total', 0)->assertJsonPath('data', []);
    }

    public function test_the_list_is_paginated_closest_first(): void
    {
        $exact = $this->newAccount('@kodam.contoh');            // 1.0
        $near = $this->newAccount('@kodam_contoh_baru');        // lower
        $nearer = $this->newAccount('@kodam_contoh_x');
        $this->actingAsRole('analyst');

        $first = $this->getJson(self::URL.'?per_page=2')->assertOk()->assertJsonPath('meta.total', 3)->assertJsonPath('meta.last_page', 2)->assertJsonCount(2, 'data');
        $second = $this->getJson(self::URL.'?per_page=2&page=2')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('meta.current_page', 2);

        $this->assertSame($exact, $first->json('data.0.account.id'));
        $similarities = array_merge(array_column($first->json('data'), 'similarity'), array_column($second->json('data'), 'similarity'));
        $sorted = $similarities;
        rsort($sorted);
        $this->assertSame($sorted, $similarities);
        $this->assertEqualsCanonicalizing([$exact, $near, $nearer], array_merge(array_column(array_column($first->json('data'), 'account'), 'id'), array_column(array_column($second->json('data'), 'account'), 'id')));
    }

    public function test_a_page_past_the_end_returns_the_last_page_meta_and_no_rows(): void
    {
        $this->newAccount('@kodam_c0ntoh');
        $this->actingAsRole('analyst');

        $this->getJson(self::URL.'?page=9')->assertOk()->assertJsonPath('data', [])->assertJsonPath('meta.current_page', 1)->assertJsonPath('meta.total', 1);
    }

    public function test_it_can_be_limited_to_one_official_account(): void
    {
        $other = OfficialAccount::factory()->create(['handle' => '@humas_batalyon', 'display_name' => 'Humas Batalyon']);
        $this->newAccount('@kodam_c0ntoh');
        $this->newAccount('@humas_batalyon_official');
        $this->actingAsRole('analyst');

        $this->getJson(self::URL.'?official_account_id='.$other->id)->assertOk()
            ->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.official.id', $other->id);
    }

    public function test_an_empty_system_is_not_an_error(): void
    {
        OfficialAccount::query()->delete();
        $this->actingAsRole('analyst');

        $this->getJson(self::URL)->assertOk()->assertJsonPath('data', [])->assertJsonPath('meta.officials_count', 0);
    }

    public function test_leader_and_admin_are_forbidden_and_guests_unauthorized(): void
    {
        $this->newAccount('@kodam_c0ntoh');

        $this->getJson(self::URL)->assertUnauthorized();

        foreach (['leader', 'admin'] as $role) {
            $this->actingAsRole($role);
            $this->getJson(self::URL)->assertForbidden();
            $this->resetAuth();
        }
    }

    /**
     * @return array<string, array{string}>
     */
    public static function invalidQueries(): array
    {
        return [
            'page zero' => ['?page=0'],
            'page not a number' => ['?page=abc'],
            'per page zero' => ['?per_page=0'],
            'per page too large' => ['?per_page=101'],
            'unknown official' => ['?official_account_id=999999'],
            'official not a number' => ['?official_account_id=abc'],
            'array' => ['?per_page[]=5'],
        ];
    }

    #[DataProvider('invalidQueries')]
    public function test_invalid_queries_are_rejected(string $query): void
    {
        $this->actingAsRole('analyst');

        $this->getJson(self::URL.$query)->assertUnprocessable();
    }

    public function test_it_does_not_break_the_existing_official_account_routes(): void
    {
        $this->actingAsRole('analyst');

        $this->getJson('/api/v1/official-accounts')->assertOk()->assertJsonCount(1, 'data');
    }
}
