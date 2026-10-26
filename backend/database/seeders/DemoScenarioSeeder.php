<?php

namespace Database\Seeders;

use App\Models\ReplayScenario;
use App\Models\Topic;
use App\Models\User;
use App\Services\Ingest\ReplayScenarioImporter;
use Illuminate\Database\Seeder;
use RuntimeException;

/**
 * Demo scenario for F11 (PRD §9.8 item 5, §20): "Narasi terkoordinasi terhadap institusi". It is NOT part of
 * DatabaseSeeder: run it on purpose, then play it from /admin/replay or the terminal,
 *
 *   php artisan db:seed --class=DemoScenarioSeeder
 *   php artisan radarisu:replay {id} --sync        (no waiting, detection after every batch)
 *
 * The script: 30 hours of quiet, varied organic chatter about a fictional institution (the baseline), then in
 * a few minutes 40 accounts, 30 of them only days old, post the same message with a different code at the end,
 * between 12 unrelated organic posts (the incident). Every row carries its manual label, so the run can be
 * evaluated (F14). With the default settings the incident gives one `issue` alert: a spike (far above the
 * topic's normal hour), a coordinated cluster of 40 accounts and young accounts.
 *
 * Offsets are relative; the runner puts them on the calendar. The CSV that is built here has the format of
 * a normal scenario upload, so it also serves as the sample for /admin/replay (see sampleCsv()).
 */
class DemoScenarioSeeder extends Seeder
{
    public const SCENARIO_NAME = 'Narasi terkoordinasi terhadap institusi';

    public const TOPIC_NAME = 'Demo Replay: narasi terkoordinasi (simulasi)';

    public const KEYWORD = 'institusi contoh';

    public const CAMPAIGN_ACCOUNTS = 40;

    public const YOUNG_ACCOUNTS = 30;

    public const ORGANIC_ACCOUNTS = 25;

    public const BASELINE_HOURS = 30;

    private const INCIDENT_ORGANIC_POSTS = 12;

    private const CAMPAIGN = 'Waspada! Ada kabar penting soal institusi contoh, segera ikuti tautan resmi dan bagikan ke grup keluarga kalian, kode ';

    /** Word pools for the organic posts, so none of them resembles another. */
    private const POOLS = [
        ['warga', 'pengguna', 'pelanggan', 'peserta', 'relawan', 'pegawai'],
        ['menanyakan', 'membahas', 'menceritakan', 'mengomentari', 'menyebut', 'membagikan'],
        ['jadwal', 'layanan', 'antrean', 'loket', 'formulir', 'pengumuman'],
        ['kemarin', 'pagi tadi', 'minggu ini', 'siang ini', 'semalam', 'barusan'],
    ];

    public function run(): void
    {
        $admin = User::whereHas('role', fn ($q) => $q->where('slug', 'admin'))->first()
            ?? throw new RuntimeException('Run DatabaseSeeder first: the demo needs the admin user.');

        Topic::firstOrCreate(['name' => self::TOPIC_NAME], [
            'category' => 'general', 'keywords' => [self::KEYWORD], 'sensitivity' => 'medium',
            'is_template' => false, 'is_active' => true, 'created_by' => $admin->id,
        ]);

        $existing = ReplayScenario::where('name', self::SCENARIO_NAME)->first();
        if ($existing !== null) {
            $this->command?->info("Scenario [{$existing->id}] already exists; play it again from /admin/replay.");

            return;
        }

        $path = tempnam(sys_get_temp_dir(), 'scenario');
        try {
            file_put_contents($path, self::sampleCsv());
            $scenario = app(ReplayScenarioImporter::class)->import($path, [
                'name' => self::SCENARIO_NAME,
                'description' => 'Sampel Replay: riwayat tenang 30 jam, lalu 40 akun (30 di antaranya baru dibuat) menyebarkan pesan yang hampir sama.',
                'default_speed_factor' => 600,
            ], $admin);
        } finally {
            @unlink($path);
        }

        $this->command?->info("Scenario [{$scenario->id}] ready. Run: php artisan radarisu:replay {$scenario->id} --sync");
    }

    /**
     * The scenario as an uploadable CSV. Deterministic, so two builds are identical.
     */
    public static function sampleCsv(): string
    {
        $lines = [['offset_seconds', 'phase', 'text', 'account_handle', 'account_display_name', 'account_age_days', 'label_manual']];

        $organic = fn (int $n) => [sprintf('@warga_organik_%02d', $n % self::ORGANIC_ACCOUNTS + 1), 'Warga Organik '.($n % self::ORGANIC_ACCOUNTS + 1), 400 + ($n * 37) % 500];

        $n = 0;
        for ($hour = 0; $hour < self::BASELINE_HOURS; $hour++) {
            $count = 4 + ($hour * 7) % 3; // 4..6, deterministic
            for ($i = 0; $i < $count; $i++) {
                [$handle, $name, $age] = $organic($n);
                $offset = $hour * 3600 + ($i * 593 + $hour * 131) % 3500;
                $lines[] = [$offset, 'baseline', self::organicText($n), $handle, $name, $age, 'organic'];
                $n++;
            }
        }

        $incidentStart = self::BASELINE_HOURS * 3600;
        for ($i = 1; $i <= self::CAMPAIGN_ACCOUNTS; $i++) {
            $age = $i <= self::YOUNG_ACCOUNTS ? 2 + $i % 10 : 400;
            $lines[] = [
                $incidentStart + 120 + $i * 6, 'incident', self::CAMPAIGN.sprintf('%s%d', chr(64 + $i % 26 + 1), 100 + $i * 7),
                sprintf('@kampanye_%02d', $i), sprintf('Akun Kampanye %02d', $i), $age, 'anomalous',
            ];
        }
        for ($i = 0; $i < self::INCIDENT_ORGANIC_POSTS; $i++) {
            [$handle, $name, $age] = $organic($n);
            $lines[] = [$incidentStart + $i * 55, 'incident', self::organicText($n), $handle, $name, $age, 'organic'];
            $n++;
        }

        $out = fopen('php://temp', 'r+');
        foreach ($lines as $line) {
            fputcsv($out, $line, ',', '"', '');
        }
        rewind($out);

        return stream_get_contents($out);
    }

    private static function organicText(int $n): string
    {
        $parts = [];
        foreach (self::POOLS as $k => $pool) {
            $parts[] = $pool[($n * (2 * $k + 1) + intdiv($n, 7) * $k) % count($pool)];
        }

        return ucfirst("{$parts[0]} {$parts[1]} {$parts[2]} ".self::KEYWORD." {$parts[3]}.");
    }
}
