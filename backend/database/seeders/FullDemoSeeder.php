<?php

namespace Database\Seeders;

use App\Models\Alert;
use App\Models\Briefing;
use App\Models\Role;
use App\Models\Source;
use App\Models\User;
use App\Services\Alerts\AlertStateMachine;
use App\Services\Audit\AuditLogger;
use App\Services\Briefings\BriefingPdfGenerator;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Storage;

/**
 * Seluruh data demo untuk purwarupa: setiap halaman terisi, termasuk triase, briefing, evaluasi, dan audit.
 *
 * Dipanggil dari `migrate:fresh --seed` di lingkungan lokal, atau langsung:
 *   php artisan db:seed --class=FullDemoSeeder
 *
 * Seluruh data dibuat lewat jalur yang sama dengan aplikasi (perintah deteksi dan replay, state machine
 * triase, dan generator PDF), sehingga audit log dan jejak penanganan ikut tercatat. Semua data bersifat simulasi.
 */
class FullDemoSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            SpikeDemoSeeder::class,
            CoordinationDemoSeeder::class,
            ImpersonationDemoSeeder::class,
            LabelingDemoSeeder::class,
            DemoScenarioSeeder::class,
        ]);

        Artisan::call('radarisu:detect', ['--sync' => true]);

        $scenarioId = (int) \App\Models\ReplayScenario::query()->orderBy('id')->value('id');
        if ($scenarioId > 0) {
            Artisan::call('radarisu:replay', ['scenario' => $scenarioId, '--sync' => true]);
            Artisan::call('radarisu:detect', ['--sync' => true]);
        }

        $admin = $this->user('admin');
        $analyst = $this->user('analyst');
        $leader = $this->user('leader');

        $this->seedUsers();
        $this->seedSources();
        $this->seedOfficialAccounts();

        Artisan::call('radarisu:evaluate', ['--user' => $admin->id]);
        if ($scenarioId > 0) {
            Artisan::call('radarisu:evaluate', ['--scenario' => $scenarioId, '--user' => $admin->id]);
        }

        $this->seedTriage($analyst, $leader);

        $this->command?->info('Full demo data ready.');
    }

    private function user(string $roleSlug): User
    {
        return User::whereHas('role', fn ($q) => $q->where('slug', $roleSlug))->where('is_active', true)->orderBy('id')->firstOrFail();
    }

    /** Pengguna tambahan agar daftar pengguna tidak hanya tiga baris. */
    private function seedUsers(): void
    {
        $analystRole = Role::where('slug', 'analyst')->value('id');
        $password = env('DEMO_USER_PASSWORD', 'radarisu-demo-2026');

        User::updateOrCreate(['email' => 'analis2@radarisu.test'], [
            'name' => 'Analis Cadangan',
            'password' => $password,
            'role_id' => $analystRole,
            'is_active' => false,
        ]);
        User::updateOrCreate(['email' => 'analis3@radarisu.test'], [
            'name' => 'Analis Tambahan',
            'password' => $password,
            'role_id' => $analystRole,
            'is_active' => true,
        ]);
    }

    /** Semua sumber demo punya status uji dan waktu tarik, tidak ada yang "belum pernah diuji". */
    private function seedSources(): void
    {
        Source::query()->update([
            'last_status' => 'ok',
            'last_fetched_at' => now(),
            'last_error' => null,
        ]);
    }

    /** Akun resmi untuk deteksi peniruan (F13), agar panel akun resmi dan pencocokan terisi. */
    private function seedOfficialAccounts(): void
    {
        if (\App\Models\OfficialAccount::query()->exists()) {
            return;
        }

        foreach ([
            ['handle' => 'kodam_contoh', 'display_name' => 'Kodam Contoh (akun resmi simulasi)'],
            ['handle' => 'puspen_contoh', 'display_name' => 'Puspen Contoh (akun resmi simulasi)'],
        ] as $account) {
            \App\Models\OfficialAccount::create($account);
        }
    }

    /**
     * Triase bervariasi agar setiap status tampil: diambil, dieskalasi, disetujui, dikembalikan,
     * positif palsu, ditutup, komentar, dan sisanya tetap baru untuk antrean dasbor.
     */
    private function seedTriage(User $analyst, User $leader): void
    {
        $machine = app(AlertStateMachine::class);
        $alerts = Alert::orderByDesc('score')->orderBy('id')->get()->values();

        $plan = [
            0 => ['take', 'escalate', 'approve', 'briefing'],
            1 => ['take', 'escalate', 'return', 'briefing'],
            2 => ['take', 'false_positive'],
            3 => ['take', 'close'],
            4 => ['take', 'escalate', 'briefing'],
            5 => ['take', 'comment'],
        ];

        foreach ($plan as $index => $steps) {
            $alert = $alerts->get($index);
            if ($alert === null) {
                continue;
            }

            foreach ($steps as $step) {
                match ($step) {
                    'take' => $machine->apply($alert, 'take', $analyst),
                    'escalate' => $machine->apply($alert, 'escalate', $analyst, [
                        'recommendation' => 'Tinjau akun terkait dan pertimbangkan klarifikasi resmi.',
                        'note' => 'Pola serupa muncul di beberapa akun dalam satu jendela waktu.',
                    ]),
                    'approve' => $machine->apply($alert, 'approve', $leader, ['note' => 'Setuju. Tindak lanjut sesuai rekomendasi.']),
                    'return' => $machine->apply($alert, 'return', $leader, ['note' => 'Kumpulkan bukti tambahan sebelum keputusan.']),
                    'false_positive' => $machine->apply($alert, 'false_positive', $analyst, ['note' => 'Akun ternyata kampanye organik dari komunitas.']),
                    'close' => $machine->apply($alert, 'close', $analyst, ['note' => 'Isu mereda dan tidak lagi memenuhi ambang.']),
                    'comment' => $machine->apply($alert, 'comment', $analyst, ['note' => 'Menunggu data tambahan dari sumber berikutnya.']),
                    'briefing' => $this->briefing($alert->fresh(), $alert->fresh()->status === 'approved' ? $leader : $analyst),
                };
            }
        }
    }

    /** Briefing sama dengan `BriefingController::store`: konten, PDF, dan jejak audit. */
    private function briefing(Alert $alert, User $creator): void
    {
        $alert->load(['topic', 'subjectAccount', 'evidence.account', 'evidence.post', 'actions.user']);

        $title = 'Briefing Peringatan Dini #'.$alert->id.': '.($alert->topic?->name ?? $alert->subjectAccount?->handle ?? "Isu {$alert->id}");
        $kindLabel = $alert->kind === 'impersonation' ? 'peniruan identitas' : 'isu viral';
        $severityLabel = ['high' => 'tinggi', 'medium' => 'sedang'][$alert->severity] ?? 'rendah';
        $summary = "Ringkasan {$kindLabel} dengan skor ancaman {$alert->score} (tingkat {$severityLabel}). Rekomendasi: ".($alert->recommendation ?? 'Tinjau alert ini sebelum menentukan tindak lanjut.');

        $briefing = new Briefing([
            'alert_id' => $alert->id,
            'created_by' => $creator->id,
            'title' => $title,
            'summary' => $summary,
            'content' => [
                'timeline' => $alert->actions->map(fn ($a) => [
                    'action' => $a->action,
                    'user' => $a->user?->name,
                    'from_status' => $a->from_status,
                    'to_status' => $a->to_status,
                    'note' => $a->note,
                    'created_at' => (string) $a->created_at,
                ])->all(),
                'evidence_ids' => $alert->evidence->pluck('id')->all(),
                'recommendation' => $alert->recommendation,
                'decision' => $alert->status === 'approved' ? 'approved' : ($alert->status === 'returned' ? 'returned' : null),
            ],
        ]);
        $briefing->save();

        $filePath = "briefings/briefing-{$alert->id}-".time().'.pdf';
        Storage::disk('local')->put($filePath, app(BriefingPdfGenerator::class)->generate($alert, $briefing));

        $briefing->file_path = $filePath;
        $briefing->save();

        app(AuditLogger::class)->log('briefing.create', $briefing, [
            'alert_id' => $alert->id,
            'title' => $title,
            'file_path' => $filePath,
        ], $creator);
    }
}
