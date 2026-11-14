AGENTS.md — RadarIsu

File ini untuk agent AI selain Claude Code (Codex, Cursor, Copilot, dll.). Isinya penunjuk dan ringkasan. Jika ringkasan di sini berbeda dengan dokumen yang ditunjuk, dokumen itu yang menang.

Baca dulu, berurutan
CLAUDE.md — aturan kerja proyek (berlaku untuk semua agent, bukan hanya Claude)
docs/OWNERSHIP.md — siapa memiliki file apa
docs/PRD.md — sumber kebenaran produk
Untuk pekerjaan UI: docs/UI_DESIGN_SYSTEM.md → docs/UI_PAGES.md (bagian halamanmu) → docs/UI_WORKPLAN.md
Prompt siap pakai: docs/UI_PROMPTS.md
Ringkasan aturan
Hanya ubah file milik wilayahmu; kebutuhan di file orang lain ditulis di docs/HANDOFF.md.
Kerjakan satu tugas per branch; nama branch ditetapkan di docs/UI_WORKPLAN.md §4. Pada branch yang sudah ada, git log --oneline main..HEAD harus kosong sebelum mulai; bila tidak, berhenti dan lapor. Untuk pekerjaan UI, agent boleh menjalankan git commit di branch yang ditetapkan (revisi 2026-11-14; lihat CLAUDE.md), dengan pesan tanpa atribusi AI. Jangan menjalankan git push, git stash, git reset, git rebase, atau opsi force kecuali diminta.
UI: warna hanya dari token; semua teks lewat labels; semua timestamp lewat <Waktu>; izin lewat useCan/<Can>; halaman dipecah page.tsx + *-view.tsx; tidak ada data palsu di halaman asli.
Jangan mengarang field API atau angka. Cek payload nyata dan catat celah di docs/UI_PAYLOAD_AUDIT.md.
Bila ada konflik antara dokumen, atau antara dokumen dan PRD: tulis di docs/OPEN_QUESTIONS.md, jangan menebak.
Verifikasi frontend: cd frontend && npm run lint && npx tsc --noEmit && npm test && npm run build. Backend: cd backend && php artisan test.