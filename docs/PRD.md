# PRD — RadarIsu (v2.2, siap dieksekusi AI coding agent)

**Sistem Peringatan Dini Isu, Koordinasi Akun, dan Peniruan Identitas di Ruang Siber Sosial untuk Perlindungan Institusi TNI AD**

| | |
|---|---|
| Ajang | Kartika Cyber Hackathon 2026, Kategori 04 Siber Sosial |
| Tim | 3 orang |
| Target | Prototipe jadi dan terintegrasi, target juara |
| Backend | Laravel 13 (PHP 8.3), Laravel Sanctum, Laravel Queue (driver database) |
| Frontend | Next.js 16.4 (App Router, TypeScript, folder `src/`), Tailwind CSS, TanStack Query, Recharts |
| Database | PostgreSQL 16 + ekstensi `pg_trgm` |
| Status | Draf 2.2. Juknis teknis lengkap belum dibaca; asumsi ditandai **[ASUMSI]** |

### Riwayat perubahan

**v2.4 (2026-11-14)** — arah visual UI (lintas-fase, tidak menyentuh fase deteksi):

1. **Arah UI diganti ke "Cyber"**: tema gelap, aksen cyan, glow terbatas untuk status fokus dan alert kritis. Menggantikan "Lembar Situasi" di `docs/UI_DESIGN_SYSTEM.md` §1. Gradien dan warna hijau tetap dilarang. Nilai token menyusul di tahap desain. Amendemen ini menunggu review semua pemilik (OWNERSHIP).
2. Entri v2.3 yang direncanakan di `docs/UI_WORKPLAN.md` §11c belum pernah ditulis. Keputusan visual sebelumnya tidak tercatat di PRD.

**v2.2 (2026-10-21)** — keputusan untuk Fase 2:

1. **Format CSV impor** ditetapkan sama dengan `replay_rows`, beserta aturan baris, kode galat, dan duplikat (§11.4).
2. **Penarikan terjadwal RSS/YouTube** dipindah tegas ke Fase 3. Fase 2 hanya mencakup CRUD sumber dan uji koneksi (§11.5, §18).
3. **Halaman admin minimal** (`/admin/users`, `/admin/sources`, `/admin/audit`, `/admin/status`) dikerjakan di Fase 2. Poles visualnya tetap Fase 8 (§18).
4. **`GET /system/status`** masuk Fase 2 (§18).
5. **Keamanan:** proteksi SSRF untuk URL sumber, trigger append-only untuk `audit_logs`/`alert_actions`, dan sesi Postgres dikunci ke UTC (§13).

**v2.1 (2026-10-21)** — keputusan atas `docs/OPEN_QUESTIONS.md` setelah Fase 1:

1. **Versi stack** mengikuti yang terpasang: Laravel 13 (sebelumnya 11) dan Next.js 16 (sebelumnya 15). Kode frontend ada di `frontend/src/`, dan `middleware.ts` Next diganti `src/proxy.ts` (§7, §12.1).
2. **Fase 0 dan 1 tumpang tindih.** Fase 1 dimulai sebelum gerbang Fase 0 lulus. `docker-compose.yml` dibuat setelah Fase 1 untuk menutup DoD Fase 0 (§18).
3. **Rute fase berikutnya berupa stub 501** dengan body `{"message":"Belum diimplementasikan","meta":{"pending_phase":N}}`. Pemeriksaan izin dan policy tetap berjalan sebelum stub. Pada matriks §19.1, tanda ✔ berarti status ≠ 403 dan ≠ 404 (§11, §19.1).
4. **Urutan pemeriksaan endpoint alert:** middleware izin → 403, policy `view` → **404** bila alert tidak terlihat, lalu state machine → 422. Sebelumnya §19.2 butir 3 mengharapkan 422 (§8.4, §19.1, §19.2).
5. **Tes §19.2 butir 8** (detektor tidak membuat alert ganda) tetap *incomplete* sampai Fase 4.
6. **`AuditLogger` versi minimal masuk Fase 1** (§18).
7. **Tes larangan admin menonaktifkan diri sendiri** diperketat: token dan sesi tetap utuh, dan tidak ada baris audit (§19.1).
8. **Keamanan Fase 1:** Laravel hanya memercayai `X-Forwarded-For` dari alamat BFF (`TRUSTED_PROXIES`). BFF menimpa header itu dengan alamat koneksinya sendiri (§13).
9. **Tes frontend memakai Vitest.** `frontend/src/lib/permissions.ts` di-generate dari `backend/config/permissions.php` (§12.1).
10. **Dependensi frontend** di §12.1 dipasang saat pertama kali dipakai.
11. **Topik dari templat** ditolak bila keyword masih mengandung `[` atau `]`. Topik baru baru aktif setelah lolos validasi ini (§9.8, §11).
12. Bila `backend/CLAUDE.md` bertentangan dengan root `CLAUDE.md`, aturan root yang berlaku. `laravel/boost` tidak dipasang.

---

## 0. Cara memakai dokumen ini (untuk AI coding agent)

1. Dokumen ini adalah **sumber kebenaran**. Jangan menambah fitur di luar bagian 6.1. Item bagian 6.2 hanya boleh dikerjakan setelah Gerbang 2 lolos (bagian 18).
2. **Konvensi penamaan:** semua identifier kode (tabel, kolom, enum, route, variabel) memakai **bahasa Inggris snake_case**. Semua teks yang dibaca pengguna memakai **bahasa Indonesia** melalui peta label (bagian 14). Jangan menulis string Indonesia langsung di logika bisnis.
3. **Otorisasi selalu ditegakkan di server (Laravel).** Frontend hanya menyembunyikan elemen UI demi kenyamanan, bukan keamanan.
4. Kerjakan per **fase** (bagian 18). Tiap fase punya Definition of Done (DoD). Jangan lanjut sebelum tes fase itu lulus.
5. Bila ada ketidakjelasan, ikuti dokumen ini. Bila dokumen bertentangan dengan juknis resmi, **tandai konfliknya di komentar kode atau catatan PR**, jangan menebak.
6. Semua ambang deteksi disimpan di tabel `settings` (bukan di-hardcode) agar bisa dikalibrasi.
7. Jangan mengirim data postingan ke layanan eksternal mana pun (kecuali penarikan dari sumber yang dikonfigurasi). Tidak ada panggilan ke LLM/API pihak ketiga di fitur wajib.

---

## 1. Ringkasan produk

RadarIsu memantau **data publik** (komentar, postingan, berita), mendeteksi tiga jenis sinyal, lalu mengalirkannya melalui alur keputusan institusional:

1. **Lonjakan isu** (volume topik melonjak dibanding baseline)
2. **Koordinasi akun** (teks hampir identik dari banyak akun dalam waktu singkat, sering dengan akun baru)
3. **Potensi peniruan identitas** (akun baru yang namanya mirip akun resmi)

Alur: **sistem mendeteksi → Analis meninjau dan mengeskalasi → Pimpinan memutuskan → briefing PDF dihasilkan**, seluruhnya tercatat di audit log.

Sistem **tidak** menyatakan sebuah klaim sebagai "hoaks" dan tidak menyatakan akun sebagai "bot pasti". Sistem menandai **pola tidak wajar** beserta bukti, keputusan akhir ada pada manusia.

## 2. Masalah dan kasus penggunaan untuk TNI AD

Kriteria utama juri adalah kesesuaian dengan kebutuhan pengamanan IT/OT TNI AD. Ruang siber sosial relevan karena menjadi jalur rekayasa sosial dan pembentukan opini terhadap institusi dan personel. Tiga kasus penggunaan utama (dipakai di proposal, demo, dan templat topik):

| ID | Kasus penggunaan | Sinyal yang dipakai |
|---|---|---|
| UC1 | **Narasi terkoordinasi terhadap institusi atau satuan**: kampanye opini atau disinformasi yang menyasar TNI AD, satuan, atau kebijakan | Lonjakan + koordinasi akun + sentimen negatif |
| UC2 | **Akun palsu mengatasnamakan satuan atau pejabat**: dasar penipuan dan rekayasa sosial | Kemiripan nama terhadap daftar akun resmi + usia akun |
| UC3 | **Indikasi kebocoran informasi satuan (OPSEC) di data publik**: kemunculan istilah sensitif yang ditetapkan satuan | Topik kategori `opsec` dengan istilah yang ditentukan Analis, lonjakan kemunculan |

Catatan etika UC3: sistem hanya mencocokkan istilah yang ditetapkan institusi pada data publik dan melaporkannya sebagai **isu**, bukan memprofilkan individu. Tindak lanjut ke personel dilakukan manusia melalui jalur satuan di luar sistem.

Hubungan dengan IT/OT: personel yang mengoperasikan sistem IT/OT adalah sasaran rekayasa sosial. RadarIsu menjaga lapisan manusia dari sisi informasi publik. Jangan mengklaim lebih dari itu.

## 3. Tujuan dan ukuran keberhasilan

| ID | Tujuan | Ukuran |
|---|---|---|
| T1 | Deteksi lonjakan dini | Waktu deteksi (menit sejak lonjakan dimulai) pada skenario uji dilaporkan |
| T2 | Deteksi koordinasi akun | Presisi, recall, F1 pada ±200 posting berlabel manual |
| T3 | Deteksi peniruan | Seluruh akun tiruan pada skenario uji terdeteksi; false positive dilaporkan |
| T4 | Keputusan terdokumentasi | 100% perubahan status alert tercatat di `alert_actions` dan `audit_logs` |
| T5 | Transparan | Rincian skor dan bukti terlihat di UI untuk setiap alert |
| T6 | Demo andal | Mode Replay berjalan lewat pipeline yang sama dengan sumber live |

## 4. Bukan tujuan

- Menentukan benar atau salahnya sebuah klaim secara otomatis.
- Mengambil data akun privat atau melanggar ketentuan platform.
- Memantau individu secara pribadi atau menindak siapa pun.
- Integrasi ke sistem komando atau jaringan tertutup satuan (hanya disebut di roadmap).

## 5. Klaim inovasi (untuk proposal dan pitch)

1. **Deteksi koordinasi yang dapat dijelaskan:** kombinasi kemiripan teks (trigram), sinkronisasi waktu, dan usia akun. Setiap penandaan disertai alasan yang bisa dibaca manusia.
2. **Deteksi peniruan identitas** terhadap daftar akun resmi satuan, menggunakan kemiripan nama (trigram).
3. **Skor ancaman transparan dan dapat dikalibrasi:** rumus dan bobot terlihat dan dapat diubah Admin dari antarmuka.
4. **Berjalan on-premise tanpa layanan cloud asing**, dengan Mode Offline.
5. **Terukur:** halaman Evaluasi menampilkan presisi, recall, F1, dan waktu deteksi dari data berlabel, termasuk keterbatasannya.

## 6. Ruang lingkup

### 6.1 Wajib selesai (terintegrasi)

| ID | Fitur | Aktor utama |
|---|---|---|
| F1 | Manajemen sumber data + impor CSV | Admin |
| F2 | Topik pantauan + templat UC1–UC3 + daftar akun resmi | Analis |
| F3 | Deteksi lonjakan | Sistem |
| F4 | Deteksi koordinasi akun | Sistem |
| F5 | Sentimen (kamus) | Sistem |
| F6 | Alert, triase, dan komentar | Analis, Pimpinan |
| F7 | Skor ancaman transparan | Sistem |
| F8 | Dasbor situasi | Analis, Pimpinan |
| F9 | Briefing PDF | Analis, Pimpinan |
| F10 | Audit log | Admin |
| F11 | Mode Replay | Admin |
| F12 | Autentikasi dan RBAC | Semua |
| F13 | Deteksi potensi peniruan akun | Sistem |
| F14 | Pelabelan data dan halaman Evaluasi | Analis (label), semua (lihat) |
| F15 | Pengaturan deteksi (kalibrasi ambang dan bobot) | Admin |

### 6.2 Pengerjaan yang ditunda jika waktu masih tersisa (urut prioritas)

1. Notifikasi Telegram untuk alert severity tinggi
2. Graf jaringan penyebaran antar akun
3. Draf klarifikasi otomatis (model bahasa lokal), tetap perlu persetujuan manusia
4. Skor bantu klasifikasi hoaks (model lokal), hanya penunjang
5. Peta sebaran geografis
6. Autentikasi dua faktor
7. PWA mobile

---

## 7. Arsitektur

```
Next.js (browser)
   │  fetch /api/*  (same-origin)
   ▼
Next.js Route Handlers (BFF proxy)  ── menyisipkan  Authorization: Bearer <token dari cookie httpOnly>
   │
   ▼
Laravel API  /api/v1/*   (Sanctum, middleware permission, policies)
   │
   ├── PostgreSQL (data, antrean, cache)
   ├── Queue worker (php artisan queue:work)
   └── Scheduler (php artisan schedule:work)
```

**Keputusan otentikasi (final):** Laravel Sanctum **personal access token** (bearer). Token disimpan Next.js di cookie `rd_token` (`httpOnly`, `secure` di produksi, `sameSite=lax`, masa berlaku 8 jam). Browser tidak pernah melihat token. Semua panggilan API dari browser lewat `/api/*` (Route Handler Next.js) yang meneruskan ke Laravel. Dengan begitu tidak ada masalah CORS atau cookie lintas domain.

Struktur repo (monorepo):

```
radarisu/
├── backend/            # Laravel
│   ├── app/
│   │   ├── Http/Controllers/Api/V1/
│   │   ├── Http/Middleware/EnsurePermission.php
│   │   ├── Models/
│   │   ├── Policies/AlertPolicy.php
│   │   ├── Services/
│   │   │   ├── Alerts/AlertStateMachine.php
│   │   │   ├── Detection/{SpikeDetector,CoordinationDetector,ImpersonationDetector,ThreatScorer,SentimentAnalyzer,TopicMatcher,DataClock}.php
│   │   │   ├── Ingest/{RssIngestor,YoutubeIngestor,CsvImporter,ReplayRunner}.php
│   │   │   └── Audit/AuditLogger.php
│   │   ├── Jobs/
│   │   └── Console/Commands/
│   ├── config/permissions.php
│   ├── database/{migrations,seeders}
│   ├── resources/lexicon/id_sentiment.csv
│   └── tests/{Feature,Unit}
├── frontend/           # Next.js 16
│   ├── server.mjs      # custom server: menimpa X-Forwarded-For dengan alamat soket (§13)
│   └── src/
│       ├── app/{(auth)/login, (app)/..., api/[...path]/route.ts, api/auth/login/route.ts, api/auth/logout/route.ts}
│       ├── lib/{api.ts, server-api.ts, permissions.ts (di-generate), labels.ts}
│       └── proxy.ts    # pengganti middleware.ts di Next 16
├── docker/nginx/default.conf
├── docker-compose.yml
└── docs/               # PRD, ERD, arsitektur, panduan instalasi
```

---

## 8. Hak akses (RBAC)

### 8.1 Peran

| slug | Label UI | Tujuan |
|---|---|---|
| `admin` | Admin Sistem | Menjaga sistem, sumber, pengguna, kalibrasi |
| `analyst` | Analis | Mengelola topik, meninjau dan mengeskalasi alert, menyusun briefing, memberi label |
| `leader` | Pimpinan | Melihat situasi, memutuskan isu yang dieskalasi, mengunduh briefing |

### 8.2 Izin (`permissions.slug`)

`system.status`, `users.view`, `users.manage`, `sources.view`, `sources.manage`, `replay.manage`, `audit.view`, `settings.manage`, `topics.view`, `topics.manage`, `dashboard.view`, `alerts.view`, `alerts.triage`, `alerts.decide`, `briefings.view`, `briefings.create`, `briefings.download`, `labels.manage`, `evaluation.view`, `evaluation.run`

### 8.3 Matriks peran → izin (seed di `config/permissions.php`)

| Izin | admin | analyst | leader |
|---|:-:|:-:|:-:|
| system.status | ✔ | | |
| users.view / users.manage | ✔ | | |
| sources.view / sources.manage | ✔ | | |
| replay.manage | ✔ | | |
| audit.view | ✔ | | |
| settings.manage | ✔ | | |
| topics.view | | ✔ | ✔ |
| topics.manage | | ✔ | |
| dashboard.view | | ✔ | ✔ |
| alerts.view | | ✔ | ✔ |
| alerts.triage | | ✔ | |
| alerts.decide | | | ✔ |
| briefings.view | | ✔ | ✔ |
| briefings.create | | ✔ | |
| briefings.download | | ✔ | ✔ |
| labels.manage | | ✔ | |
| evaluation.view | ✔ | ✔ | ✔ |
| evaluation.run | ✔ | ✔ | |

### 8.4 Aturan tingkat objek (policy)

`AlertPolicy`:

- `view(alert)`: `analyst` → semua alert. `leader` → hanya alert berstatus `escalated`, `approved`, `returned`; alert lain → **404** agar keberadaannya tidak bocor. `admin` → tidak punya `alerts.view`, selalu 403 (oleh middleware).
- **Urutan pemeriksaan** untuk setiap endpoint alert (detail, transisi, komentar, briefing): (a) middleware `permission:*` → **403**; (b) policy `view` → **404** bila alert tidak terlihat bagi pengguna; (c) `AlertStateMachine` (bagian 8.5) → **422** bila transisi tidak valid dari status saat ini atau field wajib kosong.
- `briefings.create`: hanya untuk alert berstatus selain `new`.
- `briefings.download` oleh `leader`: hanya bila alert tersebut terlihat bagi `leader` (aturan `view`).
- Pengguna nonaktif (`users.is_active = false`) tidak bisa login dan tokennya dicabut.
- Admin tidak boleh menonaktifkan atau menurunkan peran dirinya sendiri (422).

### 8.5 Mesin status alert

Status: `new`, `reviewing`, `escalated`, `returned`, `approved`, `false_positive`, `closed`.
Status terbuka (open): `new`, `reviewing`, `escalated`, `returned`.

| Aksi (endpoint) | Dari | Ke | Peran | Syarat |
|---|---|---|---|---|
| `take` | new | reviewing | analyst | mengisi `assigned_to` |
| `escalate` | reviewing, returned | escalated | analyst | `recommendation` wajib diisi |
| `false_positive` | reviewing, returned | false_positive | analyst | `note` wajib |
| `close` | reviewing, returned | closed | analyst | `note` wajib |
| `approve` | escalated | approved | leader | `note` opsional |
| `return` | escalated | returned | leader | `note` wajib (permintaan analisis lanjutan) |
| `comment` | status apa pun selain `new` | tidak berubah | analyst, leader | `note` wajib; leader hanya pada alert yang terlihat baginya |

Setiap aksi menulis satu baris `alert_actions` dan satu baris `audit_logs`. Status `approved`, `false_positive`, `closed` adalah terminal.

---

## 9. Skema database (PostgreSQL)

### 9.0 Ketentuan

- Primary key `bigint` (`id()` Laravel). Waktu memakai `timestamptz`.
- Enum diimplementasikan sebagai `varchar` + **CHECK constraint** (bukan tipe enum Postgres) agar mudah dimigrasi.
- Migrasi pertama: `CREATE EXTENSION IF NOT EXISTS pg_trgm;`
- Kolom `created_at`/`updated_at` ada di semua tabel kecuali yang ditandai *append-only* (hanya `created_at`).

### 9.1 Identitas dan hak akses

**roles**
| Kolom | Tipe | Catatan |
|---|---|---|
| id | bigint PK | |
| slug | varchar(30) | unique; `admin`, `analyst`, `leader` |
| name | varchar(60) | label tampilan |

**permissions**
| Kolom | Tipe | Catatan |
|---|---|---|
| id | bigint PK | |
| slug | varchar(60) | unique (daftar bagian 8.2) |
| name | varchar(100) | |
| group | varchar(40) | untuk pengelompokan |

**permission_role**: `role_id` FK roles, `permission_id` FK permissions, PK (`role_id`, `permission_id`).

**users**
| Kolom | Tipe | Catatan |
|---|---|---|
| id | bigint PK | |
| name | varchar(120) | |
| email | varchar(190) | unique |
| password | varchar(255) | hash bcrypt/argon2 |
| role_id | bigint FK roles | |
| is_active | boolean | default true |
| last_login_at | timestamptz | null |

Tabel bawaan Laravel yang dipakai: `personal_access_tokens` (Sanctum), `jobs`, `failed_jobs`, `cache`, `cache_locks`, `password_reset_tokens` (opsional).

### 9.2 Sumber dan data mentah

**sources**
| Kolom | Tipe | Catatan |
|---|---|---|
| id | bigint PK | |
| type | varchar(10) | CHECK in (`rss`,`youtube`,`csv`,`replay`) |
| name | varchar(120) | |
| config | jsonb | rss: `{"url","max_items"}`; youtube: `{"video_ids":[...]}` (kunci API di `.env`, bukan DB); csv: `{}`; replay: `{}` |
| interval_minutes | int | default 15; null untuk csv/replay |
| is_active | boolean | default true |
| is_simulated | boolean | default false; true untuk sumber `replay` |
| last_fetched_at | timestamptz | null |
| last_status | varchar(10) | `never`,`ok`,`error`; default `never` |
| last_error | text | null |
| created_by | bigint FK users | |

**import_batches**
| Kolom | Tipe | Catatan |
|---|---|---|
| id | bigint PK | |
| source_id | bigint FK sources | |
| filename | varchar(190) | |
| total_rows | int | |
| success_rows | int | |
| failed_rows | int | |
| errors | jsonb | daftar `{row, message}` (maks 200) |
| created_by | bigint FK users | |

**raw_items**: data mentah disimpan apa adanya sebelum diolah.
| Kolom | Tipe | Catatan |
|---|---|---|
| id | bigint PK | |
| source_id | bigint FK sources | index |
| import_batch_id | bigint FK | null |
| external_id | varchar(190) | null |
| payload | jsonb | |
| content_hash | char(64) | sha256 payload; **unique (source_id, content_hash)** |
| fetched_at | timestamptz | |
| processed_at | timestamptz | null; index parsial `WHERE processed_at IS NULL` |

### 9.3 Akun dan postingan

**accounts**
| Kolom | Tipe | Catatan |
|---|---|---|
| id | bigint PK | |
| source_type | varchar(10) | |
| handle | varchar(190) | **unique (source_type, handle)**; index GIN `gin_trgm_ops` |
| display_name | varchar(190) | null; index GIN `gin_trgm_ops` |
| platform_created_at | timestamptz | null (usia akun) |
| first_seen_at | timestamptz | |

**official_accounts**: daftar akun resmi untuk deteksi peniruan.
| Kolom | Tipe | Catatan |
|---|---|---|
| id | bigint PK | |
| handle | varchar(190) | unique |
| display_name | varchar(190) | |
| note | varchar(255) | null |
| created_by | bigint FK users | |

**posts**
| Kolom | Tipe | Catatan |
|---|---|---|
| id | bigint PK | |
| source_id | bigint FK sources | |
| raw_item_id | bigint FK raw_items | null |
| account_id | bigint FK accounts | index |
| external_id | varchar(190) | null; **unique (source_id, external_id) WHERE external_id IS NOT NULL** |
| text | text | teks asli |
| text_norm | text | huruf kecil, tanpa URL, tanda baca dirapikan, spasi diringkas; index GIN `gin_trgm_ops` |
| posted_at | timestamptz | index; untuk Replay berisi waktu virtual |
| sentiment | varchar(10) | null; CHECK in (`positive`,`negative`,`neutral`) |
| sentiment_score | numeric(4,3) | null |
| is_simulated | boolean | default false |
| label_manual | varchar(10) | null; CHECK in (`organic`,`anomalous`) |

### 9.4 Topik dan agregasi

**topics**
| Kolom | Tipe | Catatan |
|---|---|---|
| id | bigint PK | |
| name | varchar(150) | |
| category | varchar(15) | CHECK in (`institution`,`impersonation`,`opsec`,`general`) |
| keywords | jsonb | array string; pencocokan case-insensitive |
| sensitivity | varchar(10) | CHECK in (`low`,`medium`,`high`); default `medium` |
| is_template | boolean | default false |
| is_active | boolean | default true |
| created_by | bigint FK users | null untuk templat seed |

**topic_matches**: `post_id` FK posts, `topic_id` FK topics, PK (`post_id`,`topic_id`), index `topic_id`.

**metrics_hourly**
| Kolom | Tipe | Catatan |
|---|---|---|
| id | bigint PK | |
| topic_id | bigint FK topics | |
| hour | timestamptz | dipotong ke jam; **unique (topic_id, hour)** |
| volume | int | |
| positive_count | int | |
| negative_count | int | |
| neutral_count | int | |
| unique_accounts | int | |
| anomalous_accounts | int | |
| source_count | int | jumlah sumber berbeda |

### 9.5 Alert dan alur kerja

**alerts**
| Kolom | Tipe | Catatan |
|---|---|---|
| id | bigint PK | |
| kind | varchar(15) | CHECK in (`issue`,`impersonation`) |
| topic_id | bigint FK topics | null; wajib bila `kind='issue'` |
| subject_account_id | bigint FK accounts | null; wajib bila `kind='impersonation'` |
| score | smallint | 0–100 |
| severity | varchar(10) | CHECK in (`low`,`medium`,`high`) |
| score_breakdown | jsonb | rincian komponen skor |
| status | varchar(15) | CHECK in (`new`,`reviewing`,`escalated`,`returned`,`approved`,`false_positive`,`closed`); default `new` |
| detected_at | timestamptz | waktu data clock saat pertama terdeteksi |
| window_start | timestamptz | |
| window_end | timestamptz | |
| assigned_to | bigint FK users | null |
| recommendation | text | null |
| escalated_at, decided_at, closed_at | timestamptz | null |

Constraint dan indeks:

```sql
ALTER TABLE alerts ADD CONSTRAINT alerts_kind_subject_chk CHECK (
  (kind = 'issue' AND topic_id IS NOT NULL) OR
  (kind = 'impersonation' AND subject_account_id IS NOT NULL)
);
-- Satu alert terbuka per topik, dan satu per akun tiruan:
CREATE UNIQUE INDEX alerts_open_issue_uq ON alerts (topic_id)
  WHERE kind = 'issue' AND status IN ('new','reviewing','escalated','returned');
CREATE UNIQUE INDEX alerts_open_impersonation_uq ON alerts (subject_account_id)
  WHERE kind = 'impersonation' AND status IN ('new','reviewing','escalated','returned');
CREATE INDEX alerts_status_score_idx ON alerts (status, score DESC);
```

**alert_evidence**
| Kolom | Tipe | Catatan |
|---|---|---|
| id | bigint PK | |
| alert_id | bigint FK alerts | ON DELETE CASCADE; index |
| post_id | bigint FK posts | null |
| account_id | bigint FK accounts | null |
| reason | varchar(30) | CHECK in (`spike_sample`,`similar_text`,`young_account`,`synchronized_posting`,`name_similarity`) |
| detail | jsonb | mis. `{"similarity":0.91,"cluster_id":3}` |

**alert_actions** *(append-only)*
| Kolom | Tipe | Catatan |
|---|---|---|
| id | bigint PK | |
| alert_id | bigint FK alerts | index |
| user_id | bigint FK users | null = aksi sistem |
| action | varchar(20) | CHECK in (`take`,`escalate`,`false_positive`,`close`,`approve`,`return`,`comment`) |
| from_status | varchar(15) | |
| to_status | varchar(15) | null untuk `comment` |
| note | text | null |
| created_at | timestamptz | |

**briefings**
| Kolom | Tipe | Catatan |
|---|---|---|
| id | bigint PK | |
| alert_id | bigint FK alerts | |
| created_by | bigint FK users | |
| title | varchar(200) | |
| summary | text | |
| content | jsonb | `{timeline:[], evidence_ids:[], recommendation, decision}` |
| file_path | varchar(255) | PDF di `storage/app/briefings` |

### 9.6 Audit, replay, evaluasi, pengaturan

**audit_logs** *(append-only)*
| Kolom | Tipe | Catatan |
|---|---|---|
| id | bigint PK | |
| user_id | bigint FK users | null |
| action | varchar(60) | index; daftar bagian 9.7 |
| object_type | varchar(60) | null |
| object_id | bigint | null |
| detail | jsonb | |
| ip_address | varchar(45) | |
| user_agent | varchar(255) | null |
| created_at | timestamptz | index |

**replay_scenarios**
| Kolom | Tipe | Catatan |
|---|---|---|
| id | bigint PK | |
| name | varchar(150) | |
| description | text | null |
| total_rows | int | |
| incident_start_offset_seconds | int | null; dipakai menghitung waktu deteksi |
| default_speed_factor | int | default 60 |
| status | varchar(10) | CHECK in (`idle`,`running`,`finished`,`stopped`); default `idle` |
| started_at | timestamptz | null |
| virtual_anchor_at | timestamptz | null |
| created_by | bigint FK users | |

**replay_rows**
| Kolom | Tipe | Catatan |
|---|---|---|
| id | bigint PK | |
| scenario_id | bigint FK replay_scenarios | ON DELETE CASCADE; index (`scenario_id`,`offset_seconds`) |
| offset_seconds | int | waktu relatif sejak awal skenario |
| phase | varchar(10) | CHECK in (`baseline`,`incident`) |
| text | text | |
| account_handle | varchar(190) | |
| account_display_name | varchar(190) | null |
| account_created_at | timestamptz | null |
| label_manual | varchar(10) | null; `organic` atau `anomalous` |

**evaluation_runs**
| Kolom | Tipe | Catatan |
|---|---|---|
| id | bigint PK | |
| scenario_id | bigint FK replay_scenarios | null |
| run_by | bigint FK users | |
| labeled_posts | int | |
| tp, fp, fn | int | tingkat akun |
| precision, recall, f1 | numeric(5,4) | |
| detection_latency_seconds | int | null |
| notes | text | null |

**settings**
| Kolom | Tipe | Catatan |
|---|---|---|
| key | varchar(100) PK | |
| value | jsonb | |
| updated_by | bigint FK users | null |
| updated_at | timestamptz | |

Seed `settings`:

```json
{
  "key": "detection",
  "value": {
    "coordination_window_minutes": 15,
    "z_threshold": 3.0,
    "min_volume": 20,
    "baseline_hours": 168,
    "min_baseline_hours": 24,
    "similarity_threshold": 0.8,
    "min_accounts_cluster": 5,
    "young_account_days": 30,
    "impersonation_threshold": 0.6,
    "weights": { "spike": 40, "anomaly": 30, "sentiment": 20, "reach": 10 },
    "severity_cutoffs": { "medium": 40, "high": 70 },
    "sensitivity_z_offset": { "low": 1.0, "medium": 0.0, "high": -0.5 }
  }
}
```

Kunci lain: `offline_mode` (`{"enabled": false}`), `replay.clock` (`{"now": null}`).

### 9.7 Nilai `audit_logs.action`

`auth.login`, `auth.login_failed`, `auth.logout`, `user.create`, `user.update`, `user.deactivate`, `source.create`, `source.update`, `source.test`, `source.import`, `topic.create`, `topic.update`, `official_account.create`, `official_account.delete`, `alert.take`, `alert.escalate`, `alert.false_positive`, `alert.close`, `alert.approve`, `alert.return`, `alert.comment`, `briefing.create`, `briefing.download`, `replay.start`, `replay.stop`, `settings.update`, `label.set`, `evaluation.run`

### 9.8 Seeder wajib

1. `RoleSeeder`, `PermissionSeeder` (sesuai bagian 8, dari `config/permissions.php`).
2. `UserSeeder`: tiga akun demo (`admin@radarisu.test`, `analyst@radarisu.test`, `leader@radarisu.test`). **Kata sandi demo wajib diganti pada deploy produksi.**
3. `TopicTemplateSeeder`: tiga templat (`is_template = true`, `is_active = false`), kata kunci berisi **placeholder** yang harus diisi Analis:
   - UC1 `institution`: "Isu terhadap [nama institusi/satuan]"
   - UC2 `impersonation`: "Peniruan akun resmi [nama satuan]"
   - UC3 `opsec`: "Istilah sensitif [ditetapkan satuan]"

   Saat Analis membuat topik dari templat (`POST /topics`, Fase 3), permintaan **ditolak (422)** bila ada keyword yang masih mengandung `[` atau `]`. Topik baru menjadi aktif hanya setelah lolos validasi ini.
4. `SettingsSeeder` (bagian 9.6).
5. `DemoScenarioSeeder` (opsional): satu skenario Replay dari CSV.

---

## 10. Pipeline dan deteksi

### 10.1 Alur data

```
Sumber (rss/youtube/csv/replay)
  → raw_items
  → NormalizePostsJob → accounts + posts (text_norm, sentiment)
  → MatchTopicsJob → topic_matches
  → AggregateMetricsJob → metrics_hourly
  → DetectJob (SpikeDetector, CoordinationDetector, ImpersonationDetector)
  → ThreatScorer → alerts + alert_evidence
```

Data mentah disimpan sebelum diolah, sehingga aturan bisa diperbaiki dan dijalankan ulang tanpa menarik data lagi.

### 10.2 Jadwal dan perintah

| Perintah / Job | Jadwal | Fungsi |
|---|---|---|
| `radarisu:ingest` | setiap menit | Memilih sumber `is_active` yang jatuh tempo dan men-dispatch penarikan |
| `NormalizePostsJob` | setelah ingest | Memproses `raw_items.processed_at IS NULL` |
| `MatchTopicsJob` | setelah normalize | Mencocokkan posting baru ke topik aktif |
| `radarisu:aggregate` | setiap 5 menit | Mengisi/memperbarui `metrics_hourly` |
| `radarisu:detect` | setiap menit | Menjalankan tiga detektor |
| `radarisu:replay {scenario}` | dipicu API | Menjalankan Replay (job berumur panjang) |
| `radarisu:evaluate` | dipicu API | Menghitung metrik evaluasi |

Saat Mode Offline aktif, `radarisu:ingest` melewati sumber `rss` dan `youtube`.

### 10.3 Data Clock

Seluruh detektor memakai `DataClock::now()`, bukan `now()` mentah:

- Bila `settings.replay.clock.now` tidak null → pakai nilai itu (waktu virtual Replay).
- Selain itu → `now()`.

### 10.4 Normalisasi

`text_norm`: huruf kecil, hapus URL dan mention, ganti tanda baca beruntun dengan spasi, ringkas spasi. Akun dibuat atau diperbarui (`firstOrCreate` berdasarkan `source_type` + `handle`). Sentimen dihitung dari `resources/lexicon/id_sentiment.csv` (kolom `term,polarity` dengan nilai −1, 0, +1), skor = rata-rata polaritas kata yang cocok; `positive` bila ≥ 0,2, `negative` bila ≤ −0,2, selain itu `neutral`. **[ASUMSI]** kamus disusun tim atau dari sumber berlisensi terbuka.

### 10.5 SpikeDetector

Untuk setiap topik aktif:

1. `current` = jumlah posting yang cocok topik dalam 60 menit terakhir (berdasarkan `DataClock`).
2. Baseline = `volume` jam-jam sebelumnya dari `metrics_hourly` (hingga `baseline_hours`, tanpa jam berjalan). Bila jumlah jam < `min_baseline_hours`, deteksi lonjakan dilewati dan komponen `spike` bernilai 0.
3. `z = (current − mean) / max(std, 1)`.
4. `z_eff = z_threshold + sensitivity_z_offset[topic.sensitivity]` (minimum 2,0).
5. Terpicu bila `z ≥ z_eff` **dan** `current ≥ min_volume`.

### 10.6 CoordinationDetector

Untuk setiap topik aktif, ambil posting dalam `coordination_window_minutes` terakhir:

1. Klaster greedy berdasarkan `similarity(text_norm, text_norm) ≥ similarity_threshold` (fungsi `pg_trgm`).
2. Klaster dengan **≥ `min_accounts_cluster` akun berbeda** ditandai terkoordinasi.
3. Alasan bukti per akun: `similar_text` (selalu), `young_account` (bila usia akun saat `posted_at` < `young_account_days`), `synchronized_posting` (bila ≥ 80% posting klaster berada dalam 5 menit).
4. `anomalous_accounts` pada `metrics_hourly` diisi dari akun-akun yang ditandai.

### 10.7 ImpersonationDetector

Untuk akun dengan `first_seen_at` dalam 24 jam terakhir (data clock), hitung `max(similarity(handle, official.handle), similarity(display_name, official.display_name))` terhadap seluruh `official_accounts`. Terpicu bila nilai ≥ `impersonation_threshold` **dan** `handle` tidak sama persis dengan akun resmi. Alert `kind='impersonation'`, `score = round(similarity × 70) + (akun muda ? 30 : 0)`. Bukti: `name_similarity` (+ `young_account`).

### 10.8 ThreatScorer (alert `issue`)

```
spike     = min(z / 6, 1)                       × weights.spike      (0 bila baseline tidak cukup)
anomaly   = min(anomalous / unique_accounts, 1) × weights.anomaly
sentiment = (negative / volume)                 × weights.sentiment
reach     = min(source_count / active_sources, 1) × weights.reach
score     = round(spike + anomaly + sentiment + reach)      # 0–100
severity  = high bila ≥ cutoffs.high; medium bila ≥ cutoffs.medium; selain itu low
```

`score_breakdown` menyimpan nilai mentah dan hasil tiap komponen, bobot, serta ambang yang dipakai, agar UI bisa menampilkan rumus.

### 10.9 Pembuatan dan pembaruan alert

- Alert `issue` dibuat bila SpikeDetector **atau** CoordinationDetector terpicu pada sebuah topik.
- Bila sudah ada alert **terbuka** untuk topik/akun tersebut, **perbarui** `score`, `score_breakdown`, `window_end`, dan tambahkan bukti baru (jangan membuat alert ganda; dijamin oleh unique index parsial).
- Jangan mengubah `status` secara otomatis. Pembaruan skor pada alert `escalated` tetap diizinkan.
- Alert baru menulis satu `alert_actions` bertipe sistem? **Tidak**; cukup baris di `alerts` dengan `status='new'`.
- Bukti `spike_sample`: hingga 10 posting contoh dari jendela lonjakan.

### 10.10 Replay

- `POST /replay/scenarios/{id}/start` menyetel `virtual_anchor_at = now() − (offset_seconds terbesar fase baseline)` sehingga fase baseline berakhir "sekarang".
- Baris `phase='baseline'` dimasukkan **langsung** (posted_at = `virtual_anchor_at + offset_seconds`).
- Baris `phase='incident'` dialirkan berurutan; jeda nyata antar baris = `selisih offset_seconds / speed_factor`; `posted_at = virtual_anchor_at + offset_seconds`.
- Setiap baris masuk sebagai `raw_items` dari sumber bertipe `replay` (`is_simulated = true`) dan melewati pipeline yang sama persis (bukan jalur khusus).
- `settings.replay.clock.now` diperbarui ke `posted_at` baris terakhir; direset ke `null` saat selesai atau dihentikan.
- Semua posting dari Replay bertanda `is_simulated = true` dan harus diberi lencana **"DATA SIMULASI"** di UI.

---

## 11. Kontrak API (`/api/v1`, JSON)

Respons sukses: `{ "data": ..., "meta": { ... } }`. Error: `{ "message": "...", "errors": { "field": ["..."] } }`. Kode status: 401 tidak terautentikasi, 403 tidak berizin, 404 tidak ada, 422 validasi atau transisi tidak valid, 429 rate limit.

Semua rute (kecuali login) dilindungi `auth:sanctum` + middleware `permission:<slug>`.

Rute yang logikanya milik fase berikutnya sudah terdaftar dan mengembalikan **501** dengan body `{"message":"Belum diimplementasikan","meta":{"pending_phase":N}}`. Autentikasi, izin, dan policy objek tetap diperiksa sebelum stub tersebut. Fase pemiliknya mengganti stub dengan implementasi nyata.

| Metode & rute | Izin | Catatan |
|---|---|---|
| `POST /auth/login` | publik, throttle 5/menit/IP+email | body `{email,password}` → `{token, user}`; menolak pengguna nonaktif |
| `POST /auth/logout` | login | mencabut token aktif |
| `GET /auth/me` | login | `{user, role, permissions[]}` |
| `GET /users` | users.view | |
| `POST /users` | users.manage | |
| `PATCH /users/{id}` | users.manage | ubah nama, peran, `is_active` |
| `GET /sources` | sources.view | |
| `POST /sources` | sources.manage | validasi `config` per `type` |
| `PATCH /sources/{id}` | sources.manage | |
| `POST /sources/{id}/test` | sources.manage | uji koneksi, menyimpan `last_status` |
| `POST /sources/{id}/import` | sources.manage | multipart CSV; maks 10 MB, 50.000 baris; header divalidasi |
| `GET /sources/{id}/imports` | sources.view | riwayat `import_batches` |
| `GET /topics` | topics.view | |
| `POST /topics` | topics.manage | dari templat: 422 bila keyword masih mengandung `[`/`]` (§9.8) |
| `PATCH /topics/{id}` | topics.manage | termasuk nonaktifkan |
| `GET /topics/{id}/metrics?from&to` | topics.view | deret `metrics_hourly` |
| `GET /official-accounts` | topics.view | |
| `POST /official-accounts` | topics.manage | |
| `DELETE /official-accounts/{id}` | topics.manage | |
| `GET /dashboard/summary` | dashboard.view | diskop peran (lihat 11.2) |
| `GET /dashboard/issues` | dashboard.view | daftar isu berperingkat, diskop peran |
| `GET /alerts` | alerts.view | filter `status`, `severity`, `kind`; leader otomatis dibatasi policy |
| `GET /alerts/{id}` | alerts.view + policy | detail + bukti + `actions` |
| `POST /alerts/{id}/take` | alerts.triage | |
| `POST /alerts/{id}/escalate` | alerts.triage | `{recommendation, note?}` |
| `POST /alerts/{id}/false-positive` | alerts.triage | `{note}` |
| `POST /alerts/{id}/close` | alerts.triage | `{note}` |
| `POST /alerts/{id}/approve` | alerts.decide | `{note?}` |
| `POST /alerts/{id}/return` | alerts.decide | `{note}` |
| `POST /alerts/{id}/comments` | alerts.view + policy | `{note}`; analyst atau leader |
| `GET /briefings` | briefings.view | leader hanya yang alert-nya terlihat |
| `POST /alerts/{id}/briefings` | briefings.create | menghasilkan PDF (barryvdh/laravel-dompdf) |
| `GET /briefings/{id}/download` | briefings.download + policy | mencatat `briefing.download` |
| `GET /audit-logs` | audit.view | filter `user_id`, `action`, `from`, `to` |
| `GET /replay/scenarios` | replay.manage | |
| `POST /replay/scenarios` | replay.manage | unggah CSV skenario |
| `POST /replay/scenarios/{id}/start` | replay.manage | `{speed_factor?}` |
| `POST /replay/scenarios/{id}/stop` | replay.manage | |
| `GET /settings/detection` | settings.manage | |
| `PUT /settings/detection` | settings.manage | validasi rentang nilai; mencatat `settings.update` |
| `GET /labeling/posts` | labels.manage | paginasi, filter `unlabeled` |
| `PUT /labeling/posts/{id}` | labels.manage | `{label_manual: organic|anomalous|null}` |
| `GET /evaluation/runs` | evaluation.view | |
| `POST /evaluation/run` | evaluation.run | `{scenario_id?}` |
| `GET /system/status` | system.status | kesehatan sumber, antrean, jumlah data |

### 11.1 Contoh `GET /auth/me`

```json
{ "data": { "user": { "id": 2, "name": "Analis Demo", "email": "analyst@radarisu.test" },
            "role": { "slug": "analyst", "name": "Analis" },
            "permissions": ["topics.view","topics.manage","dashboard.view","alerts.view","alerts.triage",
                            "briefings.view","briefings.create","briefings.download","labels.manage",
                            "evaluation.view","evaluation.run"] } }
```

### 11.2 `GET /dashboard/summary` (diskop peran)

```json
{ "data": {
    "active_issues": 3,
    "highest_severity": "high",
    "awaiting_decision": 1,
    "trend_24h": [ { "hour": "2026-10-20T08:00:00Z", "volume": 42 } ],
    "data_notice": { "has_simulated_data": true }
} }
```

Untuk `leader`, hanya alert berstatus `escalated`, `approved`, `returned` yang dihitung. Untuk `analyst`, semua alert terbuka.

### 11.3 `GET /alerts/{id}`

```json
{ "data": {
    "id": 17, "kind": "issue", "status": "escalated", "score": 82, "severity": "high",
    "topic": { "id": 4, "name": "Isu terhadap [institusi]" },
    "score_breakdown": { "spike": {"raw": 5.1, "weight": 40, "value": 34},
                         "anomaly": {"raw": 0.41, "weight": 30, "value": 12},
                         "sentiment": {"raw": 0.62, "weight": 20, "value": 12},
                         "reach": {"raw": 0.67, "weight": 10, "value": 7},
                         "thresholds": {"z": 3.0, "similarity": 0.8} },
    "evidence": [ { "reason": "similar_text", "account": {"handle": "@akun_a"}, "post": {"text": "..."}, "detail": {"similarity": 0.91} } ],
    "actions": [ { "action": "escalate", "user": "Analis Demo", "note": "...", "created_at": "..." } ],
    "recommendation": "..."
} }
```

### 11.4 Format CSV impor (`POST /sources/{id}/import`)

Kolom disamakan dengan `replay_rows` (§9.6) agar normalisasi Fase 3 cukup satu jalur.

| Kolom | Wajib | Aturan |
|---|:-:|---|
| `text` | ✔ | tidak kosong, maks 10.000 karakter |
| `account_handle` | ✔ | tidak kosong, maks 190 |
| `posted_at` | ✔ | ISO 8601 **dengan** zona waktu (`2026-10-20T08:15:00+07:00` atau `...Z`) |
| `external_id` | | maks 190 |
| `account_display_name` | | maks 190 |
| `account_created_at` | | ISO 8601 dengan zona waktu |

- **Seluruh file ditolak (422, tanpa data tertulis)** bila:
  - sumber bukan tipe `csv`;
  - file > 10 MB atau bukan teks/CSV, atau tidak berenkode UTF-8;
  - kolom wajib hilang, ada kolom tidak dikenal, atau ada nama kolom ganda (BOM UTF-8 dibuang; urutan kolom bebas);
  - lebih dari 50.000 baris data.
- **Baris bermasalah** dilewati dan dicatat di `import_batches.errors` sebagai `{row, message}`. `row` adalah nomor baris di file (header = 1; newline di dalam tanda kutip ikut dihitung), dan `message` adalah kode galat:
  - `missing_text`, `missing_account_handle`;
  - `invalid_posted_at`, `invalid_account_created_at`;
  - `field_too_long`, `column_count_mismatch`;
  - `duplicate_row`.

  Daftar `errors` dibatasi 200 entri, tetapi `failed_rows` tetap menghitung semuanya.
- **Duplikat:** `content_hash` = sha256 dari JSON kanonik kolom-kolom di atas. Baris yang sama di dalam satu file atau yang sudah ada di sumber yang sama ditandai `duplicate_row`, sehingga mengimpor ulang file yang sama tidak menambah data. Baris yang sama di sumber lain bukan duplikat.
- Impor berjalan sinkron dalam satu transaksi. Impor ke sumber yang sama diserialkan dengan *row lock*.
- Kode galat diterjemahkan di `frontend/src/lib/labels.ts` (`errorCodeLabels`).

### 11.5 Uji koneksi sumber (`POST /sources/{id}/test`)

- **Cakupan:** hanya untuk `rss` dan `youtube`. Tipe lain → 422. Mode Offline aktif → 422 tanpa panggilan keluar (§16).
- **Hasil:** disimpan di `last_status`/`last_error`/`last_fetched_at` dan dicatat sebagai `source.test`. Respons tetap 200 meskipun koneksinya gagal, karena hasil uji adalah data, bukan galat API.
- **RSS:** proteksi SSRF berlaku (§13). Respons harus berupa XML RSS/Atom yang valid.
- **YouTube:** `videos?part=id` dengan `YOUTUBE_API_KEY` dari `.env`. Bila kunci API tidak ada → `error` tanpa panggilan keluar.
- Penarikan terjadwal (`radarisu:ingest`) dikerjakan di Fase 3.

---

## 12. Frontend (Next.js App Router)

### 12.1 Ketentuan

- TypeScript ketat, Tailwind, komponen `shadcn/ui`, `@tanstack/react-query`, `react-hook-form` + `zod`, Recharts. Dependensi ini dipasang saat pertama kali dipakai.
- Tes frontend memakai **Vitest** (`npm test`).
- `src/lib/permissions.ts` **di-generate** dari `backend/config/permissions.php` dengan `php artisan permissions:export-ts`. Jangan diedit manual; tes backend gagal bila file tertinggal dari konfigurasi.
- Semua panggilan API lewat `lib/api.ts` ke `/api/*`. Route Handler `app/api/[...path]/route.ts` meneruskan ke `${LARAVEL_URL}/api/v1/*` dengan header `Authorization: Bearer <rd_token>` dan meneruskan status serta body apa adanya.
- `app/api/auth/login/route.ts`: memanggil `POST /auth/login`, menulis cookie `rd_token`. `app/api/auth/logout/route.ts`: memanggil logout lalu menghapus cookie.
- `src/proxy.ts` (nama `middleware.ts` di Next 16): tanpa cookie → redirect `/login`.
- `app/(app)/layout.tsx` (server component) memanggil `GET /auth/me`, meneruskan `permissions` ke provider. Komponen `<Can permission="alerts.triage">…</Can>` dan hook `useCan()` menyembunyikan elemen. Halaman yang dimasuki tanpa izin menampilkan layar 403 (data tidak dimuat karena server menolak).
- 401 dari API → hapus cookie dan arahkan ke `/login`.
- Semua teks lewat `lib/labels.ts` (bagian 14). Lencana **"DATA SIMULASI"** tampil di setiap tampilan yang memuat data `is_simulated`.

### 12.2 Rute dan izin

| Rute | Izin | Isi |
|---|---|---|
| `/login` | publik | Form login |
| `/dashboard` | dashboard.view | Admin dialihkan ke `/admin/status` |
| `/topics`, `/topics/[id]` | topics.view | Daftar, detail + grafik metrik; form hanya bila `topics.manage`; akun resmi |
| `/alerts`, `/alerts/[id]` | alerts.view | Daftar dan detail; tombol aksi sesuai izin dan status |
| `/briefings` | briefings.view | Daftar + unduh; tombol "Susun briefing" di detail alert bila `briefings.create` |
| `/labeling` | labels.manage | Antrean pelabelan |
| `/evaluation` | evaluation.view | Metrik; tombol jalankan bila `evaluation.run` |
| `/admin/status` | system.status | Kesehatan sistem |
| `/admin/sources` | sources.view | CRUD sumber, uji koneksi, impor CSV |
| `/admin/users` | users.view | CRUD pengguna |
| `/admin/replay` | replay.manage | Skenario, mulai, hentikan, kecepatan |
| `/admin/audit` | audit.view | Tabel audit + filter |
| `/admin/settings` | settings.manage | Form ambang dan bobot + pratinjau rumus |

### 12.3 Alur per peran

**Admin Sistem**

1. *Sumber:* `/admin/sources` → Tambah → pilih tipe, isi URL/ID video/interval → **Uji koneksi** → Aktifkan → pantau status (terakhir ditarik, jumlah item, error). *Impor CSV:* pilih sumber `csv` → unggah → lihat ringkasan sukses/gagal dan daftar baris bermasalah.
2. *Pengguna:* buat akun, tetapkan peran, nonaktifkan.
3. *Replay:* unggah CSV skenario → **Mulai** dengan kecepatan → pantau hingga selesai → **Hentikan** bila perlu.
4. *Pengaturan:* ubah ambang dan bobot → simpan → perubahan tercatat di audit.
5. *Audit:* filter berdasarkan pengguna, aksi, tanggal.
6. *Evaluasi:* jalankan evaluasi setelah label tersedia.

**Analis**

1. *Topik:* `/topics` → buat dari templat UC1–UC3 atau dari nol → isi kata kunci dan sensitivitas → grafik volume terisi. Kelola daftar akun resmi (UC2).
2. *Triase:* `/alerts` → buka alert `new` → **Ambil** (→ `reviewing`) → tinjau grafik, akun ditandai, sampel bukti, rincian skor → pilih **Eskalasi** (wajib rekomendasi), **False Positive**, atau **Tutup** (wajib catatan).
3. *Alert dikembalikan:* buka alert `returned` → baca catatan Pimpinan → tambah analisis dan **Eskalasi ulang**, atau tutup.
4. *Briefing:* di detail alert → **Susun briefing** → unduh PDF.
5. *Pelabelan:* `/labeling` → beri label `organic`/`anomalous` pada ±200 posting → jalankan Evaluasi.

**Pimpinan**

1. `/dashboard` → ringkasan situasi (isu yang menunggu keputusan, severity tertinggi, tren 24 jam).
2. `/alerts` (hanya `escalated`, `approved`, `returned`) → buka isu → baca ringkasan, bukti, rekomendasi Analis.
3. **Setujui** (catatan opsional) atau **Minta analisis lanjutan** (wajib catatan; status `returned`, kembali ke Analis).
4. Unduh briefing; lihat halaman Evaluasi.

---

## 13. Kebutuhan non-fungsional, keamanan, dan etika

- **Keamanan:** hash kata sandi (bcrypt/argon2), kata sandi minimal 10 karakter, throttle login 5/menit, masa berlaku token 8 jam (`sanctum.expiration = 480`), cookie `httpOnly`, validasi unggahan CSV (tipe, ukuran, header, batas baris), seluruh output teks postingan di-escape (React default; jangan memakai `dangerouslySetInnerHTML`), HTTPS di produksi.
- **IP klien (item keamanan Fase 1):** semua request ke Laravel datang dari BFF, jadi throttle login dan `audit_logs.ip_address` bergantung pada `X-Forwarded-For`.
  - Laravel hanya memercayai header itu dari alamat BFF (`TRUSTED_PROXIES`; di Docker, IP tetap kontainer `frontend`). Hanya `X-Forwarded-For` yang dipercaya.
  - `frontend/server.mjs` **menimpa** `X-Forwarded-For` dengan alamat soket koneksi masuk sebelum Next memprosesnya, dan BFF meneruskan nilai itu tanpa menambahkan apa pun. Akibatnya klien tidak bisa memalsukan IP.
  - Laravel tidak dipublikasikan ke host; hanya BFF yang menjangkaunya.
- **Otorisasi:** middleware `EnsurePermission` membaca izin pengguna (cache 60 detik, di-invalidasi saat peran berubah); policy untuk aturan objek; tes otomatis untuk matriks akses (bagian 19).
- **Audit:** seluruh aksi pada bagian 9.7 tercatat dengan IP dan user agent. `AuditLogger` menolak aksi di luar daftar §9.7.
  - `audit_logs` dan `alert_actions` bersifat **append-only di tingkat database**: trigger Postgres menolak UPDATE, DELETE, dan TRUNCATE.
- **SSRF (URL yang dikonfigurasi admin):** sebelum server menghubungi URL sumber, berlaku aturan berikut:
  - hanya `http`/`https`;
  - semua alamat hasil DNS harus publik (privat, loopback, link-local/metadata cloud, reserved, dan CGNAT ditolak);
  - koneksi **dipin** ke IP yang sudah diperiksa (`CURLOPT_RESOLVE`) agar tidak bisa dibelokkan lewat DNS rebinding;
  - redirect tidak diikuti, timeout 10 detik, dan unduhan dihentikan bila melewati 2 MB.
- **Zona waktu:** aplikasi dan sesi Postgres dikunci ke UTC (`config/database.php`). Eloquent menulis timestamp tanpa offset, sehingga sesi DB dengan zona lain menggeser semua `timestamptz`.
- **Kinerja:** halaman dasbor termuat < 3 detik pada ±100 ribu posting. **[ASUMSI]** diverifikasi pada pengujian.
- **Keandalan:** kegagalan satu sumber tidak menghentikan sumber lain; job gagal dicoba ulang 3 kali lalu dicatat di `failed_jobs` dan tampil di `/admin/status`.
- **Etika dan hukum:** hanya data publik; mematuhi ketentuan platform; tidak menyimpan data pribadi di luar handle dan nama tampilan publik; sistem melaporkan pola dan tidak menyebut siapa pun "bersalah"; keputusan akhir selalu manusia; data simulasi selalu berlabel.

## 14. Peta label UI (`frontend/lib/labels.ts`)

| Identifier | Label Indonesia |
|---|---|
| role `admin` / `analyst` / `leader` | Admin Sistem / Analis / Pimpinan |
| status `new` | Baru |
| status `reviewing` | Ditinjau |
| status `escalated` | Dieskalasi |
| status `returned` | Dikembalikan |
| status `approved` | Disetujui |
| status `false_positive` | False Positive |
| status `closed` | Ditutup |
| severity `low` / `medium` / `high` | Rendah / Sedang / Tinggi |
| kind `issue` / `impersonation` | Isu / Peniruan Akun |
| sentiment `positive` / `negative` / `neutral` | Positif / Negatif / Netral |
| label `organic` / `anomalous` | Organik / Tidak Wajar |
| reason `similar_text` | Teks sangat mirip |
| reason `young_account` | Akun baru |
| reason `synchronized_posting` | Posting serentak |
| reason `name_similarity` | Nama mirip akun resmi |
| reason `spike_sample` | Contoh posting saat lonjakan |
| topic category `institution` / `impersonation` / `opsec` / `general` | Institusi / Peniruan / OPSEC / Umum |
| action `take` / `escalate` / `approve` / `return` / `comment` | Ambil / Eskalasi / Setujui / Minta analisis lanjutan / Komentar |

## 15. Evaluasi

1. Beri label manual pada ±200 posting (`organic`/`anomalous`) lewat `/labeling`, termasuk posting dari skenario Replay.
2. `radarisu:evaluate`: tingkat **akun**. *Prediksi positif* = akun yang menjadi bukti `similar_text`/`young_account`/`synchronized_posting` pada alert `issue`. *Kebenaran dasar* = akun yang memiliki posting berlabel `anomalous`. Hitung TP, FP, FN, presisi, recall, F1 hanya pada akun yang punya label.
3. **Waktu deteksi:** `alerts.detected_at − (virtual_anchor_at + incident_start_offset_seconds)` pada skenario Replay.
4. Hasil disimpan di `evaluation_runs` dan tampil di `/evaluation` bersama keterbatasan (ukuran data uji, data simulasi, kamus sentimen sederhana).
5. Laporkan angka apa adanya. Kalibrasi ambang dilakukan di `/admin/settings`, lalu evaluasi dijalankan ulang.

## 16. Rencana implementasi di lingkungan satuan (Kelayakan Implementasi)

- **Paket:** `docker-compose.yml` dengan layanan `nginx`, `app` (php-fpm), `queue`, `scheduler`, `postgres`, `frontend` (Next.js). Satu perintah `docker compose up -d`.
- **Kebutuhan server minimum [ASUMSI, diverifikasi saat pengujian]:** 2 vCPU, 4 GB RAM, 40 GB disk.
- **Mode Offline:** `settings.offline_mode.enabled = true` menonaktifkan sumber `rss` dan `youtube`; data masuk lewat impor CSV atau Replay. Tidak ada panggilan keluar.
- **Peran pengguna** sengaja sederhana (tiga peran) dan sejajar dengan alur kerja satuan: analis, pimpinan, administrator sistem.
- **Pelatihan singkat:** satu halaman panduan per peran dan video demo.
- **Roadmap integrasi:** ekspor alert ke SIEM atau sistem pelaporan satuan, SSO internal, penambahan sumber data. Hanya disebut di dokumen, tidak dibangun.

## 17. Deliverable dokumentasi (Kualitas Dokumentasi)

| Dokumen | Isi |
|---|---|
| Proposal | Masalah, kasus penggunaan UC1–UC3, solusi, inovasi, hasil evaluasi, roadmap |
| PRD | Dokumen ini |
| Dokumentasi teknis | Diagram arsitektur, ERD (dari bagian 9), daftar API (bagian 11), matriks RBAC |
| Panduan instalasi | Docker Compose, variabel `.env`, seeding, akun demo |
| Video demo | Naskah mengikuti skenario bagian 20; direkam pada Gerbang 3; durasi sesuai ketentuan juknis **[ASUMSI]** |

---

## 18. Fase pengerjaan, DoD, dan gerbang

> Penyisihan dinilai dari **submission** (proposal, dokumentasi, video demo), final dari presentasi dan demo langsung. Hitung mundur seluruh gerbang dari **tenggat submission**, bukan dari final.

| Fase | Pekerjaan | DoD |
|---|---|---|
| 0 | Scaffold Laravel + Sanctum, Next.js, `docker-compose.yml`, migrasi `pg_trgm` | `docker compose up` menjalankan semua layanan; halaman login tampil |
| 1 | Migrasi + seeder bagian 9, `EnsurePermission`, `AlertPolicy`, `AlertStateMachine`, `AuditLogger` versi minimal (aksi `auth.*` dan `alert.*`), endpoint `/auth/*`, BFF Next.js + `trustProxies`, layout role-aware | **Seluruh tes RBAC bagian 19.1 lulus** |
| 2 | Users, Sources (CRUD + uji koneksi), impor CSV (§11.4), perluasan `AuditLogger` (semua aksi §9.7, `GET /audit-logs`, trigger append-only), `GET /system/status`, halaman admin minimal (`/admin/users`, `/admin/sources`, `/admin/audit`, `/admin/status`) | Admin dapat membuat sumber, mengimpor CSV, dan semua aksi tercatat di audit || 3 | Penarikan terjadwal RSS/YouTube (`radarisu:ingest`, `RssIngestor`, `YoutubeIngestor`); pipeline: raw → normalize → topic match → aggregate; Topics + akun resmi | Data CSV muncul sebagai metrik per topik di grafik |
| 4 | Detektor, `ThreatScorer`, pembuatan/pembaruan alert, `DataClock` | Skenario uji menghasilkan alert dengan skor dan bukti |
| 5 | Alur alert + komentar + tes transisi | Seluruh tes 19.2 lulus |
| 6 | Dasbor, briefing PDF | Satu alert dapat berjalan dari `new` sampai briefing terunduh |
| 7 | Replay, labeling, evaluasi, pengaturan | Replay memicu alert lewat pipeline yang sama; halaman Evaluasi menampilkan angka |
| 8 | Frontend lengkap per peran | Skenario demo bagian 20 berjalan end-to-end tanpa intervensi manual |
| 9 | Poles, deploy VPS (HTTPS), dokumentasi, video | Semua deliverable bagian 17 selesai |

> **Catatan v2.1:** Fase 1 dimulai sebelum gerbang Fase 0 lulus. Saat itu `docker-compose.yml` belum ada, dan baru dibuat setelah Fase 1 untuk menutup DoD Fase 0. Mulai sekarang, sebuah fase tidak dimulai sebelum DoD fase sebelumnya terverifikasi.

| Gerbang | Syarat lolos (persen dari waktu menuju tenggat submission) |
|---|---|
| **G1 (30%)** | Fase 0–3 selesai, SpikeDetector berjalan, login + RBAC lolos tes |
| **G2 (60%)** | Fase 4–7 selesai, semua F1–F15 terintegrasi, satu skenario penuh jalan dari sinyal sampai briefing |
| **G3 (85%)** | Fase 8 selesai, pembekuan fitur, evaluasi data berlabel selesai, video demo direkam, rekaman cadangan dibuat |
| **Akhir** | Deploy final, dokumentasi lengkap, latihan pitch minimal 3 kali |

Pembagian peran usulan: **A** pipeline dan deteksi (F3, F4, F5, F13, Fase 3–4, 7), **B** RBAC, alur alert, audit, briefing (F6, F9, F10, F12, Fase 1–2, 5–6), **C** frontend, kurasi data, skenario Replay, evaluasi, pitch (F8, F11, F14, F15, Fase 8, dokumentasi). Seluruh tim membantu kurasi data pada hari pertama.

---

## 19. Tes penerimaan

### 19.1 Matriks akses (tes Feature Laravel, wajib lulus di Fase 1)

Notasi: ✔ = lolos otorisasi (status ≠ 403 dan ≠ 404, termasuk 501 untuk stub fase berikutnya), ✘ = 403, — = tidak diuji. Tanpa token semua rute (kecuali login) → 401.

| Rute | admin | analyst | leader |
|---|:-:|:-:|:-:|
| GET /users | ✔ | ✘ | ✘ |
| POST /users | ✔ | ✘ | ✘ |
| GET /sources | ✔ | ✘ | ✘ |
| POST /sources | ✔ | ✘ | ✘ |
| POST /sources/{id}/import | ✔ | ✘ | ✘ |
| GET /topics | ✘ | ✔ | ✔ |
| POST /topics | ✘ | ✔ | ✘ |
| POST /official-accounts | ✘ | ✔ | ✘ |
| GET /dashboard/summary | ✘ | ✔ | ✔ |
| GET /alerts | ✘ | ✔ | ✔ |
| POST /alerts/{id}/take | ✘ | ✔ | ✘ |
| POST /alerts/{id}/escalate | ✘ | ✔ | ✘ |
| POST /alerts/{id}/approve | ✘ | ✘ | ✔ |
| POST /alerts/{id}/return | ✘ | ✘ | ✔ |
| POST /alerts/{id}/briefings | ✘ | ✔ | ✘ |
| GET /briefings/{id}/download | ✘ | ✔ | ✔ (bila terlihat) |
| GET /audit-logs | ✔ | ✘ | ✘ |
| POST /replay/scenarios/{id}/start | ✔ | ✘ | ✘ |
| PUT /settings/detection | ✔ | ✘ | ✘ |
| PUT /labeling/posts/{id} | ✘ | ✔ | ✘ |
| POST /evaluation/run | ✔ | ✔ | ✘ |
| GET /evaluation/runs | ✔ | ✔ | ✔ |
| GET /system/status | ✔ | ✘ | ✘ |

Tes tambahan wajib:

1. `leader` membuka `GET /alerts/{id}` untuk alert berstatus `new` atau `reviewing` → **404** (tidak boleh bocor). Aturan yang sama berlaku untuk transisi, komentar, dan unduh briefing pada alert yang tidak terlihat.
2. `GET /alerts` oleh `leader` tidak pernah memuat alert berstatus `new`, `reviewing`, `false_positive`, `closed`.
3. Pengguna nonaktif tidak bisa login (401/422) dan tokennya ditolak.
4. Admin tidak bisa menonaktifkan akunnya sendiri (422). Token dan sesinya tetap berlaku, dan tidak ada baris audit perubahan.
5. Login gagal 6 kali berturut-turut dalam semenit → 429.
6. `X-Forwarded-For` hanya dipercaya dari alamat BFF; dari alamat lain diabaikan (§13).
7. Rute stub mengembalikan 501 dengan body standar, dan izin diperiksa sebelum stub.

### 19.2 Alur kerja alert (tes Feature)

1. `new → take (analyst) → reviewing`. `take` oleh `leader` → 403.
2. `escalate` tanpa `recommendation` → 422. Dengan `recommendation` → `escalated`.
3. `approve` oleh `leader` pada `escalated` → `approved`. `approve` pada `reviewing` → **404** (alert tidak terlihat bagi leader, §8.4). `approve` pada alert yang terlihat tetapi bukan `escalated` (mis. `returned`) → 422.
4. `return` tanpa `note` → 422. Dengan `note` → `returned`.
5. Dari `returned`, `analyst` dapat `escalate` lagi atau `close`.
6. Status terminal (`approved`, `false_positive`, `closed`) menolak semua aksi kecuali `comment` → 422 untuk aksi lain. Pengecualiannya leader pada `false_positive`/`closed`: alert itu tidak terlihat baginya, jadi jawabannya 404.
7. Setiap aksi sukses menambah tepat satu baris `alert_actions` dan satu baris `audit_logs`.
8. Detektor yang berjalan dua kali pada data yang sama **tidak** membuat alert ganda untuk topik yang sama selagi alert masih terbuka. Tes ini ditandai *incomplete* sampai Fase 4; indeks unik parsial di DB sudah diuji sejak Fase 1.

### 19.3 Deteksi (tes Unit)

1. Data baseline datar + lonjakan sintetis → `z ≥ ambang` → alert `issue` dengan komponen `spike > 0`.
2. Baseline < `min_baseline_hours` → komponen `spike = 0`, tanpa error.
3. Klaster 5 akun dengan teks hampir sama dalam 15 menit → bukti `similar_text` untuk 5 akun; 4 akun → tidak terpicu.
4. Akun baru dengan handle mirip akun resmi (similarity ≥ 0,6) → alert `impersonation`; handle identik dengan akun resmi → tidak terpicu.
5. `ThreatScorer` selalu menghasilkan skor 0–100 dan `severity` sesuai cutoff.

---

## 20. Skenario demo (alur cerita)

1. Admin menunjukkan sumber aktif, status sehat, dan menyalakan **Replay** skenario "Narasi terkoordinasi terhadap institusi".
2. Analis sudah memiliki topik dari templat UC1 dan daftar akun resmi satuan.
3. Volume topik melonjak; alert severity **Tinggi** muncul.
4. Analis membuka detail: grafik lonjakan, 40 akun dengan teks hampir sama (bukti "Teks sangat mirip", "Akun baru", "Posting serentak"), sampel postingan, rincian skor.
5. Analis mengeskalasi dengan rekomendasi tindakan.
6. Pimpinan membuka dasbor, membaca ringkasan, lalu menyetujui (atau meminta analisis lanjutan, lalu Analis menjawab).
7. Alert **Peniruan Akun** terpisah muncul untuk satu akun yang namanya mirip akun resmi (UC2).
8. Briefing PDF diunduh; audit log menunjukkan seluruh jejak keputusan.
9. Slide hasil evaluasi (presisi, recall, waktu deteksi) dan roadmap pengembangan.

## 21. Risiko dan mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Juri menilai tidak relevan dengan pengamanan IT/OT TNI AD | Kehilangan nilai relevansi (25%) | Kerangka UC1–UC3 di proposal, demo, dan templat topik; jangan mengklaim melampaui rekayasa sosial |
| Dianggap "hanya aturan statistik" | Nilai inovasi turun | Rumuskan klaim bagian 5, tunjukkan evaluasi terukur dan deteksi peniruan |
| API sumber live bermasalah | Demo gagal | Replay lewat pipeline yang sama |
| Data simulasi dianggap menipu | Kredibilitas turun | Lencana "DATA SIMULASI" di UI dan slide |
| Skop besar untuk 3 orang | Fitur setengah jadi | Fase + gerbang; item bagian 6.2 ditunda |
| Hasil RBAC bocor | Kelemahan keamanan terlihat juri | Tes matriks bagian 19.1 sebagai gerbang Fase 1 |
| Dataset publik tanpa kolom akun/waktu | F3/F4 tidak teruji | Komentar YouTube + skenario Replay buatan sendiri |
| Sentimen berbasis kamus lemah | Kritik teknis | Posisikan sebagai indikator pendukung, bukan inti |

## 22. Asumsi dan pertanyaan terbuka

- Juknis teknis lengkap belum dibaca: format submission, durasi video demo, batas ukuran, tenggat, dan aturan penggunaan layanan eksternal harus dicek dan PRD disesuaikan.
- Ketentuan dan kuota YouTube Data API serta lisensi dataset perlu diverifikasi sebelum dipakai.
- Keterampilan tiap anggota belum dipetakan; pembagian peran bagian 18 adalah usulan.
- Ambang dan bobot (bagian 9.6) adalah nilai awal dan dikalibrasi pada data berlabel.
- Kamus sentimen bahasa Indonesia belum ditentukan sumbernya.
- Kebutuhan server minimum (bagian 16) adalah perkiraan.