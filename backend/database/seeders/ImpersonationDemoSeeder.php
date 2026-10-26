<?php

namespace Database\Seeders;

use App\Models\Source;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Demo scenario for F13 (impersonation detection). It is NOT part of DatabaseSeeder: run it on purpose,
 *
 *   php artisan db:seed --class=ImpersonationDemoSeeder
 *   php artisan radarisu:detect --sync
 *
 * Two fictional official accounts ("Demo Kodam Contoh" and its press office) and, first seen in the last
 * three hours, ten accounts that copy them in the ways the detector knows: a 0 for an o, dropped
 * separators, a decorated suffix, a Cyrillic letter, rn for m, trailing digits, and one that only copies
 * the display name. Next to them sit accounts that must NOT be flagged: ordinary users, a look-alike first
 * seen five days ago (outside the window), and the official accounts' own rows. Timestamps are relative
 * to the moment it runs; run it again to refresh a demo that has gone stale (it replaces its own data).
 */
class ImpersonationDemoSeeder extends Seeder
{
    public const SOURCE_NAME = 'Demo peniruan (simulasi)';

    /** handle => display name */
    public const OFFICIALS = [
        '@demo_kodam' => 'Demo Kodam Contoh',
        '@demo_humas_kodam' => 'Demo Humas Kodam Contoh',
    ];

    /** @var array<string, array{0: string|null, 1: int|null}> handle => [display name, age in days when seen (null = unknown)] */
    public const IMPERSONATORS = [
        '@demo_kodam_official' => ['Demo Kodam Contoh', 3],        // affix "official"
        '@demo_k0dam' => ['Info Kodam', 2],                        // 0 for o
        '@demo.kodam' => ['Kodam Demo', 400],                      // separators, old account
        '@demo_kodam_id' => [null, 5],                             // affix "id"
        '@demo_kodarn' => ['Demo Kodarn Contoh', 1],               // rn for m
        '@dеmo_kodam' => ['Demo Kodam', 6],                        // Cyrillic е in "demo"
        '@demo_kodam2024' => ['Demo Kodam Contoh', null],          // trailing digits, age unknown
        '@demo_humas_kodam_resmi' => ['Humas Kodam', 2],           // affix "resmi", press-office copy
        '@demo_hum4s_kodam' => ['Demo Humas', 9],                  // 4 for a
        '@pusat_informasi_77' => ['Dem0 K0dam C0ntoh', 4],         // only the display name copies
    ];

    /** @var array<string, string|null> handle => display name; none of these may be flagged */
    public const DECOYS = [
        '@warga_biasa_1' => 'Budi Santoso',
        '@warga_biasa_2' => 'Siti Rahma',
        '@berita_harian' => 'Berita Harian',
        '@kopi_pagi_kita' => null,
        '@relawan_banjir' => 'Relawan Banjir',
    ];

    public const OLD_LOOKALIKE = '@demo_kodam_asli';

    public function run(): void
    {
        $admin = User::whereHas('role', fn ($q) => $q->where('slug', 'admin'))->first()
            ?? throw new RuntimeException('Run DatabaseSeeder first: the demo needs the admin user.');

        DB::transaction(function () use ($admin) {
            $this->clear();

            $source = Source::create([
                'type' => 'csv', 'name' => self::SOURCE_NAME, 'config' => [], 'is_active' => true,
                'is_simulated' => true, 'last_status' => 'never', 'created_by' => $admin->id,
            ]);

            $stamp = now()->utc()->format('Y-m-d H:i:s').'+00';
            foreach (self::OFFICIALS as $handle => $name) {
                DB::table('official_accounts')->insert([
                    'handle' => $handle, 'display_name' => $name, 'note' => 'Akun demo (simulasi)',
                    'created_by' => $admin->id, 'created_at' => $stamp, 'updated_at' => $stamp,
                ]);
            }

            $now = CarbonImmutable::now('UTC');
            $n = 0;
            // The official accounts also exist as rows of `accounts`, seen inside the window: never flagged.
            foreach (self::OFFICIALS as $handle => $name) {
                $this->account($source, $handle, $name, $now->subYears(3), $now->subHours(2), $n++);
            }
            foreach (self::IMPERSONATORS as $handle => [$name, $ageDays]) {
                $created = $ageDays === null ? null : $now->subDays($ageDays);
                $this->account($source, $handle, $name, $created, $now->subMinutes(20 + 15 * $n), $n++);
            }
            foreach (self::DECOYS as $handle => $name) {
                $this->account($source, $handle, $name, $now->subMonths(8), $now->subMinutes(30 + 10 * $n), $n++);
            }
            $this->account($source, self::OLD_LOOKALIKE, 'Demo Kodam Contoh', $now->subDays(2), $now->subDays(5), $n++);
        });

        $this->command?->info('Impersonation demo ready. Run: php artisan radarisu:detect --sync');
    }

    /** Handles this seeder owns, so a rerun replaces exactly its own data. */
    private function handles(): array
    {
        return [...array_keys(self::OFFICIALS), ...array_keys(self::IMPERSONATORS), ...array_keys(self::DECOYS), self::OLD_LOOKALIKE];
    }

    private function clear(): void
    {
        $accountIds = DB::table('accounts')->whereIn('handle', $this->handles())->pluck('id');
        $alertIds = DB::table('alerts')->whereIn('subject_account_id', $accountIds)->pluck('id');

        if (DB::table('alert_actions')->whereIn('alert_id', $alertIds)->exists()) {
            throw new RuntimeException('The demo has triaged alerts (alert_actions is append-only). Use migrate:fresh --seed to reset.');
        }

        DB::table('alert_evidence')->whereIn('alert_id', $alertIds)->delete();
        DB::table('briefings')->whereIn('alert_id', $alertIds)->delete();
        DB::table('alerts')->whereIn('id', $alertIds)->delete();
        DB::table('posts')->whereIn('account_id', $accountIds)->delete();
        DB::table('accounts')->whereIn('id', $accountIds)->delete();
        DB::table('official_accounts')->whereIn('handle', array_keys(self::OFFICIALS))->delete();
        Source::where('name', self::SOURCE_NAME)->delete();
    }

    private function account(Source $source, string $handle, ?string $name, ?CarbonImmutable $createdAt, CarbonImmutable $firstSeen, int $n): void
    {
        $stamp = now()->utc()->format('Y-m-d H:i:s').'+00';
        $format = fn (?CarbonImmutable $at) => $at?->utc()->format('Y-m-d H:i:s').'+00';

        $accountId = DB::table('accounts')->insertGetId([
            'source_type' => 'csv', 'handle' => $handle, 'display_name' => $name,
            'platform_created_at' => $createdAt === null ? null : $format($createdAt), 'first_seen_at' => $format($firstSeen),
            'created_at' => $stamp, 'updated_at' => $stamp,
        ]);

        // One post each, so the evidence has something to show.
        $text = 'Demo peniruan: kabar nomor '.dechex(($n + 1) * 2654435761 % 4294967296).' dari akun ini.';
        DB::table('posts')->insert([
            'source_id' => $source->id, 'account_id' => $accountId, 'external_id' => 'demo-peniruan-'.bin2hex(random_bytes(4)).'-'.$n,
            'text' => $text, 'text_norm' => mb_strtolower($text), 'posted_at' => $format($firstSeen),
            'sentiment' => 'neutral', 'is_simulated' => true, 'created_at' => $stamp, 'updated_at' => $stamp,
        ]);
    }
}
