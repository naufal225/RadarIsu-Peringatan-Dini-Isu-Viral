# Spesifikasi Halaman UI RadarIsu (v1, 2026-10-27)

Pelengkap `docs/UI_DESIGN_SYSTEM.md`. Setiap halaman: pemilik, rute, izin, endpoint, susunan dari atas ke bawah, state, dan **turun-kualitas** bila payload belum lengkap.

Kepemilikan mengikuti `docs/OWNERSHIP.md`. Baca hanya bagian halamanmu, tetapi baca bagian 0 dulu.

## 0. Berlaku untuk semua halaman

- Pola `page.tsx` (fetch) + `*-view.tsx` (presentasi murni). Fixture di `src/fixtures/<domain>.ts`, hanya dipakai `/dev/*` dan tes.
- Judul halaman lewat `PageHeader`. Semua timestamp lewat `<Waktu>`. Semua teks lewat labels.
- State wajib (memuat, kosong, galat, 403, 404 netral, 422 inline, 501) ada di Design System §10.
- Elemen yang tergantung izin memakai `<Can>`/`useCan`, bukan nama peran.
- Prioritas: **Demo** = tampil di skenario PRD §20; **Pendukung** = konsistensi produk; **Polos** = cukup komponen fondasi, jangan dipoles.

---

## Wilayah Naufal

### `/login` · Pendukung
- Izin: publik. Endpoint: `POST /auth/login` lewat BFF (sudah ada).
- Susunan: latar `--paper`; satu panel di tengah (maks 400 px): tanda + wordmark, judul "Masuk ke RadarIsu", subjudul "Sistem peringatan dini isu di ruang siber sosial", bidang email dan kata sandi, tombol utama. Di bawah panel: "Purwarupa Kartika Cyber Hackathon 2026".
- Galat: 401/422 → satu pesan umum "Email atau kata sandi tidak sesuai" (jangan membedakan akun nonaktif). 429 → "Terlalu banyak percobaan. Coba lagi beberapa saat." Pesan memakai ikon + teks.
- Tanpa lambang resmi (Design System §1).

### `/admin/audit` · Demo (langkah 8)
- Izin `audit.view`. Endpoint `GET /audit-logs` (filter `user_id`, `action`, `from`, `to`).
- Susunan: `PageHeader` "Audit" → baris filter (pengguna, aksi, rentang tanggal) → `DataTable` → `Pagination`.
- Kolom: Waktu (`<Waktu utc="inline">`, **UTC terlihat langsung**), Pengguna (null → "Sistem"), Aksi (label dari daftar PRD §9.7), Objek (`object_type #object_id`, mono), IP (mono), Rincian.
- Rincian: baris dapat dibuka menampilkan `detail` JSON sebagai teks mono ter-escape. Tidak ada tombol ubah/hapus (tabel append-only).
- Kosong: "Tidak ada catatan untuk filter ini".

### `/admin/replay` · Demo (langkah 1)
- Izin `replay.manage`. Endpoint: `GET/POST /replay/scenarios`, `POST …/{id}/start`, `POST …/{id}/stop`.
- Susunan: daftar skenario (nama, deskripsi, jumlah baris, status `idle/running/finished/stopped`, `SimBadge`) → panel kontrol skenario terpilih: kecepatan (default dari `default_speed_factor`), tombol **Mulai** dan **Hentikan** (hanya yang valid untuk status) → bagian "Unggah skenario (CSV)".
- Saat `running`: tampil status berjalan dan jam data bila payload ada. Polling ringan (TanStack Query `refetchInterval`) hanya selama `running`.
- Mulai/Hentikan memakai `ConfirmDialog`. Galat 422 tampil inline.
- Catatan: selama Replay timestamp data di depan jam laptop (Design System §5).

### `/admin/sources` · Pendukung
- Izin `sources.view` (kelola: `sources.manage`). Endpoint: `/sources`, `/sources/{id}/test`, `/sources/{id}/import`, `/sources/{id}/imports`.
- `DataTable`: nama, tipe, status (`never/ok/error` dengan ikon+teks; `ok` netral bercentang, `error` merah), terakhir ditarik (`<Waktu>`), interval, aktif. Aksi per baris: Uji koneksi (hanya `rss`/`youtube`), Impor CSV (hanya `csv`), Ubah.
- Form tambah/ubah dalam dialog; bidang `config` berubah menurut tipe (rss: url, max_items; youtube: video_ids; kunci API tidak ada di UI).
- Impor CSV: dialog dengan berkas; hasil menampilkan ringkasan total/sukses/gagal dan tabel baris bermasalah (`row`, kode galat → `errorCodeLabels` di `labels.ts`). Ingat batas: 10 MB, 50.000 baris, seluruh file ditolak 422 bila header salah.
- Hasil uji koneksi selalu 200: tampilkan sebagai data (berhasil/gagal + pesan), bukan galat.
- Prioritas Polos: komponen fondasi, tanpa desain khusus.

### `/admin/users` · Pendukung
- Izin `users.view` (kelola: `users.manage`). Endpoint: `/users`.
- `DataTable`: nama, email, peran (label PRD §14), aktif, login terakhir (`<Waktu>`). Dialog tambah/ubah (nama, peran, aktif). Kata sandi minimal 10 karakter ditegakkan server; tampilkan pesan 422.
- Admin menonaktifkan/menurunkan diri sendiri → 422: tampilkan pesan inline, **jangan** menyembunyikan tombolnya.
- Polos.

### `/admin/settings` · Pendukung
- Izin `settings.manage`. Endpoint: `GET/PUT /settings/detection`.
- Susunan: form per kelompok dalam `Section`:
  - **Lonjakan:** `z_threshold`, `min_volume`, `baseline_hours`, `min_baseline_hours`, `sensitivity_z_offset` (rendah/sedang/tinggi).
  - **Koordinasi:** `coordination_window_minutes`, `similarity_threshold`, `min_accounts_cluster`, `young_account_days`.
  - **Peniruan:** `impersonation_threshold`.
  - **Skor:** `weights` (spike, anomaly, sentiment, reach) dan `severity_cutoffs` (medium, high).
- Tiap bidang punya teks bantu bahasa Indonesia (di `labels/settings.ts`). Total bobot ditampilkan langsung; peringatan bila ≠ 100 (peringatan UI saja, server yang memvalidasi rentang).
- **Pratinjau rumus:** rumus PRD §10.8 dengan nilai bobot dan ambang saat ini.
- Simpan memakai `ConfirmDialog`: "Perubahan memengaruhi deteksi berikutnya dan dicatat di audit."
- Polos selain pratinjau rumus.

### `/topics` dan `/topics/[id]` · Pendukung (grafik berguna untuk demo)
- Izin `topics.view` (kelola: `topics.manage`). Endpoint: `/topics`, `/topics/{id}/metrics?from&to`, `/official-accounts`.
- Daftar: `DataTable` (nama, kategori, sensitivitas, jumlah kata kunci, aktif). Tombol "Buat topik" bila `topics.manage`: pilih dari templat UC1–UC3 atau dari nol. Dari templat, kata kunci yang masih mengandung `[` atau `]` ditolak 422 (PRD §9.8): tampilkan pesan di bawah bidang kata kunci dan beri penanda visual pada placeholder.
- Detail: `PageHeader` (nama, kategori, sensitivitas) → `SignalChart` variant `full` dari metrik → kata kunci (chip) → tab **Akun resmi** (daftar dan tambah/hapus; hapus memakai `ConfirmDialog`).
- Rentang waktu grafik: pilihan 24 jam / 7 hari (`from`/`to`), label WIB.
- Kosong: topik baru tanpa data → "Belum ada data metrik untuk rentang ini".

### `/labeling` · Pendukung
- Izin `labels.manage`. Endpoint: `GET /labeling/posts` (filter `unlabeled`), `PUT /labeling/posts/{id}`.
- Susunan: penghitung kemajuan ("37 dari ±200 diberi label") → daftar satu posting per kartu: teks (mono, ter-escape), akun, waktu, `SimBadge` bila simulasi, dua tombol **Organik** dan **Tidak Wajar**, "Kosongkan label".
- Opsional (tingkat "lebih baik"): pintasan papan ketik 1/2 dan lanjut otomatis ke berikutnya.
- Kosong: "Semua posting sudah berlabel".

### `/evaluation` · Pendukung (menopang nilai Inovasi)
- Izin `evaluation.view` (jalankan: `evaluation.run`). Endpoint: `GET /evaluation/runs`, `POST /evaluation/run`.
- Susunan: `PageHeader` → bila belum ada run: `EmptyState` "Belum ada evaluasi" + tombol Jalankan → bila ada: lima `Stat` (presisi, recall, F1, waktu deteksi, posting berlabel), tabel TP/FP/FN, riwayat run (`DataTable`) → **blok "Keterbatasan" selalu terlihat** (PRD §15.4: ukuran data uji, data simulasi, kamus sentimen sederhana).
- Angka tampil apa adanya dengan format id-ID (0,87). Tidak ada pembulatan yang mempercantik hasil.

---

## Wilayah Rekishi

### `/dashboard` · Demo
- Izin `dashboard.view`. Endpoint: `GET /dashboard/summary`, `GET /dashboard/issues`. Admin dialihkan ke `/admin/status`.
- Susunan:
  1. `PageHeader` "Ringkasan Situasi" + tanggal (`<Waktu format="date">`).
  2. `SimulationBanner` bila `data_notice.has_simulated_data`.
  3. **Kalimat ringkasan** (serif 20), dirakit deterministik dari angka (tanpa LLM): "{n} isu aktif. {m} menunggu keputusan Pimpinan." Bila 0: "Tidak ada isu aktif."
  4. Tiga `Stat`: Isu aktif, Severity tertinggi (`SeverityBadge`, "Tidak ada" bila kosong), Menunggu keputusan.
  5. Seksi **"Perlu tindakan"**: bila `alerts.decide` → alert `escalated`; bila `alerts.triage` → alert `new`. Maksimal 3 kartu (judul, `SeverityBadge`, `ScoreBar` compact, tombol "Buka") + "Lihat semua". Kartu tertinggi diberi garis kiri sesuai severity.
  6. Seksi **"Isu aktif lainnya"**: `DataTable` ringkas (5 teratas).
  7. Seksi **"Tren volume 24 jam"**: `SignalChart` variant `compact` dari `trend_24h`.
- Cakupan peran dilakukan server (leader hanya `escalated/approved/returned`). **Jangan menyaring ulang di klien.**
- Kosong: `EmptyState` "Tidak ada isu aktif" + "Dimuat pukul …".
- Turun-kualitas: payload `/dashboard/issues` belum diketahui (Design System §14). Tanpa skor/breakdown, kartu tampil tanpa `ScoreBar`.

### `/admin/status` · Pendukung
- Izin `system.status`. Endpoint: `GET /system/status` (kesehatan sumber, antrean, jumlah data).
- Susunan: `PageHeader` "Status Sistem" → `Section` "Sumber data" (`DataTable`: nama, tipe, status dengan ikon+teks, terakhir ditarik, galat terakhir dalam mono) → `Section` "Antrean" (`Stat`: job tertunda, job gagal) → `Section` "Data" (`Stat`: jumlah raw item, posting, topik, alert) → status Replay bila payload ada.
- Status: `ok` netral bercentang ("Sehat"), `error` merah dengan ikon ("Galat"), `never` abu ("Belum pernah ditarik").
- Bentuk payload tidak dirinci PRD §11: audit dulu, tulis tipe dari hasilnya.

### `ScoreBar` · komponen Demo
- Kontrak di Design System §9. Cakupan tes Vitest: pembagian lebar segmen dari bobot, penanganan baseline kurang, penanganan impersonation tanpa breakdown, peringatan bila Σ ≠ skor.

---

## Wilayah Kadavi

### `/alerts` · Demo
- Izin `alerts.view`. Endpoint: `GET /alerts` (filter `status`, `severity`, `kind`). Leader otomatis dibatasi server.
- Susunan: `PageHeader` "Alert" → baris filter (status, severity, jenis) + pintasan "Perlu tindakan" (leader: `escalated`; analis: `new`) → `DataTable` → `Pagination`.
- Kolom: Skor (`ScoreBar` compact), Severity (`SeverityBadge`), Judul (nama topik, atau "Peniruan: @handle" untuk `impersonation`), Jenis, Status (`StatusChip`), Terdeteksi (`<Waktu>`), Ditangani (bila payload ada). `rowSeverity` memberi garis kiri. `SimBadge` pada baris simulasi.
- Urut bawaan: skor menurun (selaras indeks PRD §9.5). Filter tersimpan di query string.
- Kosong: "Tidak ada alert untuk filter ini".

### `/alerts/[id]` · Demo (inti produk)
- Izin `alerts.view` + policy. Endpoint: `GET /alerts/{id}` (+ aksi di §8.5). 404 → `NotAvailable` netral.
- **Urutan bagian ditentukan oleh izin, bukan nama peran:**

| Urutan | Pengguna dengan `alerts.triage` (analis) | Pengguna dengan `alerts.decide` (pimpinan) |
|---|---|---|
| Header | Breadcrumb, judul serif, `SeverityBadge lg`, `StatusChip`, terdeteksi (`<Waktu>`), `SimBadge` bila simulasi | sama |
| 1 | Ringkasan sinyal: `SignalChart` (issue) atau perbandingan nama (impersonation) | **Ringkasan** satu kalimat (dirakit deterministik) + **Rekomendasi Analis** sebagai kutipan menonjol |
| 2 | Anatomi Skor: `ScoreBar detailed` | `ScoreBar compact` yang dapat diperluas ke detail |
| 3 | `EvidenceMap` penuh | `SignalChart` |
| 4 | `DecisionTrail` | `EvidenceMap` ringkas (5 teratas + "Lihat semua") |
| 5 | | `DecisionTrail` |

- **Kolom kanan (sticky):** `DecisionPanel`. Untuk pimpinan, ia berada paling atas karena keputusan adalah tujuan.
- Ringkasan deterministik (`summarizeAlert`, fungsi murni + tes), contoh: "Topik '{topik}' menunjukkan indikasi lonjakan; {n} akun ditandai karena teks sangat mirip." Gunakan kosakata Design System §4. Kalimat hanya memuat angka yang ada di payload.
- **Peniruan akun:** tanpa grafik. Bagian 1 = dua kolom berdampingan (akun resmi vs akun terdeteksi): handle, nama tampilan, umur akun, kemiripan. Penyorotan karakter yang berbeda adalah tingkat "lebih baik", bukan syarat.
- Setelah aksi sukses: invalidasi query detail dan jejak; toast netral.
- Turun-kualitas: lihat Design System §14 (strip waktu, baseline, breakdown peniruan).

### `/briefings` · Demo
- Izin `briefings.view`. Endpoint: `GET /briefings`, `GET /briefings/{id}/download`.
- Susunan: `PageHeader` "Briefing" → grid kartu laporan (2–3 kolom): judul, ringkasan dua baris, tautan ke alert, `SeverityBadge`, dibuat oleh, `<Waktu>`, tombol Unduh (bila `briefings.download`).
- Kartu sama tingginya. Bukan kartu berwarna solid.
- Kosong: "Belum ada briefing. Briefing disusun dari halaman detail alert."
- "Susun briefing" ada di `DecisionPanel` (analis): dialog judul + ringkasan → buat → unduh. Bentuk body endpoint harus dicek (Design System §14).

### Briefing PDF · Demo
- Template dan aturan: Design System §13. Ini keluaran yang dipegang Pimpinan dan juri. Periksa hasil cetak pada alert simulasi dan non-simulasi, dan cetak hitam-putih.

---

## Dev dan penguji

- `/dev/styleguide` (pemilik fondasi): semua komponen fondasi dalam semua variannya dan state-nya, memakai `fixtures/common.ts`.
- `/dev/preview/<domain>` (pemilik domain): `*-view.tsx` halamanmu dengan fixture. Rute `/dev/*` mengembalikan `notFound()` di produksi kecuali `NEXT_PUBLIC_ENABLE_DEV_ROUTES=1`.
