# Pipeline data dan topik pantauan (Fase 3, F2)

Dokumen ini menjelaskan bagaimana data mentah menjadi metrik per topik: apa yang dikerjakan tiap tahap, aturannya, apa akibatnya bagi pengguna, dan cara menjalankannya. Sumber: PRD §9.3-§9.4, §10.1-§10.4, §11, §12.2.

## Untuk apa

Data yang diimpor (F1) berhenti di `raw_items`. Pipeline mengubahnya menjadi:

1. **`accounts` dan `posts`** dengan teks ternormalisasi dan sentimen,
2. **`topic_matches`**: posting mana yang termasuk topik mana,
3. **`metrics_hourly`**: jumlah posting, sentimen, akun, dan sumber per topik per jam.

Hasil akhirnya dipakai dua pihak: Analis (grafik di `/topics/{id}`) dan detektor Fase 4 (lonjakan, koordinasi), yang membaca `metrics_hourly` dan `posts`.

## Alur

```
SourceController::import ──┐   (ingestor dan ReplayRunner nanti memanggil dispatch yang sama)
sapuan tiap menit ─────────┴─► NormalizePostsJob
raw_items (processed_at NULL) ─► accounts + posts (text_norm, sentimen)
   └─► MatchTopicsJob(post_ids) ─► topic_matches
          └─► AggregateMetricsJob(pasangan topik-jam) ─► metrics_hourly
radarisu:aggregate tiap 5 menit (jendela 48 jam) ─► metrics_hourly      [jaring pengaman]
POST/PATCH /topics ─► MatchTopicsJob::forTopic ─► pencocokan ulang topik + bangun ulang metriknya
```

## Menjalankan di lokal

Pipeline berjalan di antrean (`QUEUE_CONNECTION=database`). **Tanpa worker, data berhenti di `raw_items`.**

| Perintah | Fungsi |
|---|---|
| `php artisan queue:work --tries=3` | Menjalankan job. Wajib. |
| `php artisan schedule:work` | Menjalankan sapuan `NormalizePostsJob` tiap menit dan `radarisu:aggregate` tiap 5 menit. Tanpa ini pipeline tetap jalan lewat impor, hanya jaring pengamannya tidak aktif. |
| `php artisan radarisu:aggregate` | Hitung ulang metrik 48 jam terakhir. Opsi: `--hours=N`, `--topic=ID`, `--all`. |

Docker menjalankan keduanya sebagai layanan `queue` dan `scheduler`; Docker tidak wajib untuk pengembangan atau tes. Di tes, antrean bertipe `sync`, jadi seluruh rantai berjalan di dalam permintaan.

Cara melihat bahwa pipeline macet: halaman `/admin/status` menampilkan "Item mentah belum diproses" dan "Job menunggu" (naik terus berarti tidak ada worker), serta "Job gagal".

## Kontrak untuk penulis `raw_items`

Siapa pun yang menulis `raw_items` (impor CSV, `RssIngestor`, `YoutubeIngestor`, `ReplayRunner`):

1. `payload` memakai **bentuk kanonik**, sama dengan CSV dan `replay_rows`:

   | Kunci | Wajib | Aturan |
   |---|:-:|---|
   | `text` | ✔ | tidak kosong |
   | `account_handle` | ✔ | tidak kosong |
   | `posted_at` | ✔ | ISO 8601 dengan zona waktu |
   | `external_id` | | dipakai agar posting yang sama tidak masuk dua kali |
   | `account_display_name` | | |
   | `account_created_at` | | ISO 8601 dengan zona waktu |

2. Setelah menulis, panggil `NormalizePostsJob::dispatch()`. Sapuan tiap menit hanya jaring pengaman.
3. `sources.type` menentukan `accounts.source_type`, dan `sources.is_simulated` menentukan `posts.is_simulated` (lencana "DATA SIMULASI").

## Tahap 1: normalisasi (`NormalizePostsJob`, `PostNormalizer`)

| Aspek | Aturan |
|---|---|
| Cakupan | 500 item per putaran, maksimum 20 putaran per eksekusi. Bila masih ada sisa, job mengantre dirinya lagi. |
| Keamanan paralel | Item diklaim dengan `FOR UPDATE SKIP LOCKED`, jadi dua worker atau sapuan yang berjalan bersamaan tidak memproses item yang sama. |
| `text_norm` | `SentimentAnalyzer::normalizeText()` (PRD §10.4): huruf kecil, tanpa URL dan mention, tanda baca jadi spasi, spasi diringkas. Satu-satunya implementasi aturan ini. |
| Sentimen | `SentimentAnalyzer::classify()` pada teks asli. Label dan skor disimpan apa adanya. |
| `posted_at` | Disimpan dalam UTC. |
| Akun | Dibuat atau diperbarui per (`source_type`, `handle`). `display_name` dan `platform_created_at`: nilai pertama yang tidak kosong dipertahankan. |
| `first_seen_at` | `posted_at` **paling awal** yang pernah terlihat untuk akun itu, bukan waktu server. PRD §10.7 membandingkannya dengan waktu data (DataClock), dan untuk CSV historis atau Replay waktu server akan salah. Nilainya hanya bergeser mundur. |
| `external_id` ganda | Satu posting per (`source_id`, `external_id`). Item kedua ditandai terproses tanpa membuat posting. |
| Payload rusak | Dilewati dan ditandai terproses, dengan `Log::warning` berisi id dan alasan. Dilewati, bukan diulang, karena item itu akan memblokir semua yang di belakangnya. `raw_items` tidak punya kolom galat. |
| Gagal | Dicoba ulang 3 kali, lalu masuk `failed_jobs` dan tampil di `/admin/status` (PRD §13). |
| Idempotensi | Menjalankan ulang tidak menggandakan posting atau akun. |

## Tahap 2: pencocokan topik (`MatchTopicsJob`, `TopicMatcher`)

Hanya topik **aktif** yang dicocokkan. Kata kunci dan teks sama-sama dinormalisasi, lalu kata kunci harus muncul sebagai **kata atau frasa utuh**. Satu kata kunci yang cocok sudah cukup (OR), dan satu posting bisa masuk beberapa topik.

| Kata kunci | Teks | Cocok? | Alasan |
|---|---|:-:|---|
| `korupsi` | "Kasus KORUPSI besar" | ✔ | tidak peka huruf besar-kecil |
| `korupsi` | "korupsinya parah" | ✘ | kata utuh; imbuhan membuat kata lain |
| `korupsi` | "dikorupsi lagi" | ✘ | idem |
| `ad` | "adalah kegiatan rutin" | ✘ | kata kunci pendek tidak cocok di dalam kata lain |
| `TNI-AD` | "Prajurit tni ad bertugas" | ✔ | tanda baca jadi spasi, frasa utuh |
| `tni ad` | "tni dan ad hadir" | ✘ | frasa harus berurutan |
| `korupsi` | "Baca https://x.id/korupsi dari @korupsi" | ✘ | URL dan mention sudah dibuang dari `text_norm` |

**Keterbatasan yang disengaja:**

- Varian kata (imbuhan) tidak otomatis cocok. Analis menambahkan varian sebagai kata kunci tersendiri (`korupsi`, `korupsinya`, `dikorupsi`).
- Mention dan handle tidak bisa dicocokkan, karena `text_norm` membuangnya (PRD §10.4).
- Kata kunci yang tidak berisi huruf atau angka (misal `!!!`) tidak pernah cocok dan ditolak API (`keywords_unmatchable`). Kata kunci berisi `[` atau `]` ditolak (`keyword_has_placeholder`, PRD §9.8).
- Bila aturan normalisasi di kode diubah, jalankan pencocokan ulang topik (ubah topik atau `MatchTopicsJob::forTopic`) agar `topic_matches` ikut diperbarui.

**Pencocokan ulang topik** (`forTopic`) terjadi saat topik dibuat, saat kata kuncinya berubah, dan saat topik diaktifkan kembali. Semua `posts` yang tersimpan dicocokkan lagi, kecocokan lama topik itu diganti, lalu metriknya dibangun ulang. Itu sebabnya grafik topik yang baru dibuat langsung terisi dari data yang sudah diimpor. Menonaktifkan topik menghentikan pencocokan baru tetapi tidak menghapus riwayat kecocokan dan metrik.

## Tahap 3: agregasi (`MetricsAggregator`, `AggregateMetricsJob`, `radarisu:aggregate`)

Satu baris `metrics_hourly` per (topik, jam UTC):

| Kolom | Isi |
|---|---|
| `volume` | jumlah posting yang cocok topik di jam itu |
| `positive_count`, `negative_count` | jumlah per sentimen |
| `neutral_count` | `volume − positive − negative`, jadi tiga hitungan sentimen selalu berjumlah `volume` |
| `unique_accounts` | akun berbeda |
| `source_count` | sumber berbeda |
| `anomalous_accounts` | **milik CoordinationDetector (Fase 4)**. Agregator mengisi 0 pada baris baru dan tidak pernah menimpanya saat memperbarui. |

Batas jam tepat di menit 00 UTC: 08:59:59 masuk jam 08, 09:00:00 masuk jam 09.

| Cara dipicu | Cakupan |
|---|---|
| Setelah pencocokan (`AggregateMetricsJob`) | hanya pasangan (topik, jam) yang terpengaruh |
| `radarisu:aggregate` (tiap 5 menit) | jam-jam dari posting 48 jam terakhir, untuk menutup job yang hilang |
| `radarisu:aggregate --hours=N --topic=ID` | jendela dan topik tertentu |
| `radarisu:aggregate --all` | semua topik dan semua jam, **termasuk membuang jam yang tidak punya posting lagi** |
| `forTopic` | semua jam satu topik, juga membuang jam yang kosong |

Semua cara idempoten. Jendela dihitung dari argumen, bukan dari jam server di dalam kelas; di Fase 4 `DataClock::now()` cukup disuntikkan sebagai awal jendela.

## API F2

Rute, izin, dan audit ada di `docs/CONTRACTS.md` §2.3. Ringkasan perilaku:

**`POST /topics`** (`topics.manage`): `name` ≤150, `category` (`institution`, `impersonation`, `opsec`, `general`), `sensitivity` (bawaan `medium`), `is_active` (bawaan true), `keywords` 1-50 item masing-masing 1-100 karakter. Kata kunci ditrim dan dideduplikasi tanpa peka huruf. Topik dari templat dibuat dengan POST biasa: isian templat memuat `[...]`, jadi harus diganti dulu, bila tidak 422. Mencatat `topic.create`.

**`PATCH /topics/{id}`**: aturan sama, semua field opsional. Baris templat tidak bisa diubah (422, `template_readonly`). Bila tidak ada yang berubah, tidak ada audit dan tidak ada pencocokan ulang. `topic.update` mencatat nama field yang berubah.

**`GET /topics`** (`topics.view`): semua topik, templat di urutan terakhir (`is_template: true`).

**`GET /topics/{id}/metrics?from&to`** (`topics.view`):

- `from` dan `to` berupa tanggal UTC `Y-m-d`; `to` mencakup seluruh harinya, seperti `/audit-logs`.
- Tanpa keduanya: 7 hari yang berakhir pada hari metrik terakhir topik itu (atau hari ini bila belum ada). Rentang relatif terhadap "sekarang" akan menampilkan grafik kosong untuk data historis.
- Rentang maksimum 31 hari (422 `range_too_long`).

```json
{ "data": [
    { "hour": "2026-10-20T08:00:00Z", "volume": 13, "positive_count": 8, "negative_count": 4,
      "neutral_count": 1, "unique_accounts": 10, "anomalous_accounts": 0, "source_count": 1 }
  ],
  "meta": { "from": "2026-10-14T00:00:00Z", "to": "2026-10-21T00:00:00Z", "total": 1, "has_simulated_data": false } }
```

`meta.to` adalah batas akhir yang tidak ikut dihitung. Hanya jam yang punya data yang dikirim; frontend mengisi jam kosong dengan nol. `has_simulated_data` bernilai true bila ada posting simulasi yang cocok di rentang itu (untuk lencana "DATA SIMULASI").

**`/official-accounts`** (`topics.view` untuk membaca, `topics.manage` untuk mengubah): `handle` wajib ≤190 dan unik, `display_name` wajib ≤190, `note` ≤255. `DELETE` mengembalikan 204. Mencatat `official_account.create` dan `official_account.delete`.

## Halaman

| Halaman | Isi |
|---|---|
| `/topics` | Tabel topik, templat, form buat dan ubah (hanya dengan `topics.manage`), serta daftar akun resmi. Pimpinan melihat tanpa tombol kelola. Admin tidak punya `topics.view`: menu tidak muncul dan URL langsung menampilkan layar 403. |
| `/topics/{id}` | Grafik batang bertumpuk per jam (positif, netral, negatif), ringkasan, pemilih rentang tanggal, lencana "DATA SIMULASI". |

Form memakai templat sebagai pengisi awal; tombol simpan nonaktif selagi masih ada `[ ]` di kata kunci.

## Pemecahan masalah

| Gejala | Penyebab umum | Tindakan |
|---|---|---|
| "Item mentah belum diproses" tidak turun | Worker tidak berjalan | `php artisan queue:work --tries=3` |
| Grafik topik kosong padahal data diimpor | Topik tidak aktif, kata kunci tidak cocok sebagai kata utuh, atau rentang tanggal tidak mencakup data | Cek status topik, tambah varian kata kunci, pilih rentang tanggal |
| Grafik tidak sesuai setelah aturan normalisasi diubah | `topic_matches` dan metrik lama | Ubah topik, atau jalankan `radarisu:aggregate --all` bila hanya metriknya |
| Job gagal di `/admin/status` | Lihat `storage/logs/laravel.log` dan tabel `failed_jobs` | `php artisan queue:retry all` setelah penyebabnya diperbaiki |
| Item tertentu tidak menghasilkan posting | Payload rusak atau `external_id` ganda | Cari `Raw item skipped` di `laravel.log` |

## Kinerja yang terukur

Uji lokal 2026-10-23 (PostgreSQL lokal, satu worker, 54 baris contoh lalu CSV 50.000 baris 5,6 MB, satu topik aktif): impor selesai dalam ±4,6 detik, dan seluruh 50.000 item menjadi posting, kecocokan, dan metrik dalam ±43 detik tanpa job gagal. Total kecocokan (18.730) dan jumlah volume per jam cocok dengan hitungan independen dari berkas CSV. Angka ini perkiraan untuk perangkat pengembangan, bukan jaminan; PRD §13 hanya mensyaratkan dasbor termuat < 3 detik pada ±100 ribu posting.
