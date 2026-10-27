# Audit Payload UI (v1, 2026-10-27)

Tabel per wilayah: komponen atau halaman, field yang dibutuhkan, ada atau tidak, endpoint, dan tindakan (turun-kualitas jujur, atau minta tambahan ke pemilik lewat `docs/HANDOFF.md`). Siapa saja boleh menambah bagiannya. Lihat `docs/UI_WORKPLAN.md` bagian 6.

## Fondasi (Naufal)

| Komponen / halaman | Field yang dibutuhkan | Ada? | Endpoint | Tindakan |
|---|---|---|---|---|
| `SimulationBanner` global | bendera data simulasi | hanya `data_notice.has_simulated_data` | `GET /dashboard/summary` (`dashboard.view`) | Admin tidak punya izin itu. Shell belum memasang banner; halaman admin memakai `SimBadge` per baris. Lihat OPEN_QUESTIONS #38 |
| `SimulationBanner` jam data | `replay.clock.now` | ya, `meta.clock_now` dan `meta.data_now` | `GET /replay/scenarios` (`replay.manage`) | Dipakai hanya di `/admin/replay`; halaman lain tanpa jam data |
| Pengguna di bilah atas | nama, peran | ya | `GET /auth/me` | Sudah dipakai shell |
| Menu per izin | daftar izin | ya | `GET /auth/me` (`permissions`) | `useCan` |
| `/login` | status 401/422/429 | ya (422 untuk kredensial salah) | `POST /auth/login` via BFF | Semua kegagalan kredensial memakai satu pesan umum |

## `/admin/replay` (Naufal, F11)

Sumber: `ReplayController` dan `ReplayScenarioResource` (nyata). Tipe: `lib/api-types/replay.ts`; fixture: `fixtures/replay.ts`.

| Komponen / halaman | Field yang dibutuhkan | Ada? | Endpoint | Tindakan |
|---|---|---|---|---|
| Daftar skenario | `name`, `description`, `total_rows`, `status`, `progress_rows` | ya | `GET /replay/scenarios` | Tabel + bilah progres; setiap baris `SimBadge` (semua data Replay simulasi) |
| Jam data | `meta.clock_now` | ya, `null` bila tidak ada Replay berjalan | `GET /replay/scenarios` | `SimulationBanner` dengan "Jam data" hanya bila `clock_now` ada. Data nyata: skenario bisa `running` dengan `clock_now = null` sebelum pekerja antrean mengambil job; banner tidak tampil dan halaman tidak mengarang jam |
| Kontrol | `default_speed_factor`, `speed_factor`, `run_number`, `virtual_anchor_at`, `started_at`, `finished_at`, `error` | ya | `GET /replay/scenarios` | `error` berupa kode (`heartbeat_lost`) atau pesan galat mentah; kode dilabeli, pesan mentah tampil apa adanya |
| Mulai/Hentikan | 409 `already_running`, `another_running`, `empty_scenario`, `not_running` | ya | `POST /replay/scenarios/{id}/start`, `/stop` | `ConfirmDialog`, kode tampil di bawah tombol |
| Unggah | 422 `errors.file` (kode berkas), `errors.rows` (`baris:kode`, maks. 50), galat per bidang | ya | `POST /replay/scenarios` | Pesan di bawah bidang dan tabel baris bermasalah |
| Polling | status `running` | ya | `GET /replay/scenarios` | Muat ulang tiap 2 detik hanya selama ada skenario `running` |
## `/admin/audit` (Naufal, F10)

Sumber: `AuditLogController::auditLogs` (nyata, bukan stub). 50 baris per halaman, terbaru dulu. Tipe: `lib/api-types/audit.ts`; fixture: `fixtures/audit.ts`.

| Komponen / halaman | Field yang dibutuhkan | Ada? | Endpoint | Tindakan |
|---|---|---|---|---|
| Kolom Waktu (WIB + UTC langsung) | `created_at` | ya (ISO UTC) | `GET /audit-logs` | `<Waktu utc="inline">` |
| Kolom Pengguna | `user.name`, `user.email` | ya; `null` untuk aksi tanpa pengguna | `GET /audit-logs` | `null` → "Sistem" |
| Kolom Aksi | `action` (PRD §9.7) | ya | `GET /audit-logs` | Label dari `auditActionLabels`, kode mentah ikut tampil kecil |
| Kolom Objek | `object_type`, `object_id` | ya, keduanya bisa `null` | `GET /audit-logs` | `object_type #object_id`, mono |
| Kolom IP | `ip_address` | ya | `GET /audit-logs` | mono |
| Rincian | `detail` (objek, `{}` bila kosong), `user_agent` | ya | `GET /audit-logs` | `<details>` berisi JSON ter-escape dan peramban |
| Filter pengguna | daftar pengguna | ya, butuh `users.view` | `GET /users?per_page=100` | Admin punya izinnya. Bila gagal, filter pengguna hanya berisi "Semua pengguna" |
| Filter rentang | `from`, `to` (Y-m-d) | ya; 422 bila `to` < `from` | `GET /audit-logs` | Pesan di bawah bidang "Sampai tanggal" |
| Paginasi | `meta.current_page/last_page/per_page/total` | ya | `GET /audit-logs` | `Pagination` |
| Peramban dan IP pengguna asli | `user_agent`, `ip_address` | **isi tidak akurat** | `GET /audit-logs` | Data nyata menunjukkan `user_agent = "node"` dan IP `127.0.0.1` karena BFF Next (`app/api/[...path]`) memanggil Laravel dari server tanpa meneruskan `User-Agent` dan `X-Forwarded-For`. UI menampilkan apa adanya. Perbaikan ada di BFF (F12, Naufal) dan pengaturan proxy tepercaya Laravel; dicatat untuk tugas terpisah |

## `/admin/sources` (Naufal, F1) · Polos

Sumber: `SourceController`, `SourceResource`, `ImportBatchResource` (nyata). Tipe: `lib/api-types/sources.ts`; fixture: `fixtures/sources.ts`.

| Komponen / halaman | Field yang dibutuhkan | Ada? | Endpoint | Tindakan |
|---|---|---|---|---|
| Tabel sumber | `name`, `type`, `last_status`, `last_fetched_at`, `interval_minutes`, `is_active`, `raw_items_count`, `last_error`, `is_simulated` | ya; daftar tidak berpaginasi | `GET /sources` | `DataTable`; sumber `replay` diberi `SimBadge` dan tanpa aksi (dibuat Replay) |
| Uji koneksi | sumber terbaru setelah uji | ya, selalu 200; galat jaringan masuk `last_status`/`last_error` | `POST /sources/{id}/test` | Hasil tampil sebagai data di baris, bukan galat. 422 `connection_test_not_supported`/`offline_mode_enabled` tampil sebagai pesan baris |
| Form tambah/ubah | `name`, `is_active`, `config.url`, `config.max_items`, `config.video_ids`, `interval_minutes` | ya; `type` dilarang saat ubah | `POST /sources`, `PATCH /sources/{id}` | Kunci 422 `config.*` dipetakan ke bidangnya |
| Impor CSV | ringkasan `total/success/failed_rows`, `errors[{row, message}]` (maks. 200) | ya; galat level berkas 422 `errors.file` | `POST /sources/{id}/import` | Ringkasan + tabel baris bermasalah di dialog |
| Riwayat impor | daftar batch | ya, paginasi 50 | `GET /sources/{id}/imports` | Halaman pertama saja, di dialog impor |

## `/admin/users` (Naufal, F12) · Polos

Sumber: `UserController`, `UserResource` (nyata). Tipe: `lib/api-types/users.ts`; fixture: `fixtures/users.ts`.

| Komponen / halaman | Field yang dibutuhkan | Ada? | Endpoint | Tindakan |
|---|---|---|---|---|
| Tabel pengguna | `name`, `email`, `role` (slug), `is_active`, `last_login_at` | ya; paginasi 50, urut nama | `GET /users` | `DataTable` + `Pagination`; `last_login_at = null` → "Belum pernah" |
| Tambah | `name`, `email`, `password` (min. 10), `role` | ya; akun baru selalu aktif | `POST /users` | Dialog |
| Ubah | `name`, `role`, `is_active` | ya; email dan kata sandi tidak bisa diubah lewat API ini | `PATCH /users/{id}` | Dialog; email tampil sebagai teks |
| Pesan 422 | teks per bidang | **bahasa Inggris** (`APP_LOCALE=en`, tanpa berkas terjemahan) | `POST`/`PATCH /users` | UI menampilkan pesan Indonesia per bidang (`ui.users.fieldErrors`), bukan teks server. Penonaktifan atau ganti peran akun sendiri ditolak server (PRD §8.4); tombolnya tidak disembunyikan |

Bagian Kadavi, Rekishi, dan halaman Naufal lain ditambahkan oleh pemilik masing-masing.
