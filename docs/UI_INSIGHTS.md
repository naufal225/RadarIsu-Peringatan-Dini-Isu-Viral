# Analisis data dan peluang insight (UI)

Tanggal: 2026-11-14. Basis: database lokal (`radarisu`) dan skema tabel. Semua angka di bawah diambil dengan query read-only.

Aturan yang dipegang: insight hanya dari data yang sudah ada dan endpoint yang sudah ada (PRD §6.1). Tidak ada model bahasa, tidak ada jaringan graf dan peta (PRD §6.2, ditunda). Tidak ada angka yang dikarang (CLAUDE.md).

## 1. Isi data saat ini

| Tabel | Baris | Catatan |
|---|---|---|
| posts | 4.394 | **semua `is_simulated = true`** |
| raw_items | 4.394 | sama dengan posts |
| accounts | 65 | umur akun tercatat untuk semua |
| topic_matches | 3.788 | posting yang cocok topik |
| metrics_hourly | 76 jam | 25 Okt 08.00 sampai 28 Okt 11.00 UTC; total volume 3.788; puncak 509 posting per jam |
| alerts | 1 | severity sedang, status `reviewing` |
| alert_evidence | 120 | `synchronized_posting` 40, `similar_text` 40, `young_account` 30, `spike_sample` 10 |
| replay_rows | 202 | `baseline` 150, `incident` 52 |
| evaluation_runs | 6 | presisi, recall, dan F1 semuanya 1,0 |
| audit_logs | 82 | `replay.start` 22, `auth.login` 25, `source.update` 9 |
| posts.label_manual | 4.394 berlabel | `organic` 3.554, `anomalous` 840 |

## 2. Temuan yang membatasi

1. **Semua data adalah simulasi.** Tidak ada satu pun posting nyata di database lokal. Setiap insight harus diberi penanda data simulasi. Kalau tidak, juri akan membaca angka ini sebagai kondisi nyata.
2. **Sentimen tidak bervariasi.** Semua 4.394 posting berlabel `neutral`. Komponen sentimen di skor selalu 0 untuk alert ini. Ini bukan insight, tapi sinyal kualitas: kamus sentimen tidak menghasilkan variasi pada data demo. Harus ditampilkan jujur sebagai catatan, bukan disembunyikan.
3. **Hanya satu alert.** Insight yang bertumpu pada banyak alert (tren alert, distribusi severity, waktu penanganan) tidak bisa dibuat kuat dengan data ini.
4. **Evaluasi sempurna (1,0) dan dikalibrasi pada data yang sama.** Sudah dicatat di batasan halaman Evaluasi. Angka ini tidak boleh ditampilkan sebagai kemampuan deteksi.
5. **Waktu deteksi negatif** pada dua run. Sudah diputuskan (OPEN_QUESTIONS #37).

## 3. Insight yang bisa dibangun (dengan sumber data)

| # | Insight | Sumber | Halaman | Catatan |
|---|---|---|---|---|
| A | **Replay dinamis**: grafik volume per jam yang tumbuh mengikuti jam virtual selama Replay berjalan | `metrics_hourly` + status replay (`virtual_anchor_at`, `clock`) | `/admin/replay` | Paling kuat untuk demo. Perlu polling status dan data metrik. Hanya menampilkan jam yang sudah lewat. |
| B | Komposisi bukti per alert: berapa akun baru, berapa sinkron, berapa mirip | `alert_evidence` | `/alerts/[id]` | Mudah. Ringkasan satu baris dari angka yang sudah ada. |
| C | Sebaran umur akun dalam topik (berapa akun di bawah ambang `young_account_days`) | `accounts.platform_created_at` + pengaturan | `/topics/[id]` | Mendukung F4 dan F13. Akun tanpa tanggal tidak dihitung. |
| D | Proporsi organik vs tidak wajar pada data berlabel, dan kenaikannya per hari | `posts.label_manual` | `/labeling` | Sudah ada angka progres. Tambahan: sebaran per hari. |
| E | Riwayat F1 dan presisi antar run, dengan matriks TP/FP/FN | `evaluation_runs` | `/evaluation` | Sudah ada tabel. Tambahan: grafik tren dan matriks kecil. |
| F | Aktivitas audit per jenis aksi dan per hari | `audit_logs` | `/admin/audit` | Ringkasan di atas tabel. Berguna untuk tata kelola. |
| G | Cakupan topik: berapa posting cocok dengan topik aktif, berapa tidak cocok | `topic_matches`, `posts` | `/dashboard` atau `/topics` | Menjawab "apakah data kita relevan". |
| H | Kesehatan sentimen: distribusi `sentiment` dan `sentiment_score` | `posts.sentiment` | `/admin/status` | Menampilkan catatan kualitas di poin 2. |
| I | Sumber dan kualitas impor: status tiap sumber dan jumlah baris belum diproses | `sources`, `raw_items` | `/admin/status` | Sebagian sudah ada. |
| J | Jam puncak dan rata-rata volume per topik | `metrics_hourly` | `/dashboard`, `/topics/[id]` | Sudah sebagian ada di dasbor. |

## 4. Usulan urutan

1. **A (replay dinamis).** Ini yang Anda sebut sebagai contoh, dan dampaknya paling besar untuk demo.
2. **B dan E.** Sumbernya sudah ada dan cepat dibuat.
3. **H dan catatan kualitas sentimen.** Penting agar tidak ada angka sentimen yang menyesatkan.
4. **C, D, F, G, I, J** sesuai waktu.

Setiap insight harus punya label "Data simulasi" di halaman yang memakainya, sesuai UI_DESIGN_SYSTEM §6.

## 5. Keputusan yang perlu Anda

- Apakah insight H (sentimen flat) ditampilkan apa adanya sebagai catatan kualitas, atau kamus sentimen diperbaiki dulu? Memperbaiki kamus termasuk mengubah F5, dan itu di luar pekerjaan UI.
- Replay dinamis (A): apakah cukup polling setiap beberapa detik, atau perlu stream? Polling cukup untuk demo, dan tidak menambah infrastruktur.
