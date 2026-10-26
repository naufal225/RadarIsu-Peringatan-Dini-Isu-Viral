# Kepemilikan domain RadarIsu

Dokumen ini adalah sumber kebenaran pembagian kerja. Semua agen dan anggota membacanya sebelum mengubah file.
Perubahan pembagian dilakukan lewat PR yang mengubah file ini dan `.github/CODEOWNERS` bersamaan.

## Domain

| Domain | Pemilik | Reviewer | Fitur |
|---|---|---|---|
| **A: Data & Deteksi** | Naufal | Rekishi | F1, F2, F3, F4, F11, F13 |
| **B: Keamanan & Alur** | Kadavi | Naufal | F6, F9 (F10, F12 dialihkan, lihat di bawah) |
| **C: Skor & Produk** | Rekishi | Kadavi | F5, F7, F8 (F14 dan F15 dialihkan, lihat di bawah) |

Setiap domain punya dua pemilik di CODEOWNERS. Penulis PR tidak bisa menyetujui PR-nya sendiri, jadi reviewer selalu orang lain.

## Pengalihan tugas

Fitur yang dipindah ke pemilik lain setelah pembagian awal. Pemilik lama menjadi reviewer, agar pemilik baru tidak menyetujui PR-nya sendiri.

| Fitur | Pemilik lama | Pemilik baru | Reviewer | Tanggal | Branch |
|---|---|---|---|---|---|
| F10 Audit log | Kadavi | Naufal | Kadavi | 2026-10-23 | `feat/b-f10-audit-logger`, `feat/b-f10-audit-ui` |
| F12 Autentikasi dan RBAC | Kadavi | Naufal | Kadavi | 2026-10-23 | `feat/b-f12-auth-rbac` |
| F15 Pengaturan deteksi | Rekishi | Naufal | Rekishi | 2026-10-23 | `feat/c-f15-pengaturan-deteksi` |
| F14-a Pelabelan data | Rekishi | Naufal | Rekishi | 2026-10-26 | `feat/c-f14a-pelabelan` |
| F14-b Halaman Evaluasi | Rekishi | Naufal | Rekishi | 2026-10-26 | `feat/c-f14b-evaluasi` |

Prefiks domain di nama branch (`b-`, `c-`) tidak diubah. Path CODEOWNERS untuk fitur ini ada di blok "Pengalihan tugas" di bagian bawah `.github/CODEOWNERS`.

## Tabel database

| Tabel | Pemilik |
|---|---|
| sources, import_batches, raw_items, accounts, posts | A |
| official_accounts, topics, topic_matches, metrics_hourly | A |
| replay_scenarios, replay_rows | A |
| users, roles, permissions, permission_role, personal_access_tokens | Naufal (F12) |
| alerts, alert_evidence, alert_actions, briefings | B |
| audit_logs | Naufal (F10) |
| settings | Naufal (F15) |
| evaluation_runs | Naufal (F14) |

Tabel yang dimiliki satu domain boleh dibaca domain lain, tetapi tidak diubah tanpa lewat pemiliknya.

## Endpoint API (per file rute)

| File | Pemilik |
|---|---|
| `routes/api/auth.php`, `users.php` | Naufal (F12) |
| `routes/api/audit.php` | Naufal (F10) |
| `routes/api/alerts.php`, `briefings.php` | B |
| `routes/api/sources.php`, `imports.php`, `topics.php`, `replay.php` | A |
| `routes/api/settings.php` | Naufal (F15) |
| `routes/api/labeling.php`, `evaluation.php` | Naufal (F14) |
| `routes/api/dashboard.php`, `system.php` | C |
| `routes/api.php` (indeks, hanya memuat file di atas) | B |

## Halaman frontend

| Halaman | Pemilik |
|---|---|
| `/login`, BFF (`app/api/`), `proxy.ts`, layout `(app)`, `/admin/users` | Naufal (F12) |
| `/admin/audit` | Naufal (F10) |
| `/alerts`, `/briefings` | B |
| `/admin/sources`, `/admin/replay`, `/topics` | A |
| `/admin/settings` | Naufal (F15) |
| `/labeling`, `/evaluation` | Naufal (F14) |
| `/dashboard`, `/admin/status` | C |

## File bersama

- `CLAUDE.md`, `docs/PRD.md`, `docs/OWNERSHIP.md`, `docs/CONTRACTS.md`, `.github/CODEOWNERS`: review dari semua pemilik.
- `frontend/src/lib/labels.ts` (penggabung): review dari semua pemilik. Label per domain ada di `lib/labels/{domain}.ts`.
- `backend/config/permissions.php` dan `frontend/src/lib/permissions.ts`: dimiliki Naufal (F12). Setiap perubahan izin diumumkan di `HANDOFF.md`, karena memengaruhi semua domain.
- `docker-compose.yml`, Dockerfile, `.github/workflows/`: dimiliki B.

## Kontrak antar-domain

Titik integrasi yang harus disepakati sebelum dipakai. Tulis detailnya di `docs/CONTRACTS.md`.

| Dari → Ke | Kontrak |
|---|---|
| F12, F10 (Naufal) → semua | Middleware `EnsurePermission` dan `AuditLogger` (dibutuhkan sejak Fase 1) |
| C → A | `ThreatScorer::score(input) → {score, breakdown}` |
| C → A | `SentimentAnalyzer::classify(text) → {label, score}` |
| A → B | Service pembuatan alert untuk jenis `issue` dan `impersonation` |
| F15 (Naufal) → A | Pembacaan `settings` untuk ambang deteksi (`Setting::detection()`) |
| A → semua | Replay selalu lewat pipeline yang sama dengan sumber live |

## Aturan

1. Mengubah kepemilikan dilakukan lewat PR dan disetujui semua pemilik.
2. Jika butuh perubahan di file milik domain lain, tulis di `HANDOFF.md`. Jangan mengedit langsung.
3. Pemindahan file lintas domain dikerjakan dalam commit terpisah dari fitur.
4. Migrasi diberi nama `*_create_{table}_table.php` agar pemilik bisa dipetakan per tabel. Migrasi perubahan (`add_*`, `alter_*`) harus menyebut tabelnya di nama file atau dikonfirmasi lewat `HANDOFF.md`.
5. Pemindahan `ThreatScorer` dan `SentimentAnalyzer` ke `Services/Scoring/` dan `Services/Sentiment/` dilakukan sebagai commit refactor sendiri, lalu PRD §7 diperbarui.