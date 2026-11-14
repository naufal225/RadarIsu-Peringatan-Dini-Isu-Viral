// F14-b labels: evaluation page (PRD §15, §12.2). Re-exported through lib/labels.ts as `ui.evaluation`.

export const evaluationErrorCodes = {
  scenario_not_replayed: "Skenario ini belum pernah diputar ulang",
} as const;

/** Notes stored with a run (see EvaluationCalculator); a detail may follow a colon. */
export const evaluationNoteLabels = {
  no_labeled_accounts: "Belum ada akun berlabel; semua angka 0",
  no_predicted_positive: "Tidak ada akun yang ditandai sistem; presisi dihitung 0",
  no_actual_positive: "Tidak ada akun Tidak Wajar di data berlabel; recall dihitung 0",
  mixed_label_accounts: "Akun berlabel campuran dihitung Tidak Wajar",
  no_detection: "Tidak ada alert isu yang menandai akun Tidak Wajar; waktu deteksi kosong",
} as const;

export const evaluationUi = {
  title: "Evaluasi deteksi",
  intro:
    "Mengukur seberapa tepat sistem menandai akun yang tidak wajar, dibandingkan label manual. Angka dihitung per akun, hanya dari akun yang punya label.",
  run: "Jalankan evaluasi",
  running: "Menjalankan…",
  scenario: "Cakupan",
  allLabeled: "Semua posting berlabel",
  latest: "Hasil terbaru",
  empty: "Belum ada evaluasi. Beri label di halaman Pelabelan, lalu jalankan evaluasi.",
  metrics: {
    precision: "Presisi",
    recall: "Recall",
    f1: "F1",
    latency: "Waktu deteksi",
  },
  latencyNone: "Tidak diukur",
  latencyBefore: (text: string) => `${text} sebelum insiden`,
  counts: (tp: number, fp: number, fn: number, posts: number) => `TP ${tp}, FP ${fp}, FN ${fn} dari ${posts} posting berlabel`,
  history: "Riwayat evaluasi",
  trendTitle: "Tren F1 antar run",
  trendNone: "Belum ada F1 yang bisa dihitung.",
  columns: { when: "Waktu", scope: "Cakupan", posts: "Posting", precision: "Presisi", recall: "Recall", f1: "F1", latency: "Waktu deteksi", by: "Dijalankan oleh", change: "Perubahan F1" },
  changeNone: "—",
  limitsTitle: "Keterbatasan",
  limits: [
    "Data uji kecil (sekitar 200 posting berlabel), sehingga angka bisa bergeser banyak oleh beberapa label saja.",
    "Sebagian besar data berasal dari skenario simulasi, bukan lalu lintas nyata; angka tidak boleh dibaca sebagai akurasi di lapangan.",
    "Sentimen memakai kamus sederhana dan tidak dinilai di sini.",
    "Ambang dan bobot deteksi dikalibrasi pada data yang sama dengan yang diukur, jadi hasilnya cenderung terlalu optimistis.",
    "Sistem melaporkan pola akun; keputusan akhir selalu manusia.",
  ],
  seconds: (n: number) => (n < 60 ? `${n} detik` : `${Math.floor(n / 60)} menit ${n % 60} detik`),
} as const;
