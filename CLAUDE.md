# RadarIsu — aturan kerja

- Jika backend/CLAUDE.md bertentangan, aturan root ini menang. laravel/boost tidak dipasang.
- Sumber kebenaran: docs/PRD.md. Jangan menambah fitur di luar bagian 6.1.
- Kerjakan HANYA fase yang diminta. Jangan lanjut ke fase berikutnya sebelum tesnya lulus.
- Identifier kode: bahasa Inggris snake_case. Teks UI: lewat frontend/lib/labels.ts, bukan string Indonesia langsung.
- Otorisasi ditegakkan di Laravel (middleware permission + policy). Frontend hanya menyembunyikan UI.
- Ambang deteksi disimpan di tabel settings, jangan di-hardcode.
- Tidak ada panggilan ke LLM/API pihak ketiga di fitur wajib.
- Jika PRD bertentangan dengan dirinya sendiri atau dengan juknis, tulis konfliknya di docs/OPEN_QUESTIONS.md dan jangan menebak.
- Perintah verifikasi: `cd backend && php artisan test`, `cd frontend && npm run build && npm test`.
- Setiap fase selesai: commit dengan pesan "Fase N: ...", lalu laporkan hasil tes.