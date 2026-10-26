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
 * Demo scenario for F3 (spike detection). It is NOT part of DatabaseSeeder: run it on purpose,
 *
 *   php artisan db:seed --class=SpikeDemoSeeder
 *   php artisan radarisu:detect --sync
 *
 * It builds 72 hours of quiet history (4-8 posts/hour) for one simulated topic, then 90 posts from 30
 * accounts in the last 25 minutes, mostly negative. With the default settings that is far past the
 * threshold, so the detector always raises an alert. Timestamps are relative to the moment it runs;
 * run it again to refresh a demo that has gone stale (it replaces its own data).
 */
class SpikeDemoSeeder extends Seeder
{
    public const TOPIC_NAME = 'Demo: lonjakan isu (simulasi)';

    public const SOURCE_NAME = 'Demo lonjakan (simulasi)';

    private const ACCOUNTS = 30;

    private const HISTORY_HOURS = 72;

    private const SPIKE_POSTS = 90;

    /** Word pools, so each demo post reads differently: this demo is a spike, not a coordinated campaign. */
    private const CALM = [
        ['warga', 'pengguna', 'pelanggan', 'peserta', 'relawan', 'pegawai'],
        ['menanyakan', 'membahas', 'menceritakan', 'mengomentari', 'menyebut', 'membagikan'],
        ['jadwal', 'layanan', 'antrean', 'loket', 'formulir', 'pengumuman'],
        ['kemarin', 'pagi tadi', 'minggu ini', 'siang ini', 'semalam', 'barusan'],
    ];

    private const HOT = [
        ['kabar', 'isu', 'berita', 'cerita', 'info', 'desas-desus'],
        ['mengejutkan', 'meresahkan', 'menghebohkan', 'mencurigakan', 'mengganggu', 'memprihatinkan'],
        ['soal', 'tentang', 'terkait', 'mengenai', 'seputar', 'perihal'],
        ['anggaran', 'perizinan', 'pengadaan', 'mutasi', 'tender', 'proyek'],
        ['dibicarakan', 'dipertanyakan', 'diperdebatkan', 'disorot', 'digugat', 'diviralkan'],
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
                'name' => self::TOPIC_NAME, 'category' => 'general', 'keywords' => ['demo lonjakan'],
                'sensitivity' => 'medium', 'is_template' => false, 'is_active' => true, 'created_by' => $admin->id,
            ]);
            $accounts = $this->accounts();

            $now = CarbonImmutable::now('UTC');
            $this->insertPosts($source, $topic, $accounts, $this->history($now, $accounts));
            $this->insertPosts($source, $topic, $accounts, $this->spike($now, $accounts));
            $aggregator->rebuildTopic($topic->id);
        });

        $this->command?->info('Spike demo ready. Run: php artisan radarisu:detect --sync');
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
     * @return list<int>
     */
    private function accounts(): array
    {
        $now = now()->utc()->format('Y-m-d H:i:s').'+00';
        $created = now()->utc()->subYears(2)->format('Y-m-d H:i:s').'+00';
        $rows = [];
        for ($i = 1; $i <= self::ACCOUNTS; $i++) {
            $rows[] = [
                'source_type' => 'csv', 'handle' => "@demo_spike_{$i}", 'display_name' => "Akun Demo {$i}",
                'platform_created_at' => $created, 'first_seen_at' => $created, 'created_at' => $now, 'updated_at' => $now,
            ];
        }
        DB::table('accounts')->insertOrIgnore($rows);

        return DB::table('accounts')->where('handle', 'like', '@demo\_spike\_%')->orderBy('id')->pluck('id')->all();
    }

    /**
     * @param  list<int>  $accounts
     * @return list<array{at: CarbonImmutable, account_id: int, sentiment: string, text: string}>
     */
    private function history(CarbonImmutable $now, array $accounts): array
    {
        $posts = [];
        for ($h = self::HISTORY_HOURS; $h >= 1; $h--) {
            $start = $now->startOfHour()->subHours($h);
            $count = 4 + ($h * 7) % 5; // 4..8, deterministic
            for ($i = 0; $i < $count; $i++) {
                $posts[] = [
                    'at' => $start->addMinutes(($i * 53 + $h * 11) % 60),
                    'account_id' => $accounts[($h + $i) % count($accounts)],
                    'sentiment' => $i % 4 === 0 ? 'negative' : ($i % 2 === 0 ? 'positive' : 'neutral'),
                    'text' => 'Demo lonjakan: '.$this->sentence($h * 10 + $i, self::CALM),
                ];
            }
        }

        return $posts;
    }

    /**
     * @param  list<int>  $accounts
     * @return list<array{at: CarbonImmutable, account_id: int, sentiment: string, text: string}>
     */
    private function spike(CarbonImmutable $now, array $accounts): array
    {
        $posts = [];
        for ($i = 0; $i < self::SPIKE_POSTS; $i++) {
            $posts[] = [
                'at' => $now->subMinutes(25)->addSeconds((int) ($i * 24 * 60 / self::SPIKE_POSTS)),
                'account_id' => $accounts[$i % count($accounts)],
                'sentiment' => $i % 10 < 7 ? 'negative' : 'neutral',
                'text' => 'Demo lonjakan: '.$this->sentence($i * 7 + 3, self::HOT),
            ];
        }

        return $posts;
    }

    /**
     * @param  list<int>  $accounts
     * @param  list<array{at: CarbonImmutable, account_id: int, sentiment: string, text: string}>  $posts
     */
    private function insertPosts(Source $source, Topic $topic, array $accounts, array $posts): void
    {
        $now = now()->utc()->format('Y-m-d H:i:s').'+00';
        $keyBase = 'demo-spike-'.bin2hex(random_bytes(4));

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
                    'is_simulated' => true, 'created_at' => $now, 'updated_at' => $now,
                ];
            }
            DB::table('posts')->insert($rows);
            $ids = DB::table('posts')->where('source_id', $source->id)->whereIn('external_id', $keys)->pluck('id');
            DB::table('topic_matches')->insertOrIgnore($ids->map(fn ($id) => ['post_id' => $id, 'topic_id' => $topic->id])->all());
        }
    }

    /**
     * @param  list<list<string>>  $pools
     */
    private function sentence(int $n, array $pools): string
    {
        $words = [];
        foreach ($pools as $k => $pool) {
            $words[] = $pool[($n * (2 * $k + 3) + $k * 5) % count($pool)];
        }

        return implode(' ', $words).' '.dechex($n * 2654435761 % 4294967296);
    }
}
