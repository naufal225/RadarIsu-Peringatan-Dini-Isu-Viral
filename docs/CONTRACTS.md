# Kontrak RadarIsu

Dokumen ini adalah kesepakatan antarpihak: API, service, skema database, job, dan frontend.
Kalau kode dan dokumen ini berbeda, dokumen ini yang diperbaiki lebih dulu, atau kode diubah sesuai dokumen. Jangan dibiarkan menyimpang diam-diam.

Pemilik tiap bagian ada di `docs/OWNERSHIP.md`. Perubahan kontrak dilakukan lewat PR yang mengubah file ini, lalu diumumkan di `docs/HANDOFF.md`.

Status kontrak:
- **Disepakati**: sudah dipakai atau dijalankan.
- **Usulan**: menunggu persetujuan semua pemilik.

---

## 1. Konvensi umum

| Aspek | Aturan | Status |
|---|---|---|
| Base URL | `/api/v1/*`, diakses lewat BFF Next.js | Disepakati |
| Sukses | `{ "data": ..., "meta": {...} }` | Disepakati |
| Error | `{ "message": "...", "errors": { "field": ["..."] } }` | Disepakati |
| Waktu | ISO 8601 dalam UTC, misal `2026-10-22T12:00:00Z` | Disepakati |
| ID | `bigint` | Disepakati |
| Nilai enum | Bahasa Inggris snake_case (`reviewing`, `issue`) | Disepakati |
| Teks untuk pengguna | Lewat `labels.ts`, jangan di-hardcode | Disepakati |
| Paginasi | `?page=&per_page=`, default 25, maksimum 100. `meta` berisi `current_page`, `per_page`, `total` | Usulan |

### Kode status

| Kode | Arti |
|---|---|
| 200 / 201 | Berhasil |
| 401 | Tidak terautentikasi, atau token kedaluwarsa |
| 403 | Peran tidak punya izin untuk aksi ini |
| 404 | Tidak ada, atau ada tapi tidak terlihat oleh pengguna |
| 422 | Validasi gagal, atau transisi status tidak valid |
| 429 | Terlalu banyak permintaan (throttle) |
| 501 | Rute stub. Fitur belum diimplementasikan untuk fase ini. Body berisi `meta.pending_phase` |

**Aturan 403 vs 404 (usulan, menunggu konfirmasi):**
- Peran tidak punya izin sama sekali (mis. Analis mencoba `/users`) → 403.
- Alert ada tapi tidak terlihat oleh peran itu (mis. Pimpinan membuka alert `new`) → 404.
- Ini mencegah pengguna menebak keberadaan dan status alert dari respons yang berbeda.

---

## 2. Kontrak API

Notasi izin mengikuti `config/permissions.php`. "Policy" berarti selain izin, berlaku aturan objek dari `AlertPolicy` atau `BriefingPolicy`.

### 2.1 Autentikasi dan pengguna (B)

| Rute | Izin | Catatan |
|---|---|---|
| `POST /auth/login` | publik, throttle 5/menit per IP+email | Body `{email, password}`. Mengembalikan `{token, user}`. Menolak pengguna nonaktif |
| `POST /auth/logout` | login | Mencabut token aktif |
| `GET /auth/me` | login | `{user, role, permissions[]}` |
| `GET /users` | `users.view` | |
| `POST /users` | `users.manage` | |
| `PATCH /users/{id}` | `users.manage` | Ubah nama, peran, `is_active`. Admin tidak boleh menonaktifkan dirinya sendiri (422) |

### 2.2 Sumber dan impor (A)

| Rute | Izin | Catatan |
|---|---|---|
| `GET /sources` | `sources.view` | |
| `POST /sources` | `sources.manage` | Validasi `config` sesuai `type` |
| `PATCH /sources/{id}` | `sources.manage` | |
| `POST /sources/{id}/test` | `sources.manage` | Uji koneksi, simpan `last_status` |
| `POST /sources/{id}/import` | `sources.manage` | Multipart CSV, maksimum 10 MB dan 50.000 baris. Header divalidasi |
| `GET /sources/{id}/imports` | `sources.view` | Riwayat `import_batches` |

### 2.3 Topik dan akun resmi (A)

| Rute | Izin | Catatan |
|---|---|---|
| `GET /topics` | `topics.view` | Semua topik; templat (`is_template`) di urutan terakhir |
| `POST /topics` | `topics.manage` | Kata kunci berisi `[` atau `]` ditolak 422 (PRD §9.8), kata kunci tanpa huruf atau angka ditolak. Memicu pencocokan ulang topik. Audit `topic.create` |
| `PATCH /topics/{id}` | `topics.manage` | Termasuk menonaktifkan. Templat tidak bisa diubah (422 `template_readonly`). Kata kunci atau status aktif yang berubah memicu pencocokan ulang. Audit `topic.update` |
| `GET /topics/{id}/metrics?from&to` | `topics.view` | Deret `metrics_hourly`. `from`/`to` `Y-m-d` UTC, `to` mencakup harinya, maksimum 31 hari. Bawaan: 7 hari yang berakhir pada hari metrik terakhir. `meta`: `from`, `to` (tidak ikut dihitung), `total`, `has_simulated_data` |
| `GET /official-accounts` | `topics.view` | Urut `handle` |
| `POST /official-accounts` | `topics.manage` | `handle` unik. Audit `official_account.create` |
| `DELETE /official-accounts/{id}` | `topics.manage` | 204. Audit `official_account.delete` |

Perilaku rinci, bentuk respons metrik, dan aturan validasi: `docs/PIPELINE.md`.

**Kontrak pipeline untuk penulis `raw_items`** (impor CSV, `RssIngestor`, `YoutubeIngestor`, `ReplayRunner`):

- `payload` berbentuk kanonik: `text`, `account_handle`, `posted_at` wajib; `external_id`, `account_display_name`, `account_created_at` opsional. Waktu dalam ISO 8601 dengan zona waktu.
- Setelah menulis, panggil `NormalizePostsJob::dispatch()`.
- `sources.type` dan `sources.is_simulated` menentukan `accounts.source_type` dan `posts.is_simulated`.

### 2.4 Dasbor (C)

| Rute | Izin | Catatan |
|---|---|---|
| `GET /dashboard/summary` | `dashboard.view` | Diskop per peran (lihat 3.1) |
| `GET /dashboard/issues` | `dashboard.view` | Daftar isu berperingkat, diskop per peran |

### 2.5 Alert dan triase (B)

| Rute | Izin | Catatan |
|---|---|---|
| `GET /alerts` | `alerts.view` | Filter `status`, `severity`, `kind`. Pimpinan dibatasi policy |
| `GET /alerts/{id}` | `alerts.view` + policy | Detail, bukti, dan `actions` |
| `POST /alerts/{id}/take` | `alerts.triage` | `new` → `reviewing` |
| `POST /alerts/{id}/escalate` | `alerts.triage` | Body `{recommendation, note?}` |
| `POST /alerts/{id}/false-positive` | `alerts.triage` | Body `{note}` |
| `POST /alerts/{id}/close` | `alerts.triage` | Body `{note}` |
| `POST /alerts/{id}/approve` | `alerts.decide` | Body `{note?}` |
| `POST /alerts/{id}/return` | `alerts.decide` | Body `{note}` |
| `POST /alerts/{id}/comments` | `alerts.view` + policy | Body `{note}`. Tidak mengubah status |

Aturan transisi dan kode status ada di PRD §8.5. Setiap aksi menulis tepat satu baris `alert_actions` dan satu baris `audit_logs` dalam transaksi yang sama.

### 2.6 Briefing dan audit (B)

| Rute | Izin | Catatan |
|---|---|---|
| `GET /briefings` | `briefings.view` | Pimpinan hanya melihat yang alert-nya terlihat baginya |
| `POST /alerts/{id}/briefings` | `briefings.create` | Alert tidak boleh berstatus `new`. Menghasilkan PDF |
| `GET /briefings/{id}/download` | `briefings.download` + policy | Mencatat `briefing.download` |
| `GET /audit-logs` | `audit.view` | Filter `user_id`, `action`, `from`, `to` |

### 2.7 Replay (A)

| Rute | Izin | Catatan |
|---|---|---|
| `GET /replay/scenarios` | `replay.manage` | |
| `POST /replay/scenarios` | `replay.manage` | Unggah CSV skenario |
| `POST /replay/scenarios/{id}/start` | `replay.manage` | Body `{speed_factor?}` |
| `POST /replay/scenarios/{id}/stop` | `replay.manage` | |

### 2.8 Pengaturan, pelabelan, evaluasi, dan sistem (C)

| Rute | Izin | Catatan |
|---|---|---|
| `GET /settings/detection` | `settings.manage` | |
| `PUT /settings/detection` | `settings.manage` | Validasi rentang nilai. Mencatat `settings.update` |
| `GET /labeling/posts` | `labels.manage` | Paginasi, filter `unlabeled` |
| `PUT /labeling/posts/{id}` | `labels.manage` | Body `{label_manual: "organic" \| "anomalous" \| null}` |
| `GET /evaluation/runs` | `evaluation.view` | |
| `POST /evaluation/run` | `evaluation.run` | Body `{scenario_id?}` |
| `GET /system/status` | `system.status` | Kesehatan sumber, antrean, jumlah data |

---

## 3. Bentuk payload kunci

### 3.1 `GET /auth/me`

```json
{ "data": {
    "user": { "id": 2, "name": "Analis Demo", "email": "analyst@radarisu.test" },
    "role": { "slug": "analyst", "name": "Analis" },
    "permissions": ["topics.view", "topics.manage", "dashboard.view", "alerts.view", "alerts.triage"]
} }
```

### 3.2 `GET /dashboard/summary`

```json
{ "data": {
    "active_issues": 3,
    "highest_severity": "high",
    "awaiting_decision": 1,
    "trend_24h": [ { "hour": "2026-10-22T08:00:00Z", "volume": 42 } ],
    "data_notice": { "has_simulated_data": true }
} }
```

Untuk Pimpinan, hanya alert `escalated`, `approved`, dan `returned` yang dihitung. Untuk Analis, semua alert terbuka.

### 3.3 `GET /alerts/{id}`

Contoh di bawah sudah dikoreksi. Di PRD sebelumnya tertulis skor 82, padahal jumlah komponennya 65.

```json
{ "data": {
    "id": 17, "kind": "issue", "status": "escalated", "score": 65, "severity": "medium",
    "topic": { "id": 4, "name": "Isu terhadap [institusi]" },
    "score_breakdown": {
      "spike":     { "raw": 5.1,  "weight": 40, "value": 34.0 },
      "anomaly":   { "raw": 0.40, "weight": 30, "value": 12.0 },
      "sentiment": { "raw": 0.62, "weight": 20, "value": 12.4 },
      "reach":     { "raw": 0.67, "weight": 10, "value": 6.7 },
      "thresholds": { "z": 3.0, "severity_medium": 40, "severity_high": 70 }
    },
    "evidence": [
      { "reason": "similar_text", "account": { "handle": "@akun_a" },
        "post": { "text": "..." }, "detail": { "similarity": 0.91 } }
    ],
    "actions": [
      { "action": "escalate", "user": "Analis Demo", "note": "...", "created_at": "..." }
    ],
    "recommendation": "..."
} }
```

---

## 4. Kontrak service (antarmuka kode)

Semua fungsi penilaian dibuat sebagai fungsi murni: tanpa akses database, tanpa `now()`, dan threshold dari argumen. Dengan begitu bisa diuji tanpa database dan bisa dipakai sebelum