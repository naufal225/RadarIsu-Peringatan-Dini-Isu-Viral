# Pertanyaan terbuka dan konflik PRD

Dicatat sesuai CLAUDE.md: konflik tidak ditebak. Keputusan dicatat di sini dan di PRD (riwayat perubahan).

## Terbuka

1. **Halaman alert:** dipindah dari Fase 8 ke Fase 5? Ini diusulkan agar alur triase bisa diuji lewat UI, tetapi belum diputuskan.
2. **Uji koneksi RSS tanpa tes otomatis jaringan nyata.** Tes memakai `Http::fake`, sehingga validasi opsi cURL oleh Guzzle tidak ikut teruji. Pada Fase 2 ini sempat lolos tes tetapi gagal 500 di Docker (`CURLOPT_MAXFILESIZE` ditolak Guzzle); sudah diperbaiki dan diverifikasi manual ke feed nyata dan file 10 MB. Perlu diputuskan apakah ingest Fase 3 diberi tes integrasi dengan server HTTP lokal.
3. **Migrasi gabungan lintas domain.** `*_create_rbac_tables.php` dan `*_create_audit_replay_evaluation_settings_tables.php` membuat tabel milik beberapa pemilik sekaligus. Ini tidak sesuai OWNERSHIP aturan 4 (`*_create_{table}_table.php`). Migrasi tersebut tidak dipecah, karena sudah dijalankan di DB dev dan Docker. Kepemilikannya ditetapkan lewat pola nama file aktual di CODEOWNERS: migrasi audit/replay/evaluasi/settings butuh review ketiga pemilik. Migrasi baru tetap wajib mengikuti aturan 4. Perlu diputuskan apakah migrasi lama dipecah sebelum deploy final.

## Diputuskan 2026-10-21 (PRD v2.2, Fase 2)

1. **Format CSV** sama dengan `replay_rows` (§11.4). *Selesai.*
2. **Ingest terjadwal RSS/YouTube** masuk Fase 3. *Dicatat di §18.*
3. **Halaman admin minimal** dikerjakan di Fase 2. *Selesai*, dan diverifikasi di browser pada stack Docker.
4. **`GET /system/status`** masuk Fase 2. *Selesai.*
5. **Temuan saat implementasi:** sesi Postgres lokal memakai `Asia/Bangkok`, sementara aplikasi memakai UTC, sehingga semua timestamp di DB lokal bergeser 7 jam (Docker tidak terdampak). Diperbaiki dengan `timezone => UTC` di `config/database.php`, dan ditambahkan tes regresi.
   - Data di DB dev lokal yang dibuat sebelum perbaikan masih bergeser. Jalankan `php artisan migrate:fresh --seed` pada DB dev bila datanya penting.

## Diputuskan 2026-10-21 (PRD v2.1)

1. **Versi stack** — Laravel 13 dan Next 16 (`src/`, `proxy.ts`) diterima, dan PRD diperbarui. *Selesai.*
2. **Celah Fase 0** — `docker-compose.yml`, `docker/nginx/default.conf`, Dockerfile backend dan frontend, serta root `.env.example` sudah dibuat. Fase 1 dimulai sebelum gerbang Fase 0 lulus, dan ini dicatat di §18.
   - *Terverifikasi 2026-10-21:* `docker compose up -d --build` menjalankan postgres, app, queue, scheduler, nginx, dan frontend (semua sehat), migrasi berjalan otomatis, dan halaman login mengembalikan 200. Login, `/auth/me`, dan 403 pada rute terlarang diuji lewat stack Docker. DoD Fase 0 terpenuhi.
   - Seeder tidak dijalankan otomatis: `docker compose exec app php artisan db:seed --force`.
   - Di Docker Desktop (Windows), alamat soket yang dilihat BFF untuk koneksi dari host adalah alamat gateway NAT Docker, bukan IP klien sebenarnya. Throttle login dan audit IP baru akurat bila klien langsung terhubung ke jaringan Docker atau lewat proxy yang dikonfigurasi di Fase 9.
3. **Stub** — semua stub sekarang 501 `{"message":"Belum diimplementasikan","meta":{"pending_phase":N}}`. Tes matriks memeriksa status ≠ 403 dan ≠ 404 untuk peran yang diizinkan. *Selesai.*
4. **Urutan pemeriksaan alert** — izin (403) → policy `view` (404) → state machine (422). §19.1 tambahan 1 dan §19.2 butir 3 kini 404. Untuk §19.2 butir 6, leader pada `false_positive`/`closed` juga 404. *Selesai.*
5. **§19.2 butir 8** tetap *incomplete* dan menjadi kewajiban **Fase 4**.
6. **`AuditLogger` minimal masuk Fase 1** — PRD §18 diperbarui. *Selesai.*
7. **Tes larangan admin menonaktifkan diri sendiri** — diperketat dengan variasi nilai `false`/`0`/`"0"`, pengecekan token dan sesi tetap berlaku, serta tidak ada audit. *Selesai.*
8. **IP klien (item keamanan Fase 1)** — `trustProxies` membaca `TRUSTED_PROXIES` dan hanya memercayai `X-Forwarded-For`. `frontend/server.mjs` menimpa XFF dengan alamat soket, dan BFF meneruskannya tanpa menambahkan apa pun. Di Docker, IP BFF tetap `172.28.0.10` dan Laravel tidak dipublikasikan. *Selesai*, termasuk tes backend dan uji manual lewat BFF.
   - Catatan untuk Fase 9: bila nanti ada reverse proxy TLS di depan Next, alamat soket menjadi alamat proxy, dan `server.mjs` harus disesuaikan.
9. **Vitest** terpasang. `src/lib/permissions.ts` di-generate oleh `php artisan permissions:export-ts`, dan tes backend gagal bila file tertinggal. *Selesai.*
10. **Dependensi frontend** dipasang saat pertama dipakai.
11. **Topik dari templat** — ditolak bila keyword masih mengandung `[`/`]`, dan aktif setelah lolos. Aturan ini dicatat di PRD §9.8/§11 dan di stub `TopicController`. Implementasinya di **Fase 3**, karena `POST /topics` masih stub.
12. **CLAUDE.md** — aturan root menang. `laravel/boost` tidak dipasang. *Selesai.*
