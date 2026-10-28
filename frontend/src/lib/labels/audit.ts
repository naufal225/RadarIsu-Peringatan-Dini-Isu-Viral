// F10 labels: halaman Audit (docs/UI_PAGES.md, /admin/audit). Diekspor lewat lib/labels.ts sebagai `ui.audit`.

export const auditUi = {
  title: "Audit",
  subtitle: "Catatan aksi pengguna dan sistem. Hanya dapat dibaca; catatan tidak dapat diubah atau dihapus.",
  time: "Waktu",
  user: "Pengguna",
  action: "Aksi",
  object: "Objek",
  ip: "IP",
  detail: "Rincian",
  allUsers: "Semua pengguna",
  allActions: "Semua aksi",
  from: "Dari tanggal",
  to: "Sampai tanggal",
  filter: "Terapkan filter",
  filters: "Filter audit",
  system: "Sistem",
  showDetail: "Lihat rincian",
  userAgent: "Peramban",
  noDetail: "—",
  empty: "Tidak ada catatan untuk filter ini",
  emptyHint: "Ubah atau bersihkan filter.",
  tableCaption: "Catatan audit, terbaru di atas",
  invalidFilter: "Isian filter tidak valid",
  invalidRange: "Tanggal akhir harus sama dengan atau setelah tanggal awal",
  count: (n: string) => `${n} catatan`,
  countFiltered: (n: string) => `${n} catatan cocok dengan filter`,
  showJson: "Lihat data lengkap",
  moreDetail: "dan isian lain di data lengkap",
} as const;

/** Model behind `object_type` (AuditLogger: snake_case class name). An unknown type is shown as its code. */
export const auditObjectLabels = {
  alert: "Alert",
  briefing: "Briefing",
  evaluation_run: "Evaluasi",
  official_account: "Akun resmi",
  post: "Posting",
  replay_scenario: "Skenario Replay",
  source: "Sumber data",
  topic: "Topik",
  user: "Pengguna",
} as const;
