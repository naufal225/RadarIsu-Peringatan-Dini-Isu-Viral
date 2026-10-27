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

Bagian Kadavi, Rekishi, dan halaman Naufal lain ditambahkan oleh pemilik masing-masing.
