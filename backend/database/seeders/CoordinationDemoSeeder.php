<?php

namespace Database\Seeders;

use App\Models\Source;
use App\Models\Topic;
use App\Models\User;
use App\Services\Detection\MetricsAggregator;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Demo scenario for F4 (coordination detection). It is NOT part of DatabaseSeeder: run it on purpose,
 *
 *   php artisan db:seed --class=CoordinationDemoSeeder
 *   php artisan radarisu:detect --sync
 *
 * One simulated topic gets 72 hours of quiet, varied organic chatter, then in the last 10 minutes 40
 * accounts post the same message with a different code at the end (30 of them created days ago, 10 older)
 * between 15 unrelated organic posts. With the default settings that is one coordinated cluster of 40
 * accounts: `similar_text` for all 40, `young_account` for 30, and `synchronized_posting` for the accounts
 * inside the densest 5 minutes of the burst (about 34). The burst is also far above the topic's normal volume, so the spike
 * detector fires on the same alert. Timestamps are relative to the moment it runs; run it again to refresh
 * a demo that has gone stale (it replaces its own data).
 */
class CoordinationDemoSeeder extends Seeder
{
    public const TOPIC_NAME = 'Demo: koordinasi akun (simulasi)';

    public const SOURCE_NAME = 'Demo koordinasi (simulasi)';

    public const CAMPAIGN_ACCOUNTS = 40;

    public const YOUNG_ACCOUNTS = 30;

    private const ORGANIC_ACCOUNTS = 15;

    private const HISTORY_HOURS = 72;

    private const CAMPAIGN = 'Waspada! Ada kabar penting soal layanan satuan kami, segera ikuti tautan resmi dan bagikan ke grup keluarga kalian, kode ';

    /** Word pools for the organic posts, so none of them resembles another. */
    private const POOLS = [
        ['warga', 'pengguna', 'pelanggan', 'peserta', 'relawan', 'pegawai'],
        ['menanyakan', 'membahas', 'menceritakan', 'mengomentari', 'menyebut', 'membagikan'],
        ['jadwal', 'layanan', 'antrean', 'loket', 'formulir', 'pengumuman'],
        ['kemarin', 'pagi tadi', 'minggu ini', 'siang ini', 'semalam', 'barusan'],
    ];

    public function run(MetricsAggregator $aggregator): void
    {
        $admin = User::whereHas('role', fn ($q) => $q->where('slug', 'admin'))->first()
            ?? throw new RuntimeException('Run DatabaseSeeder first: the demo needs the admin user.');

        DB::transaction(function () use ($admin, $aggregator) {
            $this->clear();

            $source = Source::create([
                'type' => 'csv', 'name' => self::SOURCE_NAME, 'config' => [], 'is_active' => true,
                'is_simulated' => true, 'last_status' => 'never', 'created_by' => $admin->id,
            ]);
            $topic = Topic::create([
                'name' => self::TOPIC_NAME, 'category' => 'general', 'keywords' => ['demo koordinasi'],
                'sensitivity' => 'medium', 'is_template' => false, 'is_active' => true, 'created_by' => $admin->id,
            ]);

            $now = CarbonImmutable::now('UTC');
            $campaign = $this->accounts('demo_koordinasi', self::CAMPAIGN_ACCOUNTS, fn (int $i) => $i <= self::YOUNG_ACCOUNTS
                ? $now->subDays(2 + $i % 10) : $now->subYear());
            $organic = $this->accounts('demo_organik', self::ORGANIC_ACCOUNTS, fn () => $now->subYears(2));

            $this->insertPosts($source, $topic, $this->history($now, $organic));
            $this->insertPosts($source, $topic, $this->burst($now, $campaign, $organic));
            $aggregator->rebuildTopic($topic->id);
        });

        $this->command?->info('Coordination demo ready. Run: php artisan radarisu:detect --sync');
    }

    private function clear(): void
    {
        $source = Source::where('name', self::SOURCE_NAME)->first();
        $topic = Topic::where('name', self::TOPIC_NAME)->first();

        if ($topic !== null) {
            $alertIds = DB::table('alerts')->where('topic_id', $topic->id)->pluck('id');
            if (DB::table('alert_actions')->whereIn('alert_id', $alertIds)->exists()) {
                throw new RuntimeException('The demo topic has triaged alerts (alert_actions is append-only). Use migrate:fresh --seed to reset.');
            }
            DB::table('alert_evidence')->whereIn('alert_id', $alertIds)->delete();
            DB::table('briefings')->whereIn('alert_id', $alertIds)->delete();
            DB::table('alerts')->whereIn('id', $alertIds)->delete();
            DB::table('metrics_hourly')->where('topic_id', $topic->id)->delete();
            DB::table('topic_matches')->where('topic_id', $topic->id)->delete();
            $topic->delete();
        }
        if ($source !== null) {
            DB::table('posts')->where('source_id', $source->id)->delete();
            $source->delete();
        }
    }

    /**
     * Accounts that keep their identity between runs but get fresh ages.
     *
     * @param  callable(int): CarbonImmutable  $createdAt
     * @return list<int>
     */
    private function accounts(string $prefix, int $count, callable $createdAt): array
    {
        $stamp = now()->utc()->format('Y-m-d H:i:s').'+00';
        $rows = [];
        for ($i = 1; $i <= $count; $i++) {
            $created = $createdAt($i)->utc()->format('Y-m-d H:i:s').'+00';
            $rows[] = [
                'source_type' => 'csv', 'handle' => "@{$prefix}_{$i}", 'display_name' => "Akun {$prefix} {$i}",
                'platform_created_at' => $created, 'first_seen_at' => $created, 'created_at' => $stamp, 'updated_at' => $stamp,
            ];
        }
        DB::table('accounts')->upsert($rows, ['source_type', 'handle'], ['display_name', 'platform_created_at', 'first_seen_at', 'updated_at']);

        return DB::table('accounts')->where('handle', 'like', "@{$prefix}\\_%")->orderBy('id')->pluck('id')->all();
    }

    /**
     * @param  list<int>  $organic
     * @return list<array{at: CarbonImmutable, account_id: int, sentiment: string, text: string}>
     */
    private function history(CarbonImmutable $now, array $organic): array
    {
        $posts = [];
        for ($h = self::HISTORY_HOURS; $h >= 1; $h--) {
            $start = $now->startOfHour()->subHours($h);
            $count = 3 + ($h * 7) % 4; // 3..6, deterministic
            for ($i = 0; $i < $count; $i++) {
                $posts[] = [
                    'at' => $start->addMinutes(($i * 53 + $h * 11) % 60),
                    'account_id' => $organic[($h + $i) % count($organic)],
                    'sentiment' => $i % 3 === 0 ? 'negative' : 'neutral',
                    'text' => $this->sentence($h * 10 + $i),
                ];
            }
        }

        return $posts;
    }

    /**
     * @param  list<int>  $campaign
     * @param  list<int>  $organic
     * @return list<array{at: CarbonImmutable, account_id: int, sentiment: string, text: string}>
     */
    private function burst(CarbonImmutable $now, array $campaign, array $organic): array
    {
        $posts = [];
        foreach ($campaign as $i => $accountId) {
            $posts[] = [
                'at' => $now->subMinutes(9)->addSeconds($i * 9), // 40 posts in 6 minutes
                'account_id' => $accountId,
                'sentiment' => 'negative',
                'text' => self::CAMPAIGN.strtoupper(dechex(4096 + $i * 37)),
            ];
        }
        foreach ($organic as $i => $accountId) {
            $posts[] = [
                'at' => $now->subMinutes(12)->addSeconds($i * 40),
                'account_id' => $accountId,
                'sentiment' => 'neutral',
                'text' => $this->sentence(900 + $i * 13),
            ];
        }

        return $posts;
    }

    private function sentence(int $n): string
    {
        $words = [];
        foreach (self::POOLS as $k => $pool) {
            $words[] = $pool[($n * (2 * $k + 3) + $k * 5) % count($pool)];
        }

        return implode(' ', $words).' '.dechex($n * 2654435761 % 4294967296);
    }

    /**
     * @param  list<array{at: CarbonImmutable, account_id: int, sentiment: string, text: string}>  $posts
     */
    private function insertPosts(Source $source, Topic $topic, array $posts): void
    {
        $stamp = now()->utc()->format('Y-m-d H:i:s').'+00';
        $keyBase = 'demo-coord-'.bin2hex(random_bytes(4));

        foreach (array_chunk($posts, 500, true) as $chunk) {
            $rows = [];
            $keys = [];
            foreach ($chunk as $n => $post) {
                $key = "{$keyBase}-{$n}-".$post['at']->getTimestamp();
                $keys[] = $key;
                $rows[] = [
                    'source_id' => $source->id, 'account_id' => $post['account_id'], 'external_id' => $key,
                    'text' => $post['text'], 'text_norm' => mb_strtolower($post['text']),
                    'posted_at' => $post['at']->utc()->format('Y-m-d H:i:s').'+00', 'sentiment' => $post['sentiment'],
                    'is_simulated' => true, 'created_at' => $stamp, 'updated_at' => $stamp,
                ];
            }
            DB::table('posts')->insert($rows);
            $ids = DB::table('posts')->where('source_id', $source->id)->whereIn('external_id', $keys)->pluck('id');
            DB::table('topic_matches')->insertOrIgnore($ids->map(fn ($id) => ['post_id' => $id, 'topic_id' => $topic->id])->all());
        }
    }
}
