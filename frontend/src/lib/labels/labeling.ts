// F14-a labels: manual labeling queue (PRD §12.2, §15). Re-exported through lib/labels.ts as `ui.labeling`.

export const labelingStatusFilterLabels = {
  unlabeled: "Belum berlabel",
  labeled: "Sudah berlabel",
  all: "Semua",
} as const;

export const labelingUi = {
  title: "Pelabelan data",
  daily: {
    title: "Sebaran label per tanggal posting",
    note: "Dikelompokkan menurut tanggal posting (UTC), bukan tanggal pelabelan.",
    empty: "Belum ada posting.",
    organic: "Organik",
    anomalous: "Tidak Wajar",
    unlabeled: "Belum berlabel",
  },
  intro:
    "Beri label Organik atau Tidak Wajar pada posting. Label dipakai halaman Evaluasi sebagai kebenaran dasar; perubahan dicatat di audit log.",
  progress: (labeled: string, target: string) => `${labeled} dari ±${target} diberi label`,
  breakdown: (organic: string, anomalous: string) => `Organik ${organic}, Tidak Wajar ${anomalous}`,
  filters: {
    status: "Status",
    simulated: "Hanya data simulasi",
  },
  empty: "Tidak ada posting untuk filter ini.",
  columns: { post: "Posting", account: "Akun", label: "Label", actions: "Aksi" },
  noAccount: "Akun tidak diketahui",
  setOrganic: "Organik",
  setAnomalous: "Tidak Wajar",
  clear: "Kosongkan label",
  unlabeled: "Belum berlabel",
  page: (current: number, last: number) => `Halaman ${current} dari ${last}`,
  allLabeled: "Semua posting sudah berlabel",
  filtersLabel: "Filter antrean",
  currentLabel: "Label saat ini",
  listLabel: "Antrean posting",
  progressLabel: "Kemajuan pelabelan",
} as const;
