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

Bagian Kadavi, Rekishi, dan halaman Naufal lain ditambahkan oleh pemilik masing-masing.
