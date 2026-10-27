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

## `/admin/settings` (Naufal, F15)

Sumber: `SettingController` (nyata; bentuk di `docs/CONTRACTS.md` §3.4–3.5). Tipe: `lib/api-types/settings.ts` (dari `lib/detection-settings.ts`); fixture: `fixtures/settings.ts` (nilai awal PRD §9.6).

| Komponen / halaman | Field yang dibutuhkan | Ada? | Endpoint | Tindakan |
|---|---|---|---|---|
| Form per kelompok | 16 ambang + `weights`, `severity_cutoffs`, `sensitivity_z_offset` | ya; PUT mengganti seluruh nilai | `GET/PUT /settings/detection` | `Section` per kelompok, teks bantu per bidang dari `labels/settings.ts` |
| Total bobot | jumlah `weights` | dihitung dari isian | — | Ditampilkan langsung; peringatan bila ≠ 100. Server tetap memvalidasi |
| Pesan 422 | nama bidang (`weights`, `severity_cutoffs.medium`, …) | ya; isi pesan berbahasa Inggris | `PUT /settings/detection` | UI memakai nama bidangnya saja: aturan antar-bidang punya teks sendiri, bidang lain "Server menolak nilai ini" |
| Terakhir diubah | `updated_at`, `updated_by.name` | ya; `null` bila belum pernah diubah | keduanya | `<Waktu>` |
| Mode Offline | `value.enabled` | ya | `GET/PUT /settings/offline-mode` | Kotak centang + simpan |
| Pratinjau skor | — | dihitung di klien dari isian | — | Rumus PRD §10.8 dan §10.7 dengan contoh masukan; bukan perhitungan ulang alert nyata |

## `/topics` dan `/topics/[id]` (Naufal, F2, F3)

Sumber: `TopicController`, `TopicSpikeController`, `OfficialAccountController` (nyata). Tipe: `lib/api-types/topics.ts` (dari `lib/topics.ts` dan `lib/spike.ts`); fixture: `fixtures/topics.ts`.

| Komponen / halaman | Field yang dibutuhkan | Ada? | Endpoint | Tindakan |
|---|---|---|---|---|
| Daftar topik | `name`, `category`, `sensitivity`, `keywords`, `is_active`, `is_template` | ya; tanpa paginasi, templat ikut dalam daftar | `GET /topics` | Dua tabel: topik dan templat |
| Buat dari templat | 422 `keyword_has_placeholder` pada `keywords.N`, `keywords_unmatchable` pada `keywords` | ya | `POST /topics` | Pesan di bawah bidang kata kunci; isian `[ ]` diberi penanda putus-putus. Tombol simpan tetap aktif, server yang menolak |
| Detail: tidak ada endpoint `GET /topics/{id}` | topik tunggal | **tidak** | `GET /topics` | Detail mengambil seluruh daftar lalu memilih id. 404 netral bila id tidak ada (atau `metrics` menjawab 404) |
| Grafik volume | `data[].hour`, `volume`; `meta.from/to/has_simulated_data` | ya; rentang bawaan 7 hari data terakhir, `from`/`to` berupa tanggal (maks. 31 hari) | `GET /topics/{id}/metrics` | `SignalChart`; "24 jam" adalah 24 jam terakhir dari respons 7 hari (tidak ada parameter jam). Tanpa posting di rentang: "Belum ada data metrik untuk rentang ini" |
| Baseline dan ambang di grafik | `mean`, `std`, `threshold_rate`, `has_sufficient_baseline` | ya | `GET /topics/{id}/spike-baseline` | Digambar hanya bila baseline cukup; tidak dihitung di klien. Jendela disorot hanya bila lonjakan terpicu |
| Pin alert di grafik | alert per topik | **tidak di endpoint ini** | — | Tidak ada pin. `/alerts` tidak menyediakan filter topik untuk grafik ini |
| Akun resmi | `handle`, `display_name`, `note` | ya; global, **tidak per topik** | `GET/POST/DELETE /official-accounts` | Ditampilkan di `/topics`, bukan tab di detail (lihat laporan); hapus memakai `ConfirmDialog` |

Bagian Kadavi, Rekishi, dan halaman Naufal lain ditambahkan oleh pemilik masing-masing.
