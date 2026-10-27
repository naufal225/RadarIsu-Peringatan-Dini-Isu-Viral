# Rencana Kerja UI RadarIsu (v1, 2026-10-27)

Pelengkap `docs/OWNERSHIP.md` (sumber kebenaran kepemilikan) dan `docs/UI_DESIGN_SYSTEM.md`.
Dokumen ini menetapkan **siapa mengerjakan apa, urutannya, aturan git, dan kapan sebuah halaman dianggap selesai**.

## 1. Prinsip

1. **Kepemilikan UI mengikuti `OWNERSHIP.md`**, karena itu yang ditegakkan `CODEOWNERS`. Rencana ini menambah satu hal: lapisan fondasi.
2. **Satu halaman, satu pemilik.** Bagian khusus peran dipasang oleh pemilik halaman lewat komponen terpisah.
3. **Fondasi dulu**, lalu paralel. Selama fondasi dikerjakan, yang lain mengerjakan tugas baca-saja (audit payload) dan tipe/fixture.
4. **Kamu hanya boleh mengubah file milikmu.** Butuh perubahan di file orang lain → tulis di `docs/HANDOFF.md`.
5. Mulai dari versi terkecil yang bisa didemokan. Memoles halaman *Polos* sebelum alur demo selesai dilarang.

## 2. Lapisan dan pemilik

| Lapisan | Isi | Pemilik |
|---|---|---|
| **L0 Fondasi** | Token + font (`globals.css`), shell + `nav-config`, komponen `components/radar/`, `components/ui/` (shadcn), `lib/format/`, `SignalChart`, `/dev/styleguide`, `/login`, merek | Naufal (F12 sudah memegang layout dan BFF) |
| **L1 Komponen domain** | `ScoreBar` | Rekishi (F7, domain C) |
| | `DecisionPanel`, `DecisionTrail`, `EvidenceMap`, `availableActions` | Kadavi (F6, domain B) |
| **L2 Halaman** | Per tabel di bawah | Per `OWNERSHIP.md` |

### Halaman

| Halaman | Pemilik | Reviewer | Prioritas |
|---|---|---|---|
| `/alerts`, `/alerts/[id]` | Kadavi | Naufal | Demo |
| `/briefings` + PDF | Kadavi | Naufal | Demo |
| `/dashboard` | Rekishi | Kadavi | Demo |
| `/admin/status` | Rekishi | Kadavi | Pendukung |
| `/admin/audit` | Naufal | Kadavi | Demo |
| `/admin/replay` | Naufal | Rekishi | Demo |
| `/admin/sources` | Naufal | Rekishi | Pendukung (Polos) |
| `/admin/users` | Naufal | Kadavi | Pendukung (Polos) |
| `/admin/settings` | Naufal | Rekishi | Pendukung |
| `/topics`, `/topics/[id]` | Naufal | Rekishi | Pendukung |
| `/labeling`, `/evaluation` | Naufal | Rekishi | Pendukung |
| `/login` | Naufal | Kadavi | Pendukung |

**Beban Naufal paling besar** (fondasi + 9 halaman + backend F3/F4/F13 + F10/F12/F14/F15). Karena itu urutan di bagian 3 dan daftar pangkas di bagian 8 bersifat mengikat.

## 3. Urutan eksekusi

| Tahap | Siapa | Isi | Syarat lanjut |
|---|---|---|---|
| **0. Audit baca-saja** | Naufal | Agent memeriksa versi, struktur, label, build dasar. Tanpa kode | Laporan sesuai asumsi dokumen |
| **0b. Audit payload** | Kadavi, Rekishi (paralel dengan tahap 1) | Periksa endpoint milik wilayahmu, isi `docs/UI_PAYLOAD_AUDIT.md`, tulis `lib/api-types/<domain>.ts` dan `fixtures/<domain>.ts` | Celah tercatat, tipe ada |
| **1. Fondasi** | Naufal | Branch `feat/ui-foundation`: token, font, shell, komponen P1, util, `/dev/styleguide`, `/login`. Lalu `feat/ui-signal-chart` | Lint, tsc, test, build lulus; **merge ke `main`** |
| **2. Paralel** | Bertiga | Masing-masing di branch yang ditetapkan bagian 4, wilayah sendiri | Fondasi sudah di `main` |
| **3. Integrasi** | Naufal memimpin, bertiga | Branch `feat/ui-integration`: sapuan konsistensi, lalu jalankan skenario demo PRD §20 dari awal | Demo mulus tanpa intervensi manual |

Selama tahap 1, Kadavi dan Rekishi boleh membangun komponen domain di folder mereka memakai token dari dokumen dan fixture; sesuaikan ke kode token asli setelah fondasi masuk `main`.

Komponen fondasi diprioritaskan: **P1** (dibutuhkan semua): token, font, shell, `SeverityBadge`, `StatusChip`, `Waktu`, `DataTable`, `EmptyState`/`ErrorState`/`NotAvailable`, skeleton, `SimulationBanner`, `PageHeader`, `Section`, `ConfirmDialog`. **P2:** `SignalChart`, `Stat`, `Pagination`, bilah filter.

Perkiraan durasi (kasar, tarik mundur dari tenggat submission, PRD §18): fondasi ±1–2 hari kerja; halaman Demo ±1 hari tiap halaman; halaman Polos setengah hari. Ini perkiraan, bukan komitmen.

## 4. Branch

Prinsip: **pakai branch fitur yang sudah ada di repo bila tugas UI-nya memang bagian fitur itu; buat branch `feat/ui-*` hanya bila belum ada branch yang cocok.** Kolom "Cadangan" dipakai bila pemeriksaan di bawah gagal.

| Pemilik | Tugas (urut kerja) | Branch | Status | Cadangan |
|---|---|---|---|---|
| Naufal | Fondasi | `feat/ui-foundation` | baru | - |
| Naufal | `SignalChart` + P2 | `feat/ui-signal-chart` | baru | - |
| Naufal | `/admin/audit` | `feat/b-f10-audit-ui` | ada | `feat/ui-admin-audit` |
| Naufal | `/admin/replay` | `feat/a-f11-mode-replay` | ada | `feat/ui-admin-replay` |
| Naufal | `/admin/sources` | `feat/ui-admin-sources` | baru | - |
| Naufal | `/admin/users` | `feat/b-f12-auth-rbac` | ada | `feat/ui-admin-users` |
| Naufal | `/admin/settings` | `feat/c-f15-pengaturan-deteksi` | ada | `feat/ui-admin-settings` |
| Naufal | `/topics`, `/topics/[id]` | `feat/a-f2-topik-pantauan` | ada | `feat/ui-topics` |
| Naufal | `/labeling` | `feat/c-f14a-pelabelan` | ada | `feat/ui-labeling` |
| Naufal | `/evaluation` | `feat/c-f14b-evaluasi` | ada | `feat/ui-evaluation` |
| Naufal | Integrasi | `feat/ui-integration` | baru | - |
| Kadavi | Komponen alert | `feat/ui-alerts-components` | baru | - |
| Kadavi | `/alerts` | `feat/b-f6b-triase-ui` | ada | `feat/ui-alerts-list` |
| Kadavi | `/alerts/[id]` | `feat/ui-alerts-detail` | baru | - |
| Kadavi | `/briefings` | `feat/ui-briefings` | baru | - |
| Kadavi | Template PDF briefing | `feat/b-f9-briefing-pdf` | ada | `feat/ui-briefing-pdf` |
| Rekishi | `ScoreBar` | `feat/c-f7-skor-ancaman` | ada | `feat/ui-score-bar` |
| Rekishi | `/dashboard` | `feat/c-f8-dasbor` | ada | `feat/ui-dashboard` |
| Rekishi | `/admin/status` | `feat/ui-admin-status` | baru | - |

Branch fitur yang tidak dipakai UI (`feat/a-f3-deteksi-lonjakan`, `feat/a-f4-deteksi-koordinasi`, `feat/a-f13-deteksi-peniruan`, `feat/a-pipeline-agregasi`, `feat/b-ci-github-actions`, `feat/b-f10-audit-logger`, `feat/b-f6a-alert-service`, `feat/c-f5-sentimen`) tidak disentuh oleh pekerjaan UI.

Catatan pemetaan: `/admin/users` memakai branch F12 karena halaman itu adalah antarmuka RBAC; `/briefings` dan `/alerts/[id]` mendapat branch baru agar satu branch tetap satu halaman.

### Pemeriksaan branch lama (wajib sebelum memakainya)

Branch lama bisa saja masih memuat pekerjaan backend yang belum di `main`. Perintah `merge --ff-only main` **tidak** menangkap kasus ini bila `main` belum bergerak (hasilnya "Already up to date"), jadi periksa riwayatnya secara eksplisit:

```bash
git log --oneline main..HEAD       # harus KOSONG
```

- Kosong → branch sudah sepenuhnya di `main`; aman dipakai untuk UI.
- Ada isi → **BERHENTI** dan laporkan daftar commit-nya. Manusia memutuskan: (a) selesaikan dan merge branch itu dulu, atau (b) pakai nama cadangan (`feat/ui-*`) yang dibuat dari `main` terbaru.
- Branch lama yang sudah ada di `main` akan fast-forward tanpa masalah setelah fondasi masuk `main`.

Pesan commit dan judul PR untuk pekerjaan UI di branch fitur lama diawali `ui:` supaya terpisah jelas dari riwayat fitur.

### Alur git setiap tugas

```bash
git status                      # harus bersih; bila tidak, BERHENTI
git fetch origin
git checkout main
git pull origin main
git checkout <branch>           # ada di remote saja: git checkout -b <branch> origin/<branch>; belum ada sama sekali (status "baru"): git checkout -b <branch>
git pull origin <branch>        # bila belum ada di remote, lewati dan sebutkan
git log --oneline main..HEAD    # branch lama: harus kosong (lihat di atas); branch "baru": otomatis kosong
git merge --ff-only main        # gagal (divergen) → BERHENTI dan laporkan
```

- Agent **tidak** menjalankan `git commit`, `git push`, `git stash`, `git reset`, `git rebase`, atau opsi force. Manusia yang commit.
- Setelah selesai, agent memberi perintah commit siap-salin (bagian 9 prompt). Pesan commit **tanpa** `Co-Authored-By`, "Generated with …", atau atribusi AI. Gaya pesan mengikuti `git log --oneline -20`.
- Satu PR per branch. Reviewer ditentukan `CODEOWNERS`. Penulis tidak menyetujui PR-nya sendiri.
- Fondasi harus merge ke `main` **sebelum** tahap 2 dimulai. Setelah itu, setiap pemilik mem-`merge main` ke branch-nya (bukan rebase) saat fondasi atau token berubah.

## 5. File bersama

| File | Aturan |
|---|---|
| `frontend/src/app/globals.css` (token) | Hanya pemilik fondasi mengubah. Perubahan nilai diumumkan di `HANDOFF.md`. Butuh token baru → minta lewat `HANDOFF.md` |
| `components/radar/*`, `components/shell/*`, `components/ui/*` | Pemilik fondasi. Butuh varian baru → `HANDOFF.md`, atau PR kecil ber-label `ui-shared` yang direview pemilik fondasi |
| `frontend/src/lib/labels.ts` (penggabung) | Review semua pemilik. Teks baru ditulis di `lib/labels/<domain>.ts` milikmu, lalu diekspor lewat penggabung. Konflik merge di penggabung diselesaikan per PR, biayanya kecil |
| `components/shell/nav-config.ts` | Pemilik fondasi. Semua rute PRD §12.2 sudah didaftarkan; halaman lain tidak menambah menu |
| `lib/api-types/<domain>.ts`, `fixtures/<domain>.ts` | Pemilik domain masing-masing |
| `docs/UI_PAYLOAD_AUDIT.md`, `docs/HANDOFF.md` | Tanpa pemilik, siapa saja menambah |
| `docs/UI_*.md`, `CLAUDE.md`, `AGENTS.md` | Review semua pemilik |

## 6. Audit payload

Lakukan sebelum menulis komponen yang bergantung pada data.

1. Periksa endpoint wilayahmu: baca `routes/api/*.php` dan controller. Bila masih stub 501, kontraknya adalah PRD §11.
2. Bila backend bisa dijalankan, ambil respons nyata (seed/Replay). Jangan menebak bentuknya.
3. Isi `docs/UI_PAYLOAD_AUDIT.md` (tambahkan bagianmu), tabel dengan kolom: **Komponen/halaman · Field yang dibutuhkan · Ada? (ya/tidak/stub) · Endpoint · Tindakan (turun-kualitas, atau minta tambahan ke pemilik via HANDOFF)**.
4. Tulis tipe TypeScript dari yang **nyata** (atau PRD bila stub), bukan dari yang diharapkan.
5. Field tambahan bersifat read-only dan diminta ke pemilik endpoint lewat `HANDOFF.md`.

## 7. Definisi selesai (per halaman)

- [ ] Pola `page.tsx` + `*-view.tsx`; `/dev/preview/<domain>` merender view dengan fixture
- [ ] Semua state: memuat, kosong, galat, 403, 404 netral, 422 inline, 501
- [ ] Hanya token (jalankan pemeriksaan hex di bawah), tidak ada hal yang dilarang Design System §2
- [ ] Semua teks lewat labels; kosakata sesuai Design System §4
- [ ] Semua timestamp lewat `<Waktu>`; tidak ada waktu relatif
- [ ] Elemen bergantung izin memakai `useCan`/`<Can>`
- [ ] Keyboard: bisa dioperasikan tanpa mouse, fokus terlihat
- [ ] Responsif dicek di 1440, 1024, 390 px
- [ ] Logika murni punya tes Vitest (formatter, peta label, `availableActions`, ringkasan)
- [ ] `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build` lulus
- [ ] Tidak ada dependensi baru tanpa catatan di `HANDOFF.md`
- [ ] Tangkapan layar 1440 dan 1024 px terlampir di PR (diambil manusia)

Pemeriksaan hex (dijalankan dari root repo; hasil harus kosong):

```bash
rg -n "#[0-9A-Fa-f]{3,8}\b|rgba?\(|hsla?\(|\[#" frontend/src \
  --glob '!**/globals.css' --glob '!**/*.test.*' --glob '!**/fixtures/**'
```

## 8. Daftar pangkas jika waktu sempit

Urut dari yang dipangkas **pertama**:

1. Pintasan papan ketik `/labeling`, penyorotan karakter beda pada peniruan akun, strip waktu pada `EvidenceMap`.
2. Halaman *Polos* (`/admin/users`, `/admin/sources`, `/admin/settings`): cukup `DataTable` + form shadcn tanpa penyesuaian.
3. `/labeling`, `/evaluation`, `/admin/status`: cukup fungsional.
4. `/topics` detail: cukup grafik + kata kunci.

**Tidak boleh dipangkas** (alur demo PRD §20): shell, `/alerts`, `/alerts/[id]` (`ScoreBar`, `EvidenceMap`, `DecisionPanel`, `DecisionTrail`), `/dashboard`, `/briefings` + PDF, `/admin/replay`, `/admin/audit`, penanda simulasi.

## 9. Review (±5 menit per PR)

1. Hanya file milik penulis yang berubah? Cek `git diff --stat`.
2. Jalankan pemeriksaan hex (bagian 7), `lint`, `tsc`, `test`, `build`.
3. Buka `/dev/preview/<domain>`: semua state tampil tanpa error konsol.
4. Cek satu halaman hanya dengan keyboard.
5. Cek kosakata: tidak ada "bot", "hoaks", "pelaku".
6. Cek tidak ada hijau, gradien, glow, donut, avatar.
7. Cek 404 untuk akun leader pada alert yang tidak terlihat: layar netral, tidak membocorkan alasannya.
8. Cek PR tidak menyentuh `globals.css`, `components/radar`, `components/shell` kecuali PR fondasi.

## 10. Risiko dan kenyataan di lapangan

| Risiko | Mitigasi |
|---|---|
| Fondasi molor, dua orang menganggur | Tahap 0b dan komponen domain berjalan paralel; pangkas P2 dulu, merge P1 secepatnya |
| Agent menulis hex langsung | Aturan keras #1 + pemeriksaan hex di review |
| Tailwind v3/v4 berbeda cara init shadcn | Tahap 0 memeriksa versi sebelum apa pun |
| Backend alert/detektor belum selesai, UI tak punya data | Pola view + fixture; Kadavi menyiapkan fixture dari PRD §11.3; Replay jadi sumber data nyata setelah Fase 4 |
| Contoh PRD §11.3 tidak konsisten (skor 82, komponen berjumlah 65) | Fixture dibuat konsisten (Σ ≈ skor); `ScoreBar` memperingatkan di dev bila tidak |
| `labels.ts` bentrok | Label per domain di `lib/labels/<domain>.ts`; bentrok di penggabung diselesaikan per PR |
| Demo di layar proyektor/ruang terang | Tema terang adalah default; tanyakan ke panitia apakah final di layar besar |
| Replay membuat timestamp "di masa depan" | Banner "Jam data" + satu kalimat di naskah demo |
| PDF tampil berbeda dari UI | dompdf tanpa flex/grid; font TTF statis; uji cetak lebih awal |
| Aturan PRD "fase tidak dimulai sebelum DoD fase sebelumnya" | Pekerjaan UI adalah lintas-fase (reskin + Fase 8). Catat di PRD (bagian 11) |

## 11. Perubahan dokumen lain yang perlu PR terpisah

Perubahan di bawah memengaruhi berkas bersama, jadi butuh persetujuan pemilik sesuai `CODEOWNERS`. Jangan digabung dengan PR fitur.

### a. `.github/CODEOWNERS`: tambahkan di **paling bawah** (pola paling bawah menang)

```
# ======================= UI (2026-10-27) =======================
# Lihat docs/UI_WORKPLAN.md.

# --- Fondasi UI (Naufal, reviewer Kadavi)
/frontend/src/components/shell/                    @naufal225 @dapzz-id
/frontend/src/components/radar/                    @naufal225 @dapzz-id
/frontend/src/components/ui/                       @naufal225 @dapzz-id
/frontend/src/components/charts/                   @naufal225 @dapzz-id
/frontend/src/lib/format/                          @naufal225 @dapzz-id
/frontend/src/lib/labels/shell.ts                  @naufal225 @dapzz-id
/frontend/src/app/(app)/dev/                       @naufal225 @dapzz-id
/frontend/src/fixtures/common.ts                   @naufal225 @dapzz-id
/frontend/public/brand/                            @naufal225 @dapzz-id
# Token memengaruhi semua domain
/frontend/src/app/globals.css                      @naufal225 @dapzz-id @rekis-0103

# --- Domain A (Naufal, reviewer Rekishi)
/frontend/src/components/topics/                   @naufal225 @rekis-0103
/frontend/src/components/sources/                  @naufal225 @rekis-0103
/frontend/src/components/replay/                   @naufal225 @rekis-0103
/frontend/src/components/settings/                 @naufal225 @rekis-0103
/frontend/src/components/labeling/                 @naufal225 @rekis-0103
/frontend/src/components/evaluation/               @naufal225 @rekis-0103
/frontend/src/lib/api-types/topics.ts              @naufal225 @rekis-0103
/frontend/src/lib/api-types/sources.ts             @naufal225 @rekis-0103
/frontend/src/lib/api-types/replay.ts              @naufal225 @rekis-0103
/frontend/src/lib/api-types/settings.ts            @naufal225 @rekis-0103
/frontend/src/lib/api-types/evaluation.ts          @naufal225 @rekis-0103
/frontend/src/fixtures/topics.ts                   @naufal225 @rekis-0103
/frontend/src/fixtures/evaluation.ts               @naufal225 @rekis-0103

# --- Naufal (F10, F12), reviewer Kadavi
/frontend/src/components/audit/                    @naufal225 @dapzz-id
/frontend/src/components/users/                    @naufal225 @dapzz-id
/frontend/src/lib/api-types/audit.ts               @naufal225 @dapzz-id
/frontend/src/lib/api-types/users.ts               @naufal225 @dapzz-id

# --- Domain B (Kadavi, reviewer Naufal)
/frontend/src/components/alerts/                   @dapzz-id @naufal225
/frontend/src/lib/api-types/alerts.ts              @dapzz-id @naufal225
/frontend/src/lib/api-types/briefings.ts           @dapzz-id @naufal225
/frontend/src/fixtures/alerts.ts                   @dapzz-id @naufal225
/backend/resources/views/briefings/                @dapzz-id @naufal225
/backend/resources/fonts/                          @dapzz-id @naufal225

# --- Domain C (Rekishi, reviewer Kadavi)
/frontend/src/components/scoring/                  @rekis-0103 @dapzz-id
/frontend/src/components/dashboard/                @rekis-0103 @dapzz-id
/frontend/src/lib/api-types/dashboard.ts           @rekis-0103 @dapzz-id
/frontend/src/lib/api-types/system.ts              @rekis-0103 @dapzz-id
/frontend/src/fixtures/scoring.ts                  @rekis-0103 @dapzz-id
/frontend/src/fixtures/dashboard.ts                @rekis-0103 @dapzz-id

# --- Dokumen UI dan penunjuk agent: semua pemilik
/docs/UI_DESIGN_SYSTEM.md                          @naufal225 @dapzz-id @rekis-0103
/docs/UI_PAGES.md                                  @naufal225 @dapzz-id @rekis-0103
/docs/UI_WORKPLAN.md                               @naufal225 @dapzz-id @rekis-0103
/docs/UI_PROMPTS.md                                @naufal225 @dapzz-id @rekis-0103
/AGENTS.md                                         @naufal225 @dapzz-id @rekis-0103
# UI_PAYLOAD_AUDIT sengaja tanpa pemilik: boleh diubah siapa saja
/docs/UI_PAYLOAD_AUDIT.md
```

Catatan: `lib/labels/<domain>.ts` yang sudah terdaftar di CODEOWNERS tidak berubah. Berkas label baru lainnya mengikuti domainnya.

### b. `docs/OWNERSHIP.md`: tambahkan bagian

```markdown
## UI

Pembagian lapisan UI dan jadwal kerja ada di `docs/UI_WORKPLAN.md`. Ringkasnya:
- Fondasi (token, shell, komponen `radar/`, `SignalChart`, `/login`): Naufal.
- Komponen domain: `ScoreBar` → Rekishi; `DecisionPanel`, `DecisionTrail`, `EvidenceMap` → Kadavi.
- Halaman mengikuti tabel "Halaman frontend" di atas.
- Folder baru dan pemiliknya: lihat blok "UI" di `.github/CODEOWNERS`.
```

### c. `docs/PRD.md`: tambahkan entri riwayat (v2.3)

- Keputusan UI: tema terang "Lembar Situasi" + grafik gaya "Denyut Isu"; token dan komponen di `docs/UI_DESIGN_SYSTEM.md`; spesifikasi halaman di `docs/UI_PAGES.md`.
- Pekerjaan UI adalah lintas-fase (reskin berbasis token + Fase 8) dan tidak menunggu DoD fase deteksi.
- §12.1: tambahkan `lucide-react`; tegaskan font di-bundle (mode offline).
- Contoh §11.3: samakan angka skor dengan Σ komponen; tambah catatan bentuk `score_breakdown` untuk `kind='impersonation'`.
- Rapikan sisa penyuntingan di §10.9 ("bertipe sistem? Tidak;") dan baris Fase 2/3 yang menyatu di tabel §18.
