# Sistem Desain UI RadarIsu (v1, 2026-10-27)

Dokumen ini adalah **sumber tunggal** keputusan visual dan perilaku komponen. Dibaca semua agent dan anggota sebelum menulis UI.

Urutan baca: `CLAUDE.md` → `docs/OWNERSHIP.md` → dokumen ini → `docs/UI_PAGES.md` (bagianmu) → `docs/UI_WORKPLAN.md`.
Jika dokumen ini bertentangan dengan `docs/PRD.md` soal **perilaku produk**, PRD menang. Tulis konfliknya di `docs/OPEN_QUESTIONS.md`, jangan menebak.

---

## 1. Keputusan yang sudah final

| Hal | Keputusan |
|---|---|
| Arah | **"Cyber"** (revisi 2026-11-14, menggantikan "Lembar Situasi"): tema gelap, berpusat pada kasus (alert), bahasa laporan tetap formal. Nilai token tema Cyber ditetapkan di tahap desain; sampai itu, nilai token di §3 masih berlaku |
| Grafik | Gaya **"Denyut Isu"**: satu grafik volume yang bermakna, hanya di detail alert, detail topik, dan dasbor |
| Tema | Gelap sebagai tema utama (revisi 2026-11-14). Semua warna dari variabel CSS di `globals.css`, tanpa hex di komponen |
| Identitas | Institusional tingkat 2: zaitun tua sebagai warna merek, bahasa formal, footer purwarupa. **Lambang resmi TNI AD tidak dipakai** kecuali panitia memberi aset atau izin tertulis |
| Bahasa | UI berbahasa Indonesia, kode berbahasa Inggris (PRD §0) |
| Waktu | WIB di UI, UTC di database, UTC terlihat saat hover/fokus |
| Kepadatan | Tabel padat (baris 40 px), kartu longgar |
| Desktop dulu | Target utama laptop/layar besar. Tablet dan ponsel harus terbaca, tidak mengejar paritas fitur |

## 2. Aturan keras

Pelanggaran aturan ini ditolak saat review.

1. **Warna hanya dari token.** Dilarang hex/rgb/hsl di komponen, nilai arbitrer Tailwind (`bg-[#...]`), dan style inline. Pengecualian: `globals.css` dan template PDF.
2. **Dilarang:** gradien, bayangan dekoratif, blur/kaca, donut/pie, gauge, avatar atau foto orang, kartu KPI berwarna solid, animasi masuk, emoji sebagai ikon. **Glow hanya untuk status fokus dan alert kritis** (revisi 2026-11-14).
3. **Tidak ada warna hijau** di sistem. Zaitun adalah merek, bukan status "aman".
4. **Satu warna, satu makna:** merah/amber/abu-biru hanya untuk severity (merah juga untuk galat); zaitun hanya untuk merek dan interaksi; biru `--sim` hanya untuk simulasi.
5. Severity dan status **tidak pernah hanya warna**: selalu ikon + teks.
6. Status alur kerja (Baru, Ditinjau, dst.) **monokrom**: kontur, ikon, teks.
7. **Tanpa dependensi UI baru** tanpa dicatat di `docs/HANDOFF.md` (alasan + ukuran). Yang sudah disetujui PRD §12.1: shadcn/ui, TanStack Query, react-hook-form, zod, Recharts, lucide-react. **Keputusan 2026-10-27:** yang dipasang hanya Recharts, `lucide-react`, dan font `@fontsource-variable/*`. shadcn/ui, TanStack Query, react-hook-form, dan zod tidak dipakai; halaman memakai `lib/use-api-data.ts`, dan komponen dasar (Button, Field, ConfirmDialog berbasis `<dialog>`) ada di `components/radar/`.
8. Teks postingan dari sumber luar selalu di-escape. `dangerouslySetInnerHTML` dilarang.
9. String yang dibaca pengguna hanya lewat `frontend/src/lib/labels.ts` dan `lib/labels/{domain}.ts`.
10. UI bergantung pada **izin** (`useCan`, `<Can>`), bukan nama peran. Server tetap penentu akhir.
11. **Tidak ada data palsu di halaman asli.** Fixture hanya di `/dev/*` dan tes.
12. Tidak ada waktu relatif ("3 menit lalu") untuk data bertimestamp. Selama Replay, jam browser dan jam data berbeda.
13. Font **di-bundle**. Tidak ada CDN atau Google Fonts saat runtime (PRD §5 dan §16 menjanjikan mode offline).
14. Ikuti kosakata di bagian 4.

## 3. Token

Sumber nilai: tabel ini. `frontend/src/app/globals.css` harus mencerminkannya persis. Perubahan nilai lewat PR yang disetujui pemilik fondasi dan diumumkan di `HANDOFF.md`.

### 3.1 Warna

| Token | Nilai | Fungsi |
|---|---|---|
| `--paper` | `#F5F4EE` | Latar halaman |
| `--panel` | `#FFFFFF` | Kartu/panel. Satu level saja, tidak ada kartu di dalam kartu |
| `--line` | `#E1DED3` | Garis pemisah dan batas kartu |
| `--line-input` | `#8A9285` | Batas input/kontrol (kontras ≥ 3:1 terhadap panel) |
| `--hover` | `#F0EEE5` | Latar baris saat hover |
| `--ink` | `#1B2418` | Teks utama |
| `--ink-muted` | `#566052` | Teks sekunder. Jangan dipakai untuk isi yang harus terbaca saat demo |
| `--brand` | `#3B4A2F` | Zaitun tua: tombol utama, tautan, cincin fokus |
| `--brand-fg` | `#FFFFFF` | Teks di atas `--brand` |
| `--brand-tint` | `#E7EBDF` | Baris terpilih, track grafik, sorotan halus |
| `--sidebar` | `#26301F` | Latar sidebar |
| `--sidebar-fg` | `#E8ECE2` | Teks sidebar |
| `--sidebar-muted` | `#B5BFAA` | Teks sekunder sidebar |
| `--sev-high` / `--sev-high-bg` | `#B42318` / `#FDECEA` | Severity Tinggi; juga galat |
| `--sev-medium` / `--sev-medium-bg` | `#B54708` / `#FEF0DC` | Severity Sedang |
| `--sev-low` / `--sev-low-bg` | `#5B6676` / `#EEF0F3` | Severity Rendah (abu-biru, sengaja bukan hijau) |
| `--sim` / `--sim-bg` | `#1E5A96` / `#E6EFF8` | Penanda data simulasi |
| `--viz-1` … `--viz-4` | `#26301F` `#4B5E3A` `#7A8C66` `#A3B08F` | Segmen `ScoreBar` (keluarga zaitun) |
| `--chart-volume` | `#3B4A2F` | Garis volume. Isi area: 12% opasitas dari warna ini |
| `--chart-grid` | `#E1DED3` | Grid grafik |
| `--chart-ref` | `#566052` | Garis acuan putus-putus (rata-rata/ambang) |

Hanya satu elemen jenuh di grafik: **pin alert**, berwarna sesuai severity.

Pemetaan ke variabel shadcn (nama bisa berbeda per versi; sesuaikan nama, **jangan ubah nilai**): `background`=paper, `foreground`=ink, `card`/`popover`=panel, `primary`=brand, `primary-foreground`=brand-fg, `secondary`/`accent`=brand-tint, `muted`=hover, `muted-foreground`=ink-muted, `destructive`=sev-high, `border`=line, `input`=line-input, `ring`=brand, `radius`=6px, grup `sidebar*`=token sidebar.

### 3.2 Kontras (perkiraan hitung manual)

| Pasangan | Rasio ≈ | Target |
|---|---|---|
| ink di paper | 14 | AA 4,5 |
| ink-muted di panel | 6,6 | AA 4,5 |
| sev-high di sev-high-bg | 5,7 | AA 4,5 |
| sev-medium di sev-medium-bg | 4,9 | AA 4,5 |
| sev-low di sev-low-bg | 5,0 | AA 4,5 |
| brand-fg di brand | 9,5 | AA 4,5 |
| sidebar-muted di sidebar | 7,1 | AA 4,5 |
| brand-fg di sim | 7,1 | AA 4,5 |
| sim di sim-bg | 6,1 | AA 4,5 |

Angka ini perkiraan, **belum diukur dengan alat**. Di tahap fondasi, verifikasi dengan pemeriksa kontras WCAG dan laporkan hasil sebenarnya. Koreksi token bila ada yang di bawah 4,5.

### 3.3 Tipografi

| Dipakai untuk | Huruf | Ukuran/bobot |
|---|---|---|
| Judul halaman, kalimat ringkasan situasi, judul PDF | Source Serif 4 | 24/32 (600) dan 20/28 (500) |
| Seluruh UI | Inter | body 14/20, tabel 13/20, keterangan 12/16, judul seksi 16/24 (600) |
| Angka metrik besar | Inter, `tabular-nums` | 32/36 (600) |
| Timestamp, handle akun, ID, teks bukti, nilai teknis | JetBrains Mono | 12–13 |

Font di-bundle lewat paket `@fontsource-variable/*` (Inter, Source Serif 4, JetBrains Mono) atau berkas woff2 di repo dengan `next/font/local`. **Verifikasi nama paket dan ketersediaannya di tahap 0**; jangan menebak. Tidak boleh `next/font/google` jika build harus jalan tanpa jaringan.

### 3.4 Ruang, bentuk, gerak

- Dasar 4 px. Jarak antar-kartu 24. Padding kartu 20. Padding halaman 32 (desktop), 16 (ponsel).
- Radius 6 px untuk kartu, input, tombol. Badge 4 px.
- Tidak ada bayangan. Pemisah memakai garis 1 px `--line`.
- Cincin fokus: 2 px `--brand`, offset 2 px.
- Gerak hanya fungsional: transisi 120–150 ms untuk hover/fokus. Hormati `prefers-reduced-motion`. Skeleton boleh berdenyut halus.
- Ikon: `lucide-react`, 16 px, selalu berpasangan dengan label untuk severity/status.

## 4. Kosakata dan format

**Prinsip PRD §1:** sistem menandai **pola tidak wajar**, tidak menyatakan sesuatu "hoaks" atau akun "bot pasti". Keputusan akhir manusia.

| Pakai | Hindari |
|---|---|
| ditandai, indikasi, pola tidak wajar, kemiripan, perlu ditinjau, akun yang ditandai, terdeteksi | bot, hoaks/hoax, pelaku, bersalah, musuh, terbukti, pasti |
| skor ancaman (istilah PRD F7) | "ancaman terbukti", "serangan" untuk narasi organik |

Label status, severity, jenis, sentimen, alasan bukti, dan aksi **mengikuti PRD §14 persis** (mis. `false_positive` → "False Positive", `return` → "Minta analisis lanjutan"). Jangan menciptakan sinonim.

Format angka dan tanggal:
- Angka: `Intl.NumberFormat('id-ID')` (ribuan titik, desimal koma). Kemiripan ditampilkan persen tanpa desimal ("91%"), nilai mentah di tooltip ("0,912").
- Skor: bilangan bulat 0–100.
- Tidak ada format tanggal selain komponen `<Waktu>`.

## 5. Waktu

Komponen tunggal `<Waktu>` di `components/radar/waktu.tsx`. Util di `lib/format/time.ts` (dengan tes Vitest).

| Aturan | Isi |
|---|---|
| Tampilan | `27 Okt 2026 · 14.29 WIB`, huruf mono |
| Mesin | `Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hourCycle: 'h23', ... })`. **Selalu isi `timeZone` eksplisit** agar server dan browser tidak berbeda (hidrasi). Akhiran "WIB" ditulis manual karena Intl tidak mengeluarkannya |
| Hover dan fokus | Tooltip: `07.29 UTC` + nilai ISO. Elemen bisa difokuskan (`tabIndex=0`) karena hover tidak ada di keyboard dan ponsel. Memakai elemen `<time dateTime=...>` |
| `utc="inline"` | UTC tampil sebagai baris kedua kecil tanpa hover. **Wajib di `/admin/audit`** dan di PDF |
| Nilai kosong/tidak valid | Tampil "—". Di mode pengembangan, `console.warn` |
| Dilarang | `toLocaleString()` tanpa `timeZone`, `Date.now()` untuk menghitung "umur" data, waktu relatif |

**Replay:** `posted_at` baris insiden = `virtual_anchor_at + offset` (PRD §10.10), sehingga selama Replay timestamp bisa berada **di depan jam laptop**. `SimulationBanner` menampilkan "Jam data" bila payload menyediakannya (bagian 6). Semua halaman membaca waktu dari data, bukan dari jam browser. Satu kalimat penjelasan masuk naskah demo.

## 6. Penanda simulasi

PRD §10.10 dan §12.1: semua data Replay berlabel **"DATA SIMULASI"**.

- `SimulationBanner`: strip di atas area konten (di bawah header, di atas judul halaman), latar `--sim`, teks putih. Teks: **"DATA SIMULASI · Skenario Replay. Angka dan waktu pada layar ini bukan data nyata."** Bila tersedia: tambahan "Jam data: 14.29 WIB".
- `SimBadge`: lencana kecil (kontur `--sim`, latar `--sim-bg`) per baris/kartu/pin yang memuat data `is_simulated`.
- Sumber bendera global: `data_notice.has_simulated_data` dari `GET /dashboard/summary`. Admin tidak punya izin dashboard, jadi sumber untuk halaman admin **belum jelas**: lihat bagian 14. Sampai ada, halaman admin hanya memakai `SimBadge` per baris/skenario.

## 7. Layout dan shell

Shell milik pemilik fondasi (`components/shell/`, dipasang di `app/(app)/layout.tsx`). Halaman lain **tidak** membuat navigasi sendiri.

- **Sidebar** 240 px, berlabel, latar `--sidebar`. Di bawah 1280 px menciut jadi 64 px (ikon + tooltip). Di bawah 768 px menjadi panel geser (hamburger).
- **Konten** maksimal 1280 px, rata tengah, grid 12 kolom, jarak 24.
- **Bilah atas** tipis: kiri tombol menu (ponsel), kanan nama pengguna + label peran + keluar (`logout-button`).
- **Merek:** wordmark "RadarIsu" (Source Serif 4, 600) + tanda sederhana buatan tim (busur konsentris + titik) di `public/brand/radarisu-mark.svg`. Kaki sidebar: "Purwarupa Kartika Cyber Hackathon 2026".
- **Rute awal setelah login:** admin → `/admin/status`; lainnya → `/dashboard`.

Daftar menu didefinisikan **satu kali** di `components/shell/nav-config.ts`, difilter dengan izin:

| Grup | Menu | Rute | Izin |
|---|---|---|---|
| Situasi | Dasbor | `/dashboard` | `dashboard.view` |
| Situasi | Alert | `/alerts` | `alerts.view` |
| Situasi | Briefing | `/briefings` | `briefings.view` |
| Pantauan | Topik | `/topics` | `topics.view` |
| Data dan mutu | Pelabelan | `/labeling` | `labels.manage` |
| Data dan mutu | Evaluasi | `/evaluation` | `evaluation.view` |
| Administrasi | Status Sistem | `/admin/status` | `system.status` |
| Administrasi | Sumber Data | `/admin/sources` | `sources.view` |
| Administrasi | Pengguna | `/admin/users` | `users.view` |
| Administrasi | Replay | `/admin/replay` | `replay.manage` |
| Administrasi | Pengaturan Deteksi | `/admin/settings` | `settings.manage` |
| Administrasi | Audit | `/admin/audit` | `audit.view` |

Teks menu ada di `lib/labels/shell.ts`.

## 8. Pola halaman wajib

Setiap halaman dipecah dua:
- `page.tsx`: mengambil data (TanStack Query / server), menangani 401/403/404/422, memasang `*-view.tsx`.
- `*-view.tsx`: **presentasi murni**, menerima data lewat props. Inilah yang dipakai `/dev/*` dan tes dengan fixture.

Pola ini membuat UI bisa dikembangkan sebelum endpoint backend siap, tanpa data palsu di halaman asli.

## 9. Kontrak komponen

Tanda tangan di bawah adalah **kontrak**: agent lain boleh menulis kode terhadapnya sebelum komponennya selesai. Perubahan kontrak diumumkan di `HANDOFF.md`.

```ts
type Severity   = 'low' | 'medium' | 'high'
type AlertStatus = 'new'|'reviewing'|'escalated'|'returned'|'approved'|'false_positive'|'closed'
type AlertKind  = 'issue' | 'impersonation'
type AlertAction = 'take'|'escalate'|'false_positive'|'close'|'approve'|'return'|'comment'
```

### Fondasi (`components/radar/`, pemilik fondasi)

| Komponen | Kontrak dan aturan |
|---|---|
| `SeverityBadge` | `{ severity, size?: 'sm'\|'md'\|'lg' }`. Ikon + label PRD §14. `lg` di header detail. Tidak pernah hanya warna |
| `StatusChip` | `{ status }`. Monokrom: kontur `--line-input`, ikon, label. Tujuh varian |
| `Waktu` | `{ value: string\|Date\|null, format?: 'datetime'\|'date'\|'time', utc?: 'hover'\|'inline' }` (bagian 5) |
| `DataTable<T>` | `{ columns: {id, header, cell(row), align?, mono?, width?}[], rows, getRowKey, rowHref?, rowSeverity?(row)=>Severity\|null, loading?, empty?, error?, caption }`. Baris 40 px. `rowSeverity` memberi garis kiri 3 px. Isi kolom pertama dirender sebagai tautan (keyboard), seluruh baris bisa diklik. Pengurutan dan paginasi dilakukan server, tabel hanya menampilkan. Tidak menambah `@tanstack/react-table` |
| `Pagination` | `{ page, perPage, total, onPageChange }` |
| `EmptyState` | `{ title, description?, loadedAt?, action? }`. Pernyataan faktual ("Tidak ada isu aktif"). `loadedAt` memakai `dataUpdatedAt` TanStack Query dan diberi label **"Dimuat pukul …"**, bukan "diperiksa sistem" |
| `ErrorState` | `{ title?, description?, onRetry? }` |
| `NotAvailable` | Layar 404 **netral**: "Alert tidak tersedia". Tidak boleh membedakan "tidak ada" dari "tidak boleh dilihat" (PRD §8.4). Dipakai untuk semua 404 objek |
| `Forbidden` | Sudah ada (`components/forbidden.tsx`), dipakai untuk 403 |
| Skeleton | `SkeletonRows`, `SkeletonCard`, `SkeletonChart` |
| `SimulationBanner`, `SimBadge` | Bagian 6 |
| `PageHeader` | `{ title, subtitle?, meta?, actions? }`. Judul serif 24 |
| `Section` | `{ title, description?, actions?, children }`. Panel putih bergaris |
| `Stat` | `{ label, value, hint? }`. Angka besar polos di panel, **bukan kartu berwarna** |
| `ConfirmDialog` | `{ open, title, description, confirmLabel, destructive?, onConfirm, onClose, pending? }`. Elemen `<dialog>` bawaan (fokus terkurung, Escape menutup kecuali `pending`) |
| `Button`, `Field`, `FieldError`, `controlClass`, `FilterBar`, `FilterField`, `NotImplemented` | Tambahan fondasi di `components/radar/` (`button.tsx`, `form.tsx`, `filter-bar.tsx`, `states.tsx`) |

### Grafik (`components/charts/signal-chart.tsx`, pemilik fondasi)

```ts
type SignalPoint = { hour: string /* ISO UTC */, volume: number }
<SignalChart
  series: SignalPoint[]
  baseline?: { mean: number, std: number }      // hanya bila server menyediakan
  threshold?: number                            // volume ambang, hanya bila server menyediakan
  window?: { start: string, end: string }       // sorot jendela lonjakan
  markers?: { at: string, severity: Severity, label: string }[]
  variant?: 'full' | 'compact'
/>
```

- Recharts `ComposedChart`: area volume (`--chart-volume`), garis acuan putus-putus (`--chart-ref`), jendela disorot `--brand-tint`, pin = satu-satunya warna jenuh (warna severity). Warna lewat `var(--token)`.
- Sumbu X per jam dalam WIB. Tooltip: "14.00 WIB (07.00 UTC)" + volume.
- **Turun-kualitas yang jujur:** tanpa `baseline`/`threshold` → hanya volume. Boleh menggambar "rata-rata rentang ini" yang dihitung dari seri yang tampil, **diberi label "Rata-rata rentang ini (bukan baseline deteksi)"**. Dilarang menghitung ulang ambang deteksi di klien.
- Wajib ada alternatif tabel (`<details>` "Lihat data sebagai tabel") untuk aksesibilitas.
- Kosong: "Belum ada data metrik untuk rentang ini". Memuat: `SkeletonChart`. Galat: `ErrorState`.

### Domain skor (`components/scoring/score-bar.tsx`, pemilik Rekishi)

```ts
type Part = { raw: number, weight: number, value: number }
type IssueBreakdown = { spike: Part, anomaly: Part, sentiment: Part, reach: Part, thresholds?: Record<string, number> }
<ScoreBar score: number, kind: AlertKind, breakdown?: IssueBreakdown, variant?: 'compact'|'detailed' />
```

- **Anatomi Skor:** satu bar 0–100. Lebar segmen = bobot (dibaca dari data, tidak ditulis tetap). Isi segmen = nilai yang dicapai (`value`). Sisa kapasitas = track `--brand-tint`. Segmen memakai `--viz-1…4` dipisah celah 2 px. Angka selalu tertulis, **informasi tidak boleh bergantung pada warna segmen**.
- `compact` (di tabel/kartu): bar + angka total. `detailed` (di detail alert): per komponen satu baris: nama, mentah, bobot, nilai; di bawahnya rumus PRD §10.8 dengan angka nyata dan ambang yang dipakai.
- `score` yang ditampilkan **selalu dari server**. `ScoreBar` tidak menghitung ulang. Bila `round(Σ value)` berbeda lebih dari 1 dari `score`, `console.warn` di dev dan tetap tampilkan apa adanya.
- `spike.value = 0` karena baseline kurang (PRD §10.5) → tampil "Baseline belum cukup", bukan "0".
- `kind='impersonation'`: skor PRD §10.7 = `round(kemiripan × 70) + (akun baru ? 30 : 0)`. Bentuk `score_breakdown` untuk jenis ini **belum ditetapkan PRD**. Tanpa `breakdown`, tampilkan bar total saja tanpa segmen.

### Domain alert (`components/alerts/`, pemilik Kadavi)

| Komponen | Kontrak dan aturan |
|---|---|
| `availableActions` | Fungsi murni + tes Vitest: `(perms: string[], status: AlertStatus) => AlertAction[]`. Cerminan PRD §8.5. `take`: `alerts.triage` + `new`. `escalate`/`false_positive`/`close`: `alerts.triage` + `reviewing`\|`returned`. `approve`/`return`: `alerts.decide` + `escalated`. `comment`: `alerts.view` + status ≠ `new`. Status terminal hanya `comment`. **Server tetap penentu** |
| `DecisionPanel` | Menempel (sticky) di sisi kanan detail alert. Hanya menampilkan aksi dari `availableActions`. Bidang wajib sesuai PRD (rekomendasi untuk eskalasi; catatan untuk false positive/tutup/kembalikan). Aksi terminal (`approve`, `false_positive`, `close`) memakai `ConfirmDialog`. 422 tampil di bawah bidangnya, bukan toast. 403/404 ditangani netral. Tanpa optimistic update: sukses → invalidasi query alert dan jejak. Memuat juga tombol "Susun briefing" bila `briefings.create` dan status ≠ `new` |
| `DecisionTrail` | `{ detectedAt, actions: {action, user: string\|null, from_status, to_status, note, created_at}[] }`. Timeline vertikal monokrom. Entri pertama "Terdeteksi sistem". `user=null` → "Sistem". Komentar ditampilkan sebagai komentar |
| `EvidenceMap` | `{ kind, evidence[] }`, bukti per PRD §9.5 (`reason`, `account`, `post`, `detail`). Dikelompokkan per `reason` (label PRD §14). Klaster akun: tabel handle (mono), penanda "Akun baru", teks posting (escape, dipotong, bisa diperluas), kemiripan. Strip waktu posting **hanya bila `post.posted_at` tersedia**. Tanpa avatar atau foto. Tanpa kata "bot" |

### Format (`lib/format/`, pemilik fondasi)

`time.ts` (formatter WIB/UTC), `number.ts` (id-ID, persen). Dengan tes Vitest.

## 10. State wajib per halaman

| State | Komponen | Catatan |
|---|---|---|
| Memuat | Skeleton | Bentuknya menyerupai isi, tanpa spinner layar penuh |
| Kosong | `EmptyState` | Kalimat faktual + aksi bila ada |
| Galat jaringan/5xx | `ErrorState` + "Coba lagi" | |
| 401 | Hapus cookie, arahkan `/login` | Sudah ditangani `lib/api.ts` |
| 403 | `Forbidden` | |
| 404 | `NotAvailable` | Netral untuk semua objek |
| 422 | Pesan di bawah bidang | Bukan toast |
| 501 (stub fase berikutnya) | `EmptyState` "Fitur ini belum tersedia" | Jangan dianggap galat |
| Sukses | Toast netral (ink, ikon centang) | Tidak hijau |

## 11. Interaksi dan aksesibilitas

- Fokus keyboard terlihat di semua elemen interaktif. Urutan tab logis. Dialog mengurung fokus dan mengembalikannya.
- Baris terpilih: latar `--brand-tint` + garis kiri `--brand`. Hover baris: `--hover`.
- Disabled: opasitas 50%, `aria-disabled`, kursor `not-allowed`. Tombol memuat: ikon putar + `disabled`.
- Galat selalu ikon + teks, tidak hanya merah.
- `<html lang="id">`. Toast memakai `aria-live`. Tooltip bisa diakses lewat fokus.
- Target AA untuk teks (4,5:1) dan 3:1 untuk batas kontrol.

## 12. Responsif

| Lebar | Perilaku |
|---|---|
| ≥ 1280 | Sidebar penuh, grid 12 kolom |
| 768–1279 | Sidebar menciut (64 px), kolom detail menumpuk bila perlu |
| < 768 | Sidebar panel geser. `DataTable` menggulir horizontal dengan kolom pertama menempel. `DecisionPanel` menjadi bilah tombol di bawah layar. Tidak ada gulir horizontal pada halaman |

Minimal yang harus dicek tiap halaman: 1440, 1024, 390 px.

## 13. Briefing PDF (dompdf)

Pemilik: Kadavi (F9). Template: `backend/resources/views/briefings/pdf.blade.php`.

- **Keterbatasan dompdf:** CSS 2.1 + sedikit CSS3. **Tanpa flex dan grid.** Susun dengan tabel, `float`, `inline-block`. Bar skor digambar dengan sel tabel berlebar persen.
- **Font:** dompdf butuh berkas **TTF statis** (bukan woff2/variable). Simpan Inter dan Source Serif 4 statis di `backend/resources/fonts/` dan daftarkan.
- Isi (PRD §9.5 `content`): judul; ringkasan; skor dan rincian komponen (tabel); jejak keputusan (tabel waktu); bukti terpilih; rekomendasi Analis; keputusan Pimpinan; pembuat; tanggal.
- Waktu: WIB dengan UTC kecil di sampingnya (tidak ada hover di PDF).
- Bila alert memuat data simulasi: pita "DATA SIMULASI" di setiap halaman.
- Kaki: "Purwarupa Kartika Cyber Hackathon 2026 · Halaman x dari y".
- A4, margin 20 mm. Warna terbatas pada token (hex diperbolehkan di template karena bukan Tailwind). Uji cetak hitam-putih: severity tetap terbaca karena ikon/teks.

## 14. Hal yang belum diketahui (diselesaikan lewat audit payload)

Jangan mengarang. Cek endpoint nyata dan catat di `docs/UI_PAYLOAD_AUDIT.md`.

| Pertanyaan | Dampak bila belum ada |
|---|---|
| Apakah `GET /alerts/{id}` memuat `post.posted_at`, `account.platform_created_at`, `cluster_id`? | `EvidenceMap` tanpa strip waktu dan tanpa pengelompokan klaster |
| Apakah metrik topik atau alert memuat `baseline` (mean, std) dan ambang? | `SignalChart` hanya garis volume |
| Bentuk `score_breakdown` untuk `kind='impersonation'`? | `ScoreBar` tanpa segmen |
| Sumber "jam data" dan bendera simulasi untuk halaman admin? | Banner tanpa jam data; admin hanya `SimBadge` per baris |
| Apakah daftar `/alerts` memuat `assigned_to` dan nama topik/akun subjek? | Kolom "Ditangani" disembunyikan; judul memakai fallback |
| Apakah `/dashboard/issues` memuat skor, breakdown, dan severity? | Kartu isu tanpa `ScoreBar` |
| Apakah endpoint briefing menerima `title` dan `summary`? | Dialog "Susun briefing" menyesuaikan |

Endpoint yang masih stub 501: gunakan bentuk di PRD §11 sebagai kontrak, tulis tipe dari situ, dan ajukan kebutuhan tambahan ke pemilik endpoint lewat `HANDOFF.md`.
