# Pengaturan deteksi (F15)

Dokumen ini menjelaskan setiap kunci pada `settings.detection` dan setiap aturan validasinya: untuk apa, bagian sistem mana yang memakainya, dan apa akibatnya bila nilainya diubah. Sumber nilai awal adalah PRD §9.6 (`Setting::DETECTION_DEFAULTS`). Rumus ada di PRD §10.5-§10.8.

## Untuk apa

Detektor dan skor ancaman tidak memuat angka sendiri. Semua ambang dan bobot dibaca dari tabel `settings` lewat `Setting::detection()`, sehingga Admin dapat mengkalibrasi sistem dari `/admin/settings` tanpa mengubah kode (CLAUDE.md, PRD §0 butir 6).

Alur kalibrasi (PRD §15 butir 5):

1. Beri label manual pada posting dan jalankan Evaluasi untuk mendapat presisi, recall, dan F1 awal.
2. Ubah satu kelompok pengaturan di `/admin/settings`. Pratinjau rumus di halaman itu membantu melihat dampak pada skor.
3. Tunggu satu siklus `radarisu:detect` (setiap menit), jalankan ulang Evaluasi, lalu bandingkan.
4. Ulangi. Ubah sedikit demi sedikit agar sebab dan akibat jelas.

Perubahan tidak mengubah riwayat. Alert yang sudah dibuat tetap menyimpan `score_breakdown` beserta ambang yang dipakai saat itu. Alert yang masih terbuka diperbarui skornya oleh detektor pada siklus berikutnya (PRD §10.9).

## Kunci

### Deteksi lonjakan (PRD §10.5)

Detektor membandingkan jumlah posting topik dalam 60 menit terakhir (`current`) dengan baseline dari `metrics_hourly`, lalu menghitung `z = (current − rata-rata) / max(simpangan baku, 1)`. Lonjakan terpicu bila `z ≥ z_eff` **dan** `current ≥ min_volume`.

| Kunci | Default | Rentang | Arti dan dampak |
|---|---|---|---|
| `z_threshold` | 3,0 | 2,0-10 | Ambang dasar z. **Naik:** hanya lonjakan besar yang memicu, alert lebih sedikit dan lebih meyakinkan, tetapi lonjakan dini bisa terlewat. **Turun:** lebih peka, lebih banyak false positive. `z_eff = max(2,0; z_threshold + offset sensitivitas topik)`. |
| `min_volume` | 20 | 1-10.000 | Jumlah posting minimum dalam 60 menit agar lonjakan dihitung. Mencegah topik sepi memicu alert hanya karena angka kecil naik tajam (misal 1 menjadi 5). **Naik:** topik kecil tidak pernah memicu. **Turun:** topik kecil ikut memicu. |
| `baseline_hours` | 168 | 24-720 | Berapa jam riwayat (tanpa jam berjalan) yang membentuk rata-rata dan simpangan baku normal. 168 jam = satu minggu, sehingga pola harian dan mingguan ikut tercakup. **Naik:** baseline stabil tetapi lambat menyesuaikan perubahan pola. **Turun:** baseline cepat menyesuaikan tetapi mudah terseret oleh lonjakan sebelumnya. |
| `min_baseline_hours` | 24 | 1-720 | Jumlah jam riwayat minimum agar baseline dipercaya. Bila riwayat topik lebih sedikit, deteksi lonjakan dilewati dan komponen `spike` pada skor bernilai 0, tanpa galat. Berguna untuk topik baru yang belum punya pembanding. |
| `spike_current_window_minutes` | 60 | 15-180 | Rentang waktu terakhir yang dihitung sebagai `current`. Bawaan sama dengan PRD §10.5 (60 menit). **Naik:** volume saat ini lebih halus tetapi lonjakan baru terlihat lebih lambat. |
| `spike_sample_limit` | 10 | 1-50 | Jumlah maksimum posting contoh (`spike_sample`) yang disimpan sebagai bukti. Bawaan sama dengan PRD §10.9 (10). |

### Deteksi koordinasi akun (PRD §10.6)

Posting topik dalam `coordination_window_minutes` terakhir dikelompokkan berdasarkan kemiripan teks. Klaster dengan akun berbeda yang cukup banyak ditandai terkoordinasi, lengkap dengan bukti `similar_text`, `young_account`, dan `synchronized_posting`.

| Kunci | Default | Rentang | Arti dan dampak |
|---|---|---|---|
| `coordination_window_minutes` | 15 | 1-180 | Lebar jendela waktu posting yang dibandingkan. **Naik:** menangkap kampanye yang menyebar pelan, tetapi mencampur posting yang kebetulan mirip dan memperberat query. **Turun:** hanya menangkap kampanye serentak. |
| `similarity_threshold` | 0,8 | 0,3-1,0 | Kemiripan trigram (`pg_trgm`, 0 sampai 1) antar `text_norm` agar dua posting masuk satu klaster. **Naik:** hanya teks nyaris identik. **Turun:** teks yang sekadar mirip ikut terkelompok, rawan klaster palsu pada isu yang memang ramai dibicarakan. |
| `min_accounts_cluster` | 5 | 2-1.000 | Jumlah akun berbeda minimum dalam satu klaster. Satu akun yang mengulang pesan tidak dihitung sebagai koordinasi. **Naik:** lebih sedikit klaster, lebih yakin. **Turun:** lebih peka, lebih banyak kebetulan. |
| `young_account_days` | 30 | 1-365 | Akun yang usianya (saat memposting) kurang dari ini mendapat bukti `young_account`. Pada deteksi peniruan, akun muda menambah 30 poin skor. **Naik:** lebih banyak akun dianggap baru. **Turun:** hanya akun benar-benar baru. |
| `synchronized_window_minutes` | 5 | 1-60 | Posting klaster dihitung serentak bila berada dalam rentang ini. Bawaan sama dengan PRD §10.6 (5 menit). |
| `synchronized_ratio` | 0,8 | 0,5-1,0 | Bukti `synchronized_posting` diberikan bila sekurang-kurangnya porsi ini dari posting klaster berada dalam jendela serentak. Bawaan sama dengan PRD §10.6 (80%). |
| `coordination_max_posts` | 2000 | 100-20.000 | **Tidak ada di PRD.** Batas posting per topik per jendela yang dibandingkan, agar pembandingan teks tidak tumbuh kuadratik. Bila terlampaui, hanya posting terbaru yang dibandingkan dan bukti ditandai `truncated`. **Naik:** cakupan lebih penuh tetapi query lebih berat. |

### Deteksi peniruan identitas (PRD §10.7)

Akun yang pertama kali terlihat dalam 24 jam terakhir dibandingkan dengan `official_accounts`.

| Kunci | Default | Rentang | Arti dan dampak |
|---|---|---|---|
| `impersonation_threshold` | 0,6 | 0,3-1,0 | Kemiripan terbesar antara handle atau nama tampilan akun baru dengan akun resmi. Terpicu bila nilainya sama atau lebih, **dan** handle tidak sama persis dengan akun resmi. **Naik:** hanya tiruan yang sangat mirip. **Turun:** lebih banyak akun ikut ditandai, termasuk yang kebetulan bernama mirip. |
| `impersonation_window_hours` | 24 | 1-168 | Hanya akun dengan `first_seen_at` dalam rentang ini yang dibandingkan. Bawaan sama dengan PRD §10.7 (24 jam). |

Skor dan severity alert peniruan: `score = round(kemiripan × 70) + 30 bila akun muda`, dan severity memakai `severity_cutoffs` yang sama dengan alert `issue` (sama dengan `ThreatScorer::scoreImpersonation`). PRD §10.7 tidak menyebut aturan severity untuk peniruan; ini keputusan sementara yang tercatat di `docs/OPEN_QUESTIONS.md`.

Tabel pemetaan nama **bukan** pengaturan: `config/impersonation.php` berisi karakter mirip (`confusables`, mis. `0`→`o`, `rn`→`m`), bacaan alternatif (`alternatives`, `1` sebagai `i`), huruf Cyrillic/Yunani yang mirip Latin (`homoglyphs`), dan imbuhan yang dibuang di awal atau akhir nama (`affixes`, mis. `official`, `resmi`, `id`). Tambahkan baris untuk memperluasnya; perubahan berlaku pada siklus berikutnya karena akun yang sebelumnya dinilai bersih diperiksa ulang. Alasan dan batasannya ada di `docs/OPEN_QUESTIONS.md` #20 dan #23.

### Pengendalian alert berulang

| Kunci | Default | Rentang | Arti dan dampak |
|---|---|---|---|
| `cooldown_minutes` | 60 | 0-10.080 | **Tidak ada di PRD** (celah yang tercatat di OPEN_QUESTIONS). Setelah alert untuk sebuah topik atau akun berstatus `approved`, `false_positive`, atau `closed`, detektor tidak membuat alert baru untuk subjek yang sama sebelum jeda ini berlalu sejak penyelesaiannya. 0 berarti tanpa jeda (perilaku PRD apa adanya). Alert yang masih terbuka tidak terpengaruh: ia tetap diperbarui (PRD §10.9). |

### Bobot skor ancaman (PRD §10.8)

Skor alert `issue` adalah jumlah empat komponen, masing-masing dibatasi bobotnya:

```
spike     = min(z / 6, 1)                          × weights.spike
anomaly   = min(akun_anomali / akun_unik, 1)       × weights.anomaly
sentiment = (posting_negatif / volume)             × weights.sentiment
reach     = min(sumber / sumber_aktif, 1)          × weights.reach
skor      = round(spike + anomaly + sentiment + reach)
```

| Kunci | Default | Rentang | Arti dan dampak |
|---|---|---|---|
| `weights.spike` | 40 | 0-100 | Poin maksimum dari besarnya lonjakan volume. Penuh saat z mencapai 6. |
| `weights.anomaly` | 30 | 0-100 | Poin maksimum dari porsi akun yang ditandai oleh deteksi koordinasi. |
| `weights.sentiment` | 20 | 0-100 | Poin maksimum dari porsi posting bersentimen negatif. Sentimen berbasis kamus sederhana, jadi sebaiknya bukan bobot terbesar (PRD §21). |
| `weights.reach` | 10 | 0-100 | Poin maksimum dari porsi sumber aktif yang ikut membahas topik. |

Menaikkan satu bobot berarti komponen itu lebih menentukan severity. Karena jumlah bobot tetap 100, menaikkan satu bobot menuntut menurunkan bobot lain.

### Batas severity (PRD §10.8)

| Kunci | Default | Rentang | Arti dan dampak |
|---|---|---|---|
| `severity_cutoffs.medium` | 40 | 0-100 | Skor minimum severity Sedang. Di bawahnya Rendah. |
| `severity_cutoffs.high` | 70 | 0-100 | Skor minimum severity Tinggi. **Naik:** lebih sedikit alert Tinggi. **Turun:** lebih banyak alert Tinggi, sehingga Pimpinan dan Analis lebih sering dibebani. |

### Sensitivitas topik (PRD §10.5)

Setiap topik punya `sensitivity` (`low`, `medium`, `high`). Offset di bawah ditambahkan ke `z_threshold` sebelum dibandingkan dengan `z`.

| Kunci | Default | Rentang | Arti dan dampak |
|---|---|---|---|
| `sensitivity_z_offset.low` | +1,0 | -3 sampai 3 | Topik rendah: ambang efektif lebih tinggi (default 4,0), lebih sulit memicu. |
| `sensitivity_z_offset.medium` | 0,0 | -3 sampai 3 | Topik sedang: memakai `z_threshold` apa adanya. |
| `sensitivity_z_offset.high` | -0,5 | -3 sampai 3 | Topik tinggi (misal istilah OPSEC): ambang efektif lebih rendah (default 2,5), lebih mudah memicu. |

## Aturan validasi dan alasannya

`PUT /settings/detection` mengganti seluruh nilai. Semua kunci wajib ada dan bertipe angka sebenarnya (string seperti `"25"` ditolak, bilangan bulat tidak boleh pecahan). Kunci di luar daftar di atas diabaikan dan tidak disimpan. Bila ada yang tidak valid, **tidak ada yang disimpan** dan respons 422 menyebut nama field-nya.

| Aturan | Akibat terhadap sistem bila dilanggar |
|---|---|
| **Jumlah keempat bobot = 100** | Skor dijamin 0-100 (PRD §19.3 butir 5). Bila jumlahnya lebih, skor bisa melewati 100 dan severity jadi tidak bermakna. Bila kurang, skor tertinggi yang mungkin di bawah 100 sehingga batas Tinggi bisa tidak pernah tercapai. |
| **`severity_cutoffs.medium` < `high`** | Bila sama atau terbalik, tingkat Sedang tidak mungkin tercapai atau urutan Rendah/Sedang/Tinggi tidak konsisten. |
| **`min_baseline_hours` ≤ `baseline_hours`** | Baseline hanya pernah berisi sebanyak `baseline_hours` jam. Bila minimum lebih besar, syaratnya tidak pernah terpenuhi dan deteksi lonjakan mati permanen tanpa tanda galat. |
| **Offset `low` ≥ `medium` ≥ `high`** | Sensitivitas tinggi harus lebih mudah memicu. Urutan terbalik membuat topik yang ditandai penting justru paling sulit memicu alert. |
| **`z_threshold` ≥ 2,0 dan `z_eff` ≥ 2,0** | Di bawah z = 2, fluktuasi normal sudah cukup untuk memicu (kira-kira 1 dari 20 pengamatan pada data normal), sehingga alert dibanjiri noise. Batas 2,0 juga dipaksa pada nilai efektif (PRD §10.5) walaupun offset negatif besar. |
| **Rentang tiap kunci** | Mencegah nilai yang membuat detektor tidak berfungsi (misal jendela 0 menit, klaster 1 akun, kemiripan di bawah 0,3 yang menyatukan hampir semua teks) atau membebani database (jendela atau baseline terlalu besar). |

Rentang dan aturan jumlah bobot = 100 adalah keputusan implementasi karena PRD hanya menyebut "validasi rentang nilai". Keputusan ini tercatat di `docs/OPEN_QUESTIONS.md` menunggu persetujuan.

## Mode Offline

`settings.offline_mode` = `{"enabled": bool}`. Bila aktif, `radarisu:ingest` melewati sumber `rss` dan `youtube` (PRD §10.2); CSV dan Replay tetap berjalan. Dibaca oleh `SourceController` dan `/system/status`.

- `GET /settings/offline-mode` mengembalikan `{key, value:{enabled}, updated_at, updated_by}`.
- `PUT /settings/offline-mode` dengan body `{"enabled": true|false}`. Nilai harus boolean sebenarnya (`1`, `"true"` ditolak dengan 422). Mencatat satu baris audit `settings.update` dengan `detail = {key: "offline_mode", changes: {enabled: {from, to}}}`. Bila nilainya tidak berubah, respons tetap 200 dan tidak ada baris audit.
- Izin: `settings.manage` (hanya Admin).

## Perilaku API

- `GET /settings/detection` mengembalikan `{key, value, updated_at, updated_by}`. Sebelum pernah diubah, `updated_at` dan `updated_by` bernilai `null`.
- `PUT /settings/detection` mencatat satu baris audit `settings.update` dengan `detail = {key: "detection", changes: {"weights.spike": {from: 40, to: 35}, ...}}`. Bila tidak ada nilai yang berubah, respons tetap 200 dan tidak ada baris audit.
- `Setting::detection()` tidak di-cache, sehingga perubahan dipakai detektor pada eksekusi berikutnya. Kunci yang hilang dari baris tersimpan diisi dari nilai awal.
- Izin: `settings.manage` (hanya Admin). Otorisasi ditegakkan di Laravel; frontend hanya menyembunyikan menu.
