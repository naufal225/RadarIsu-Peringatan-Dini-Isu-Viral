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
| `GET /topics/{id}/spike-baseline?hours=72` | `topics.view` | Data grafik lonjakan: keputusan detektor saat ini dan volume per jam. Bentuk di 3.6 |
| `GET /topics/{id}/coordination` | `alerts.triage` | Klaster teks hampir identik yang dilihat detektor koordinasi sekarang. Hanya-baca, hanya Analis. Bentuk di 3.7 |
| `GET /official-accounts/lookalikes` | `alerts.triage` | Akun yang mirip akun resmi saat ini (detektor peniruan), terpaginasi: `page`, `per_page` (1-100), `official_account_id`. Hanya-baca, hanya Analis. Bentuk di 3.9 |
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

Bentuk dan perilaku (F11):

- `GET /replay/scenarios?per_page=` → `{data: [ReplayScenario], meta: {current_page, last_page, per_page, total, clock_now, data_now}}`. `clock_now` adalah `settings.replay.clock.now` (null bila tidak ada Replay berjalan), `data_now` adalah `DataClock::now()`. `ReplayScenario`: `id, name, description, total_rows, incident_start_offset_seconds, default_speed_factor, status (idle|running|finished|stopped), speed_factor, run_number, progress_rows, started_at, virtual_anchor_at, heartbeat_at, finished_at, error, source_id, created_at`. Bungkus `data` ada di semua respons skenario tunggal.
- `POST /replay/scenarios` (multipart: `file`, `name`, `description?`, `incident_start_offset_seconds?`, `default_speed_factor?`) → 201. Kolom CSV dan galat berkas: OPEN_QUESTIONS #27.
- `POST .../start` `{speed_factor?}` (1–100000, bawaan `default_speed_factor`) → 202 dan job di antrean `replay`. 409 `already_running` | `another_running` | `empty_scenario`. Audit `replay.start`.
- `POST .../stop` → 200; 409 `not_running`. Audit `replay.stop`. Runner melihat status berubah dan menutup sendiri (jam direset).
- Untuk F14: posting Replay berlabel lewat `posts.label_manual`; `external_id = replay:{scenario_id}:{run_number}:{replay_row_id}`; waktu deteksi = `alerts.detected_at - (replay_scenarios.virtual_anchor_at + incident_start_offset_seconds)` untuk putaran terakhir (`run_number`).

### 2.8 Pengaturan, pelabelan, evaluasi, dan sistem (C)

| Rute | Izin | Catatan |
|---|---|---|
| `GET /settings/detection` | `settings.manage` | Bentuk di 3.4 |
| `PUT /settings/detection` | `settings.manage` | Mengganti seluruh nilai, semua kunci wajib. Validasi rentang dan aturan antar-field di `docs/DETECTION_SETTINGS.md`. Mencatat `settings.update` hanya bila ada nilai yang berubah |
| `GET /settings/offline-mode` | `settings.manage` | Bentuk di 3.5 |
| `PUT /settings/offline-mode` | `settings.manage` | `{"enabled": bool}` strict. Audit `settings.update` hanya bila berubah |
| `GET /labeling/posts` | `labels.manage` | Paginasi (`per_page` ≤ 100, `page`). Filter: `status=all\|unlabeled\|labeled`, `label=organic\|anomalous`, `is_simulated`, `topic_id`. Urutan `posted_at` terbaru. Respons `data[]`: `id, text, posted_at, sentiment, label_manual, is_simulated, account{id,handle,display_name}, topics[{id,name}]`; `meta.progress`: `{labeled, organic, anomalous, target: 200}` (hitungan seluruh posting, bukan hasil filter) |
| `PUT /labeling/posts/{id}` | `labels.manage` | Body `{label_manual: "organic" \| "anomalous" \| null}`; kunci wajib ada, `null` (juga string kosong) menghapus label. Respons 200 `data` berisi posting. Audit `label.set` `{from, to}` hanya bila nilai berubah |
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

### 3.4 `GET /settings/detection` dan `PUT /settings/detection`

`PUT` menerima isi `data.value` apa adanya dan mengembalikan bentuk yang sama dengan `GET`. Arti tiap kunci ada di `docs/DETECTION_SETTINGS.md`.

```json
{ "data": {
    "key": "detection",
    "value": {
      "coordination_window_minutes": 15, "z_threshold": 3.0, "min_volume": 20,
      "baseline_hours": 168, "min_baseline_hours": 24,
      "similarity_threshold": 0.8, "min_accounts_cluster": 5, "young_account_days": 30,
      "impersonation_threshold": 0.6,
      "spike_current_window_minutes": 60, "spike_sample_limit": 10,
      "synchronized_window_minutes": 5, "synchronized_ratio": 0.8,
      "impersonation_window_hours": 24,
      "cooldown_minutes": 60, "coordination_max_posts": 2000,
      "weights": { "spike": 40, "anomaly": 30, "sentiment": 20, "reach": 10 },
      "severity_cutoffs": { "medium": 40, "high": 70 },
      "sensitivity_z_offset": { "low": 1.0, "medium": 0.0, "high": -0.5 }
    },
    "updated_at": "2026-10-23T09:00:00Z",
    "updated_by": { "id": 1, "name": "Admin Demo" }
} }
```

`updated_at` dan `updated_by` bernilai `null` sebelum pernah diubah. Galat validasi memakai bentuk 422 biasa, dengan nama field bertitik (`weights`, `weights.spike`, `severity_cutoffs.medium`).

### 3.5 `GET /settings/offline-mode` dan `PUT /settings/offline-mode`

Izin `settings.manage`. `PUT` menerima `{"enabled": true|false}` (boolean sebenarnya, selain itu 422) dan mengembalikan bentuk yang sama dengan `GET`:

```json
{ "data": { "key": "offline_mode", "value": { "enabled": false }, "updated_at": null, "updated_by": null } }
```

Audit `settings.update` dengan `detail.key = "offline_mode"` hanya bila nilainya berubah. Status keputusan: menunggu persetujuan (`docs/OPEN_QUESTIONS.md` #6).

### 3.6 `GET /topics/{id}/spike-baseline?hours=72`

Izin `topics.view`. `hours` 6-168 (bawaan 72), di luar itu 422. Data di balik grafik lonjakan; tidak memuat alert, sehingga tidak ada data yang dibatasi per peran.

```json
{ "data": {
    "topic_id": 3, "as_of": "2026-10-26T12:30:00Z",
    "spike": {
      "triggered": true, "status": "triggered", "has_sufficient_baseline": true,
      "current": 64, "current_rate": 64.0, "mean": 5.0, "std": 0.0, "z": 59.0, "z_effective": 3.0,
      "baseline_hours": 48, "threshold_rate": 8.0,
      "thresholds": { "z_threshold": 3.0, "sensitivity": "medium", "sensitivity_z_offset": 0.0, "z_effective": 3.0,
                      "min_volume": 20, "min_baseline_hours": 24, "baseline_window_hours": 168, "current_window_minutes": 60 }
    },
    "series": [ { "hour": "2026-10-26T12:00:00Z", "volume": 60, "is_running_hour": true } ]
} }
```

`status`: `triggered`, `below_threshold`, `below_min_volume`, `insufficient_baseline`. `series` berisi satu baris per jam (jam tanpa posting bernilai 0), jam terakhir adalah jam berjalan. `as_of` adalah jam data (`DataClock`), bukan selalu jam dinding.

### 3.7 `GET /topics/{id}/coordination`

Izin `alerts.triage` (hanya Analis; Pimpinan dan Admin 403). Hanya-baca: tidak membuat alert dan tidak menulis metrik. Menampilkan apa yang dilihat detektor koordinasi pada jendela data saat ini.

```json
{ "data": {
    "topic_id": 3, "as_of": "2026-10-26T12:30:00Z", "triggered": true,
    "window": { "from": "2026-10-26T12:15:00Z", "to": "2026-10-26T12:30:00Z" },
    "posts_in_window": 55, "accounts_in_window": 55, "truncated": false,
    "thresholds": { "similarity_threshold": 0.8, "min_accounts_cluster": 5, "coordination_window_minutes": 15,
                    "young_account_days": 30, "synchronized_window_minutes": 5, "synchronized_ratio": 0.8 },
    "clusters": [ {
      "cluster_id": 1, "accounts_count": 40, "posts_count": 40, "similarity_min": 0.88, "similarity_max": 0.97,
      "from": "2026-10-26T12:21:00Z", "to": "2026-10-26T12:27:00Z",
      "synchronized": { "is_synchronized": true, "ratio": 0.85, "posts_in_window": 34, "window_minutes": 5 },
      "sample_text": "waspada ...",
      "accounts": [ { "id": 11, "handle": "@demo_koordinasi_1", "similarity": 0.93, "young": true, "age_days": 3.0, "synchronized": true, "posts_count": 1 } ]
    } ]
} }
```

`accounts` memuat paling banyak 100 akun per klaster; `accounts_count` selalu jumlah penuh. `sample_text` dipotong 280 karakter.

### 3.8 Bukti alert dari detektor (`alert_evidence.detail`)

Angka di balik tiap bukti, agar analis tahu mengapa sesuatu ditandai. Struktur `detail` tidak dibakukan di PRD; ini yang ditulis detektor:

| `reason` | Isi `detail` |
|---|---|
| `spike_sample` | `rank`, `posted_at`, `current`, `current_rate`, `baseline_mean`, `baseline_std`, `baseline_hours`, `z`, `thresholds` (`z_effective`, `min_volume`, ...) |
| `similar_text` | `similarity`, `account_posts`, `cluster_id`, `seed_post_id`, `cluster_accounts`, `cluster_posts`, `window`, `truncated`, `thresholds` |
| `young_account` | `account_age_days`, `young_account_days`, serta `cluster_id`, `seed_post_id`, `cluster_accounts`, `cluster_posts`, `window`, `truncated`, `thresholds` |
| `synchronized_posting` | `synchronized` (`is_synchronized`, `ratio`, `posts_in_window`, `window_minutes`), serta `cluster_id`, `seed_post_id`, `cluster_accounts`, `cluster_posts`, `window`, `truncated`, `thresholds` |
| `name_similarity` | `similarity`, `field` (`handle`/`display_name`), `reading` (`base`, `alt:1`, `stripped`), `compared` (`account`, `official`: kedua string yang dibandingkan), `same_name`, `rules` (aturan normalisasi yang menghasilkan bacaan itu), `official` (`id`, `handle`, `display_name`), `other_matches` (`official_id`, `handle`, `similarity`, `field`), `account_first_seen_at`, `thresholds` (`impersonation_threshold`, `young_account_days`, `impersonation_window_hours`) |
| `young_account` (alert peniruan) | `account_age_days`, `young_account_days`, `official`, `account_first_seen_at`, `thresholds` |

### 3.9 `GET /official-accounts/lookalikes`

Izin `alerts.triage` (hanya Analis; Pimpinan dan Admin 403). Hanya-baca: tidak membuat alert. Terurut dari kemiripan tertinggi, lalu id akun. Query: `page` (>= 1), `per_page` (1-100, bawaan 25), `official_account_id` (harus ada), selain itu 422.

```json
{ "data": [ {
    "account": { "id": 21, "handle": "@demo_kodam_official", "display_name": "Demo Kodam Contoh",
                 "first_seen_at": "2026-10-26T10:30:00Z", "platform_created_at": "2026-10-23T12:30:00Z" },
    "official": { "id": 1, "handle": "@demo_kodam", "display_name": "Demo Kodam Contoh" },
    "similarity": 1.0, "field": "handle", "reading": "stripped", "same_name": true,
    "rules": [ { "rule": "affix_stripped", "value": "official", "position": "suffix" } ],
    "other_matches": [ { "official_id": 2, "handle": "@demo_humas_kodam", "similarity": 0.64, "field": "handle" } ],
    "young": true, "age_days": 3.0,
    "alert": { "id": 7, "status": "new" }
} ],
  "meta": { "current_page": 1, "last_page": 1, "per_page": 25, "total": 1, "as_of": "2026-10-26T12:30:00Z",
            "window": { "from": "2026-10-25T12:30:00Z", "to": "2026-10-26T12:30:00Z" }, "officials_count": 2 } }
```

`rules` memakai nama: `unicode_folded`, `separators_removed`, `confusable_chars` (`pairs`), `affix_stripped` (`value`, `position`), `trailing_digits_stripped` (`value`). `alert` adalah alert terbuka akun itu, atau `null`.

---

## 4. Kontrak service (antarmuka kode)

`Setting::detection(): array` mengembalikan ambang dan bobot terkini (kontrak F15 → domain A). Detektor memanggilnya sekali per eksekusi dan meneruskan nilainya sebagai argumen ke fungsi murni di bawah, bukan membaca konstanta sendiri. Tidak di-cache.


Semua fungsi penilaian dibuat sebagai fungsi murni: tanpa akses database, tanpa `now()`, dan threshold dari argumen. Dengan begitu bisa diuji tanpa database dan bisa dipakai sebelum

### 4.1 Detektor dan penulis alert (A → B), diisi saat F3, F4, dan F13

- `DataClock::now()`: jam yang dibaca detektor (`settings.replay.clock.now`, bila tidak null, selain itu jam dinding UTC). Detektor tidak memanggil `now()` sendiri.
- `SpikeDetector::evaluate(int $current, array $baseline, array $settings, string $sensitivity): array` murni: keputusan lonjakan, `z`, `z_effective`, `mean`, `std`, `threshold_rate`, dan `thresholds` yang dipakai. Tidak ada akses database.
- `ThreatScorer::score(...)` (domain C) menghitung skor alert `issue` dari hasil detektor dan `Setting::detection()`.
- `AlertWriter::upsertIssue($topicId, $scored, $windowStart, $windowEnd, $detectedAt, $evidence, $cooldownMinutes, $evidenceLimits)`: satu-satunya jalan detektor membuat atau memperbarui alert `issue` (PRD §10.9). Satu alert terbuka per topik dijamin indeks unik parsial `alerts_open_issue_uq` (upsert dengan `ON CONFLICT`); bukti ganda ditolak indeks `alert_evidence_dedup_uq`. Tidak pernah mengubah `status` dan tidak menulis `alert_actions`. Mengembalikan `outcome` `created|updated|cooldown`.
- `DetectJob` (`ShouldBeUnique`, `tries` 3, `backoff` 10/30/60 detik, `timeout` 120 detik) dijalankan oleh `radarisu:detect` setiap menit. F4 dan F13 menambah detektornya ke job yang sama.
- `IssueDetectionService::run()` (F4) menjalankan satu pass untuk semua topik aktif: koordinasi dulu (menulis `metrics_hourly.anomalous_accounts`), lalu keputusan lonjakan, lalu satu skor dan satu `upsertIssue` per topik. Alert dibuat bila lonjakan **atau** koordinasi terpicu, jadi satu topik tidak punya dua alert yang bersaing. Menggantikan `SpikeDetectionService::run()` dari F3; `SpikeDetectionService` kini hanya membaca data dan mengembalikan keputusan (`snapshots()`, `samples()`).
- `CoordinationDetector::detect($posts, $pairs, $settings)` murni: klaster berbasis seed, akun berbeda minimum, `young_account`, `synchronized_posting`. `CoordinationDetectionService` mencari pasangan lewat `pg_trgm` (tabel sementara berindeks GIN) dan menulis `anomalous_accounts`.
- `AlertWriter::upsertImpersonation($subjectAccountId, $scored, $windowStart, $windowEnd, $detectedAt, $evidence, $cooldownMinutes, $refreshReasons)` (F13): jalan yang sama dengan `upsertIssue`, untuk alert `impersonation` per akun (indeks unik `alerts_open_impersonation_uq`). Bukti pada `$refreshReasons` (bawaan `name_similarity`, `young_account`) ditulis ulang di tempat dan baris yang tidak lagi benar dihapus; bukti lain tetap tambah-saja.
- `AccountNameNormalizer` (murni, digerakkan `config/impersonation.php`) menghasilkan bacaan nama; `ImpersonationDetector::decide(...)` (murni) memutuskan dari kemiripan yang dihitung pg_trgm; `ImpersonationDetectionService::run()` membaca akun yang pertama kali terlihat dalam `impersonation_window_hours`, menghitung `similarity()` di database, menilai dengan `ThreatScorer::scoreImpersonation`, dan menulis lewat `AlertWriter`. `DetectJob` menjalankan `IssueDetectionService` lalu `ImpersonationDetectionService`.
