# Handoff antar-domain

Papan pengumuman untuk perubahan yang menyentuh domain lain, perubahan izin, dan perubahan kontrak (lihat `docs/OWNERSHIP.md`). File ini boleh diubah siapa saja. Entri terbaru di atas.

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
