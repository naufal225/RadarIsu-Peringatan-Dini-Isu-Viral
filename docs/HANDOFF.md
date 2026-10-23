# Handoff antar-domain

Papan pengumuman untuk perubahan yang menyentuh domain lain, perubahan izin, dan perubahan kontrak (lihat `docs/OWNERSHIP.md`). File ini boleh diubah siapa saja. Entri terbaru di atas.

---

## 2026-10-23: F15 pengaturan deteksi tersedia (branch `feat/c-f15-pengaturan-deteksi`)

- **Untuk domain A (detektor, Fase 4):** baca ambang dan bobot lewat `Setting::detection()`. Jangan hardcode angka. Arti tiap kunci ada di `docs/DETECTION_SETTINGS.md`. Hasilnya tidak di-cache, jadi panggil sekali per eksekusi.
- **Untuk Rekishi (reviewer F15):** `SettingController` kini nyata (sebelumnya stub 501), `Setting` model mendapat `DETECTION_DEFAULTS`, `detection()`, dan relasi `updatedBy`, dan `SettingsSeeder` memakai konstanta yang sama. Halaman baru `/admin/settings`, label di `lib/labels/settings.ts`, dan tautan nav untuk `settings.manage`.
- **Untuk semua pemilik:** rentang validasi dan aturan jumlah bobot = 100 adalah keputusan implementasi (PRD tidak merinci). Lihat `docs/OPEN_QUESTIONS.md`.
- Tidak ada migrasi dan tidak ada izin baru.

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
