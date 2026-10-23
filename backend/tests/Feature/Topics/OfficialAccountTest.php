<?php

namespace Tests\Feature\Topics;

use App\Models\AuditLog;
use App\Models\OfficialAccount;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * PRD §9.3, §11 /official-accounts (F2): the list the impersonation detector compares with.
 */
class OfficialAccountTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function payload(array $overrides = []): array
    {
        return $overrides + ['handle' => '@kodam_resmi', 'display_name' => 'Kodam Resmi', 'note' => 'Akun resmi satuan'];
    }

    private function account(string $handle, string $name = 'Nama'): OfficialAccount
    {
        return OfficialAccount::create(['handle' => $handle, 'display_name' => $name, 'created_by' => $this->userWithRole('analyst')->id]);
    }

    public function test_analyst_and_leader_list_accounts_ordered_by_handle(): void
    {
        $this->account('@b_akun');
        $this->account('@a_akun');

        foreach (['analyst', 'leader'] as $role) {
            $this->actingAsRole($role);
            $this->getJson('/api/v1/official-accounts')
                ->assertOk()
                ->assertJsonStructure(['data' => [['id', 'handle', 'display_name', 'note']]])
                ->assertJsonPath('data.0.handle', '@a_akun')
                ->assertJsonPath('data.1.handle', '@b_akun');
            $this->resetAuth();
        }
    }

    public function test_analyst_adds_an_account_which_is_audited(): void
    {
        $analyst = $this->actingAsRole('analyst');

        $response = $this->postJson('/api/v1/official-accounts', $this->payload())
            ->assertCreated()
            ->assertJsonPath('data.handle', '@kodam_resmi')
            ->assertJsonPath('data.display_name', 'Kodam Resmi')
            ->assertJsonPath('data.note', 'Akun resmi satuan');

        $account = OfficialAccount::findOrFail($response->json('data.id'));
        $this->assertSame($analyst->id, $account->created_by);
        $log = AuditLog::where('action', 'official_account.create')->sole();
        $this->assertSame($account->id, $log->object_id);
        $this->assertSame('@kodam_resmi', $log->detail['handle']);
    }

    public function test_note_is_optional(): void
    {
        $this->actingAsRole('analyst');

        $this->postJson('/api/v1/official-accounts', ['handle' => '@x', 'display_name' => 'X'])
            ->assertCreated()
            ->assertJsonPath('data.note', null);
    }

    /**
     * @return array<string, array{array<string, mixed>, string}>
     */
    public static function invalidPayloads(): array
    {
        return [
            'missing handle' => [['handle' => null], 'handle'],
            'handle too long' => [['handle' => str_repeat('a', 191)], 'handle'],
            'missing display name' => [['display_name' => null], 'display_name'],
            'display name too long' => [['display_name' => str_repeat('a', 191)], 'display_name'],
            'note too long' => [['note' => str_repeat('a', 256)], 'note'],
        ];
    }

    /**
     * @param  array<string, mixed>  $changes
     */
    #[DataProvider('invalidPayloads')]
    public function test_invalid_input_is_rejected(array $changes, string $field): void
    {
        $this->actingAsRole('analyst');

        $this->postJson('/api/v1/official-accounts', $this->payload($changes))->assertUnprocessable()->assertJsonValidationErrors([$field]);

        $this->assertSame(0, OfficialAccount::count());
    }

    public function test_a_handle_can_be_added_only_once(): void
    {
        $this->actingAsRole('analyst');
        $this->account('@kodam_resmi');

        $this->postJson('/api/v1/official-accounts', $this->payload())->assertUnprocessable()->assertJsonValidationErrors(['handle']);

        $this->assertSame(1, OfficialAccount::count());
    }

    public function test_analyst_removes_an_account_which_is_audited(): void
    {
        $this->actingAsRole('analyst');
        $account = $this->account('@kodam_resmi');

        $this->deleteJson("/api/v1/official-accounts/{$account->id}")->assertNoContent();

        $this->assertSame(0, OfficialAccount::count());
        $log = AuditLog::where('action', 'official_account.delete')->sole();
        $this->assertSame($account->id, $log->object_id);
        $this->assertSame('@kodam_resmi', $log->detail['handle']);
    }

    public function test_removing_an_unknown_account_is_not_found(): void
    {
        $this->actingAsRole('analyst');

        $this->deleteJson('/api/v1/official-accounts/999999')->assertNotFound();
    }

    public function test_leader_can_read_but_not_change_the_list(): void
    {
        $account = $this->account('@kodam_resmi');
        $this->actingAsRole('leader');

        $this->getJson('/api/v1/official-accounts')->assertOk();
        $this->postJson('/api/v1/official-accounts', $this->payload(['handle' => '@lain']))->assertForbidden();
        $this->deleteJson("/api/v1/official-accounts/{$account->id}")->assertForbidden();
        $this->assertSame(1, OfficialAccount::count());
    }

    public function test_admin_has_no_access(): void
    {
        $account = $this->account('@kodam_resmi');
        $this->actingAsRole('admin');

        $this->getJson('/api/v1/official-accounts')->assertForbidden();
        $this->postJson('/api/v1/official-accounts', $this->payload(['handle' => '@lain']))->assertForbidden();
        $this->deleteJson("/api/v1/official-accounts/{$account->id}")->assertForbidden();
    }
}
