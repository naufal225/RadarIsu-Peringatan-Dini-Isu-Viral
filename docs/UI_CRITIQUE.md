# Kritik UI awal (basis tema Cyber)

Tanggal: 2026-11-14. Branch: `feat/ui-cyber` (dari `main` 790e008).

**Metode dan batasan.** Kritik ini disusun dari `docs/UI_DESIGN_SYSTEM.md`, `docs/UI_PAGES.md`, dan kode di `main`. Frontend dan backend tidak berjalan saat penyusunan, jadi belum ada screenshot pada 1440, 1024, dan 390 px. Kritik visual harus diverifikasi ulang setelah server berjalan.

## Yang membuat UI terasa membosankan

1. **Datar karena terlalu aman.** Latar kertas, kartu putih, garis 1 px, tanpa bayangan, tanpa aksen. Semua halaman terlihat sama, dan tidak ada titik tatapan pertama.
2. **Warna hanya untuk severity.** Seluruh UI monokrom zaitun. Akibatnya tidak ada yang "hidup" kecuali pin alert merah.
3. **Tidak ada gerak yang terasa.** Aturan "gerak hanya fungsional" dan "animasi masuk dilarang" membuat demo tidak punya momen. Juri melihat aplikasi tabel.
4. **Tipografi padat untuk layar proyektor.** Tabel 13 px dengan baris 40 px. Di ruang demo, teks sekunder (`ink-muted`) sulit dibaca. Risiko ini sudah dicatat di `UI_WORKPLAN.md` §10.
5. **Login tanpa kesan pertama.** Satu panel polos di kertas kosong. Ini layar pertama yang dilihat juri.
6. **Navigasi datar.** Dua belas menu dalam lima grup, campur antara menu demo dan administrasi. Menu tidak membantu alur "lihat isu → putuskan → briefing".
7. **Peta dan grafik kecil.** `SignalChart` dan `ScoreBar` dipakai dalam varian `compact` di dasbor. Visual utama produk, yaitu bukti dan skor, tidak menjadi pusat.

## Yang sudah kuat dan dipertahankan

- Alur demo PRD §20 jelas, dan urutan bagian di `/alerts/[id]` ditentukan izin.
- `DecisionPanel` sticky dan `DecisionTrail` sudah dirancang.
- Kosakata netral, penanda simulasi, dan waktu WIB/UTC sudah konsisten.
- Pemisahan `page.tsx` dan `*-view.tsx` memudahkan redesign tanpa mengubah data.

## Arah Cyber yang diusulkan (untuk tahap desain)

- Latar navy-hitam, teks cyan-putih. Token baru di `globals.css`.
- Angka, timestamp, dan ID memakai JetBrains Mono. Judul memakai Inter tebal. Serif dipensiunkan kecuali PDF.
- Grid tipis sebagai latar halaman. Tanpa gradien.
- Glow hanya di cincin fokus dan pin alert kritis. Hijau tetap dilarang.
- Hero dasbor: satu kalimat ringkasan besar dan skor utama, dengan `SignalChart` penuh.
- Login: panel tengah dengan wordmark dan garis grid, tanpa dekorasi.

## Alur analis (dari kode frontend di `main`)

Analis punya izin `alerts.triage`, `topics.manage`, `briefings.create`, `labels.manage`, dan `evaluation.run`. Halaman yang mereka pakai: dasbor, `/alerts`, `/alerts/[id]`, `/briefings`, `/topics`, `/labeling`, dan `/evaluation`.

- **Dasbor (`dashboard/dashboard-panel.tsx`).** Tiga kartu KPI, grafik tren, tabel isu, dan pintasan. Sudah memakai token. Kekurangan: tidak ada "isu berikutnya yang perlu ditangani". Analis harus memindai tabel untuk menemukannya.
- **Daftar alert (`alerts/alert-list.tsx`).** Memakai komponen lama `components/ui.tsx`. Filter berupa select HTML biasa, tabel polos, dan skor hanya berupa angka. Tidak ada urutan prioritas yang terlihat. Warna `neutral-*` ditulis langsung.
- **Detail alert (`alerts/[id]/alert-detail.tsx`).** Empat form aksi (eskalasi, positif palsu, tutup, komentar) terbuka sekaligus, sehingga beban keputusan tinggi. Alur analis sebenarnya berurutan: ambil → tinjau → putuskan. Kotak rekomendasi memakai `amber-*`, dan pesan sukses memakai `text-green-700`. Keduanya melanggar token dan aturan tanpa hijau.
- **Pelanggaran aturan yang sudah ada:** `alert-detail.tsx`, `alert-list.tsx`, dan 6 berkas lain memakai warna hardcoded (`neutral`, `amber`, `green`). Berkas ini harus dimigrasi sebelum tema gelap aktif.

**Inspirasi untuk Cyber (fokus analis):**
- Antrean prioritas di atas daftar: alert `new` tampil sebagai kartu dengan `ScoreBar`, dan tombol "Ambil" langsung terlihat.
- Detail alert memakai panel keputusan sticky di kanan yang hanya menampilkan aksi dari `availableActions` untuk status saat ini. Tidak ada empat form terbuka sekaligus.
- Rekomendasi analis tampil sebagai kutipan terpisah, bukan kotak kuning.
- Bukti dan timeline di bawah, bukan di tengah alur.

## Yang belum bisa dinilai tanpa screenshot

- Kontras nyata pada `ink-muted` di panel gelap (perlu pengukuran WCAG).
- Kepadatan tabel di 1024 px.
- Perilaku `SignalChart` saat data kosong.
