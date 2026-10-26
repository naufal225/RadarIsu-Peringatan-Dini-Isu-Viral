# Handoff antar-domain

Papan pengumuman untuk perubahan yang menyentuh domain lain, perubahan izin, dan perubahan kontrak (lihat `docs/OWNERSHIP.md`). File ini boleh diubah siapa saja. Entri terbaru di atas.

---

## 2026-10-26: F14-a Pelabelan data (branch `feat/c-f14a-pelabelan`)

- **Untuk Rekishi (reviewer F14):** pelabelan dipisah dari `EvaluationController` ke `LabelingController` (sesuai pola `Labeling*` di CODEOWNERS). `EvaluationController` kini hanya berisi stub `runs` dan `run` untuk F14-b. Rute `labeling/posts` menunjuk ke controller baru; URI, metode, dan middleware tidak berubah.
- **Untuk semua pemilik:** tidak ada migrasi, izin, atau perubahan file domain lain. `posts.label_manual` sudah ada sejak skema awal.
- Demo: `php artisan db:seed --class=CoordinationDemoSeeder` lalu `php artisan db:seed --class=LabelingDemoSeeder` (200 posting terbaru dilabeli; akun kampanye `anomalous`, sisanya `organic`).

---

## 2026-10-26: F11 Mode Replay (branch `feat/a-f11-mode-replay`)

- **Untuk semua pemilik:** Replay butuh pekerja antrean `replay` selain pekerja biasa: `php artisan queue:work --queue=replay`. Tanpa itu, `POST /replay/scenarios/{id}/start` menandai skenario `running` tetapi tidak ada yang memainkannya (detaknya berhenti dan putaran ditutup otomatis setelah 120 detik saat start berikutnya). Untuk demo tanpa pekerja: `php artisan db:seed --class=DemoScenarioSeeder` lalu `php artisan radarisu:replay {id} --sync`.
- **Untuk Rekishi (C, kini reviewer F14):** `PostNormalizer` dan `NormalizePostsJob` (milik A) menerima kunci opsional `label_manual` di payload kanonik dan menulisnya ke `posts.label_manual`; hanya Replay yang memakainya. `AggregateMetrics` memakai `DataClock::now()`. Tidak ada perubahan di `ThreatScorer` atau `SentimentAnalyzer`.
- **Untuk Kadavi (B):** tidak ada perubahan di alert atau `AlertWriter`. Alert dari Replay memakai `detected_at` jam virtual (sama seperti detektor lain).
- **Untuk F14:** kontrak ada di `docs/CONTRACTS.md` §2.7 (bentuk `external_id`, `run_number`, rumus waktu deteksi) dan `docs/OPEN_QUESTIONS.md` #27–#33.
- Baru: migrasi `add_runtime_columns_to_replay_scenarios_table` (kolom jalan dan indeks unik "satu yang berjalan"), halaman `/admin/replay`, tautan nav "Mode Replay", `labels/replay.ts`.

---

## 2026-10-26: Pengalihan F14-a dan F14-b ke Naufal

- **Untuk Rekishi (C):** F14 (pelabelan data dan halaman Evaluasi) pindah ke Naufal; Rekishi menjadi reviewer. Ikut pindah: tabel `evaluation_runs`, `routes/api/labeling.php` dan `evaluation.php`, halaman `/labeling` dan `/evaluation`, dan path terkait di `.github/CODEOWNERS` (blok baru "F14" di bagian bawah). Belum ada kode F14 yang dikerjakan sebelum pengalihan (hanya kerangka 501).
- Urutan kerja: F11 Mode Replay (`feat/a-f11-mode-replay`), F14-a (`feat/c-f14a-pelabelan`), F14-b (`feat/c-f14b-evaluasi`).

---

## 2026-10-26: F13 deteksi peniruan akun (branch `feat/a-f13-deteksi-peniruan`)

- **Untuk Rekishi (C):** alert `impersonation` kini dibuat. Skornya dari `ThreatScorer::scoreImpersonation($similarity, $young, ThreatScorer::optionsFromSettings($settings))` tanpa perubahan; kemiripan yang dipakai adalah yang tertinggi di antara bacaan nama yang dinormalisasi (OPEN_QUESTIONS #20). Severity memakai `severity_cutoffs` yang sama dengan `issue` (#7).
- **Untuk Kadavi (B):** satu indeks baru pada `accounts` (`accounts_first_seen_at_idx`), tanpa perubahan kolom. `alert_evidence` untuk alert peniruan memakai alasan yang sudah ada (`name_similarity`, `young_account`) dan ditulis ulang di tempat tiap siklus. Tabel rincian skor di `alerts/[id]/alert-detail.tsx` hanya merender komponen alert `issue` (lonjakan, anomali, sentimen, jangkauan); untuk alert peniruan (`similarity`, `young_account`) tabelnya kosong. Itu file B dan tidak saya ubah di F13.
- **Infrastruktur:** `backend/Dockerfile` kini memasang ekstensi `intl` (NFKC). Belum diverifikasi dengan membangun image.
- Baru: `GET /official-accounts/lookalikes` (hanya `alerts.triage`) dan panel "Akun mirip akun resmi" di `/topics` untuk Analis. `DetectJob` menjalankan deteksi isu lalu deteksi peniruan.
- Demo: `php artisan db:seed --class=ImpersonationDemoSeeder` lalu `php artisan radarisu:detect --sync`.
- Catatan merge: ringkasan bukti `name_similarity` ada di `lib/coordination.ts` (`summarizeEvidence`); ia baru tampil di halaman alert setelah perubahan `alert-detail.tsx` dari F4 ikut ter-merge.

---

## 2026-10-26: F4 deteksi koordinasi akun (branch `feat/a-f4-deteksi-koordinasi`)

- **Untuk Rekishi (C):** skor alert `issue` kini bisa membawa komponen *anomaly* dari koordinasi. Input `anomalous_accounts` / `unique_accounts` ke `ThreatScorer::score` dihitung pada jendela koordinasi (OPEN_QUESTIONS #16). `metrics_hourly.anomalous_accounts` kini diisi detektor (hanya naik). Untuk `kind=impersonation` tidak ada perubahan.
- **Untuk Kadavi (B):** satu perubahan kecil di file milik B, `alerts/[id]/alert-detail.tsx`: sel "Detail" bukti kini menampilkan satu kalimat yang bisa dibaca (dari angka di `detail`) dan JSON mentah di dalam `<details>`. Tidak ada perubahan API alert. Alert dari F4 memakai alasan bukti yang sudah ada (`similar_text`, `young_account`, `synchronized_posting`).
- Baru: `GET /topics/{id}/coordination` (hanya `alerts.triage`) dan panel "Deteksi koordinasi akun" di `/topics/{id}`, tampil untuk Analis. `DetectJob` kini memanggil `IssueDetectionService` (menggantikan `SpikeDetectionService::run()`) dan `timeout`-nya 240 detik.
- Demo: `php artisan db:seed --class=CoordinationDemoSeeder` lalu `php artisan radarisu:detect --sync`.
- Catatan merge: label F4 ada di file sendiri (`lib/labels/coordination.ts`), dan panelnya dipasang dari `topics/[id]/page.tsx` agar tidak bentrok dengan panel lonjakan F3 di `topic-detail.tsx`.

---

## 2026-10-26: F3 deteksi lonjakan (branch `feat/a-f3-deteksi-lonjakan`)

- **Untuk Kadavi (B):** tabel `alert_evidence` mendapat satu indeks unik, `alert_evidence_dedup_uq (alert_id, reason, COALESCE(post_id,0), COALESCE(account_id,0))`, agar bukti yang sama tidak terpasang dua kali oleh deteksi yang berjalan tiap menit. Hanya indeks; tidak ada kolom baru dan tidak ada file B yang diubah. Alert dari detektor memakai `AlertWriter` (`docs/CONTRACTS.md` §4.1): `status` selalu `new` saat dibuat dan tidak pernah diubah detektor, tanpa baris `alert_actions`.
- **Untuk Rekishi (C):** detektor memanggil `ThreatScorer::score` dengan `Setting::detection()`. Ambang `z` pada `score_breakdown.thresholds.z` diisi `z_effective` topik tersebut, bukan `z_threshold` dasar.
- Jadwal baru: `radarisu:detect` setiap menit (`withoutOverlapping`). Menjalankan lokal butuh `queue:work`; untuk demo: `php artisan db:seed --class=SpikeDemoSeeder` lalu `php artisan radarisu:detect --sync`.
- Endpoint baru: `GET /topics/{id}/spike-baseline` (`topics.view`), dan panel "Deteksi lonjakan" di `/topics/{id}`.

---

## 2026-10-26: F15 pengaturan deteksi lengkap untuk F3, F4, F13 (branch `feat/c-f15-pengaturan-deteksi`)

- **Untuk domain A (detektor):** baca ambang lewat `Setting::detection()` (sekali per eksekusi, tidak di-cache); arti tiap kunci di `docs/DETECTION_SETTINGS.md`. Selain kunci PRD §9.6, kini ada `spike_current_window_minutes`, `spike_sample_limit`, `synchronized_window_minutes`, `synchronized_ratio`, `impersonation_window_hours` (bawaan = konstanta PRD), serta `cooldown_minutes` dan `coordination_max_posts` (tidak ada di PRD, `docs/OPEN_QUESTIONS.md` #8-#9). Jangan hardcode angka-angka itu.
- Baru: `GET`/`PUT /settings/offline-mode` (`settings.manage`, audit `settings.update`) dan panel Mode Offline di `/admin/settings`. Pembaca `offline_mode` yang ada tidak berubah.
- Severity alert peniruan memakai `severity_cutoffs` yang sama dengan alert `issue` (keputusan sementara, OPEN_QUESTIONS #7), sesuai `ThreatScorer::scoreImpersonation`.
- Perbaikan kecil yang memblokir lint/build: `frontend/src/lib/labels.ts` (`topics: "Topik"` terlempar keluar dari objek `nav` akibat merge) dan `labels.test.ts` (penutup `});` hilang).
- Tidak ada migrasi dan tidak ada izin baru. Baris `settings.detection` lama tetap terbaca (kunci yang hilang diisi bawaan).

---

## 2026-10-23: Pipeline normalisasi → topic match → agregasi, dan F2 (branch `feat/a-f2-topik-pantauan`)

Detail lengkap di `docs/PIPELINE.md`.

- **Untuk penulis `raw_items` (ingestor RSS/YouTube, `ReplayRunner`):** tulis `payload` berbentuk kanonik (sama dengan CSV dan `replay_rows`) lalu panggil `NormalizePostsJob::dispatch()`. Tanpa itu data baru menunggu sapuan tiap menit.
- **Untuk Fase 4 (detektor, domain A):**
  - `metrics_hourly` diisi pipeline per (topik, jam UTC). Kolom `anomalous_accounts` **milik CoordinationDetector**: agregator tidak pernah menimpanya.
  - `accounts.first_seen_at` berada di sumbu waktu data (`posted_at` paling awal), cocok dengan `DataClock` pada §10.7.
  - `MetricsAggregator` menerima awal jendela sebagai argumen; suntikkan `DataClock::now()` di sana.
  - Hanya topik aktif yang dicocokkan; `TopicMatcher` memakai `SentimentAnalyzer::normalizeText()` sebagai satu-satunya normalisasi.
- **Untuk Rekishi (reviewer):** `Services/Ingest/PostNormalizer` memanggil `SentimentAnalyzer::normalizeText()` dan `classify()` (file domain C), tanpa mengubahnya. Pipeline menyimpan label dan skor persis seperti yang dikembalikan.
- **Untuk semua pemilik:** menjalankan pipeline secara lokal butuh `php artisan queue:work --tries=3` (Docker tidak wajib). Perubahan di `app-nav.tsx` (tautan Topik) dan `labels.ts` bisa bentrok dengan F15; keduanya hanya menambah baris.
- **Perubahan di file bersama:** `StatusBadge` di `components/ui.tsx` mendapat nada `warn`. `routes/console.php` mendapat dua entri jadwal. `CsvImportTest` memakai `Queue::fake()`, dan contoh stub di `AccessMatrixTest` pindah dari `/topics` ke `/dashboard/summary`.
- Dependensi baru: `recharts` (frontend).

---

## 2026-10-23: Pengalihan F10, F12, F15 ke Naufal

**Dari:** Naufal (@naufal225). **Butuh approval:** Kadavi (@dapzz-id) dan Rekishi (@rekis-0103), karena perubahan kepemilikan harus disetujui semua pemilik (OWNERSHIP aturan 1).

- F10 (audit log) dan F12 (autentikasi dan RBAC) pindah dari Kadavi ke Naufal. Reviewer: Kadavi.
- F15 (pengaturan deteksi) pindah dari Rekishi ke Naufal. Reviewer: Rekishi.
- F6 dan F9 tetap milik Kadavi. F5, F7, F8, F14 tetap milik Rekishi.
- `.github/CODEOWNERS`: baris default (`*`) diperbaiki, karena sebelumnya berisi `Naufal = ...` yang bukan sintaks CODEOWNERS yang valid. Path F10, F12, F15 dipindah ke blok "Pengalihan tugas" di bagian bawah.

## 2026-10-23: Refactor rute dan `AdminController` (branch `feat/b-f12-auth-rbac`)

Pemindahan murni tanpa perubahan perilaku, dikerjakan dalam commit terpisah (OWNERSHIP aturan 3):

- `backend/routes/api.php` menjadi indeks yang memuat `routes/api/{auth,users,sources,imports,topics,dashboard,alerts,briefings,audit,replay,settings,labeling,evaluation,system}.php`. Rute yang terdaftar (URI, metode, middleware) tetap sama.
- `AdminController` dipecah menjadi `AuditLogController` (F10), `ReplayController` (A), `SettingController` (F15), dan `SystemStatusController` (C). Isi method dipindah apa adanya.
- **Untuk Rekishi:** `routes/api/{dashboard,labeling,evaluation,system}.php` dan `SystemStatusController` sekarang menjadi file milik domain C. Mohon dicek saat review.
- **Untuk Kadavi:** `routes/api/{alerts,briefings}.php` milik domain B (F6, F9). Isinya sama dengan blok rute alert dan briefing sebelumnya.
