# Pertanyaan terbuka dan konflik PRD

Dicatat sesuai CLAUDE.md: konflik tidak ditebak. Keputusan dicatat di sini dan di PRD (riwayat perubahan v2.1).

## Terbuka

Belum ada.

## Diputuskan 2026-10-21 (PRD v2.1)

1. **Versi stack** — Laravel 13 dan Next 16 (`src/`, `proxy.ts`) diterima, dan PRD diperbarui. *Selesai.*
2. **Celah Fase 0** — `docker-compose.yml`, `docker/nginx/default.conf`, Dockerfile backend dan frontend, serta root `.env.example` sudah dibuat. Fase 1 dimulai sebelum gerbang Fase 0 lulus, dan ini dicatat di §18.
   - *Belum terverifikasi:* Docker Desktop belum berjalan saat dikerjakan, jadi baru `docker compose config` yang lulus. DoD Fase 0 ("`docker compose up` menjalankan semua layanan; halaman login tampil") masih harus dicek.
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
