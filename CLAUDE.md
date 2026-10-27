# RadarIsu — aturan kerja

- Jika backend/CLAUDE.md bertentangan, aturan root ini menang. laravel/boost tidak dipasang.
- Sumber kebenaran: docs/PRD.md. Jangan menambah fitur di luar bagian 6.1.
- Kerjakan HANYA fase yang diminta. Jangan lanjut ke fase berikutnya sebelum tesnya lulus.
- Identifier kode: bahasa Inggris snake_case. Teks UI: lewat frontend/src/lib/labels.ts (dan lib/labels/{domain}.ts), bukan string Indonesia langsung.
- Otorisasi ditegakkan di Laravel (middleware permission + policy). Frontend hanya menyembunyikan UI.
- Ambang deteksi disimpan di tabel settings, jangan di-hardcode.
- Tidak ada panggilan ke LLM/API pihak ketiga di fitur wajib.
- Jika PRD bertentangan dengan dirinya sendiri atau dengan juknis, tulis konfliknya di docs/OPEN_QUESTIONS.md dan jangan menebak.
- Perintah verifikasi: `cd backend && php artisan test`, `cd frontend && npm run build && npm test`.
- Setiap fase selesai: commit dengan pesan "Fase N: ...", lalu laporkan hasil tes.

## Kepemilikan dan kerja tim

- Baca docs/OWNERSHIP.md sebelum mengubah file. Hanya ubah file milik wilayahmu; butuh perubahan di file orang lain → tulis di docs/HANDOFF.md, jangan edit langsung.
- Satu tugas, satu branch. Nama branch ditetapkan di docs/UI_WORKPLAN.md §4; jangan membuat atau berpindah ke branch lain. Alur: `git status` bersih → `fetch` → `checkout main` → `pull` → `checkout <branch>` → `pull` → `git log --oneline main..HEAD` (branch lama harus kosong) → `merge --ff-only main`. Bila ada isi, gagal, atau divergen, berhenti dan lapor.

## Pekerjaan UI (berlaku untuk semua yang menyentuh frontend/)

Baca berurutan sebelum menulis UI: docs/UI_DESIGN_SYSTEM.md → docs/UI_PAGES.md (bagian halamanmu) → docs/UI_WORKPLAN.md. Prompt siap pakai ada di docs/UI_PROMPTS.md.

- Warna hanya dari token di frontend/src/app/globals.css. Dilarang hex/rgb di komponen, nilai arbitrer Tailwind, gradien, glow, donut/gauge, avatar, kartu KPI solid, dan warna hijau.
- Semua timestamp lewat komponen `<Waktu>` (WIB di UI, UTC saat hover). Tanpa waktu relatif.
- Izin lewat `useCan`/`<Can>`, bukan nama peran. Server tetap penentu: tangani 401/403/404/422/501.
- Halaman dipecah: `page.tsx` (fetch) + `*-view.tsx` (presentasi murni). Tidak ada data palsu di halaman asli; fixture hanya di `/dev/*` dan tes.
- Cek payload nyata sebelum membangun komponen, catat celah di docs/UI_PAYLOAD_AUDIT.md, turunkan kualitas dengan jujur bila field tidak ada. Jangan mengarang field atau angka.
- Kosakata netral: jangan menulis "bot", "hoaks", "pelaku", "terbukti". Sistem menandai pola tidak wajar; keputusan akhir manusia.
- Lambang resmi TNI AD tidak dipakai kecuali panitia memberi aset atau izin.
- Tidak menambah dependensi UI tanpa mencatatnya di docs/HANDOFF.md.
- **Aturan commit untuk pekerjaan UI menggantikan baris "Setiap fase selesai: commit" di atas:** agent TIDAK menjalankan `git commit`, `git push`, `git stash`, `git reset`, `git rebase`, atau opsi force. Agent memberi perintah commit siap-salin (`git add` path spesifik, pesan mengikuti `git log --oneline -20`, diawali `ui:` bila branch-nya branch fitur lama, tanpa Co-Authored-By atau atribusi AI) lalu berhenti dan menunggu.
- Verifikasi UI: `cd frontend && npm run lint && npx tsc --noEmit && npm test && npm run build`.