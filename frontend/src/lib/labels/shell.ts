// Teks fondasi UI: shell, menu, penanda simulasi, dan state umum (docs/UI_DESIGN_SYSTEM.md §6, §7, §10).
// Diekspor lewat lib/labels.ts sebagai `ui.shell`.

export const navGroupLabels = {
  situation: "Situasi",
  monitoring: "Pantauan",
  quality: "Data dan mutu",
  admin: "Administrasi",
} as const;

export const navItemLabels = {
  dashboard: "Dasbor",
  alerts: "Alert",
  briefings: "Briefing",
  topics: "Topik",
  labeling: "Pelabelan",
  evaluation: "Evaluasi",
  status: "Status Sistem",
  sources: "Sumber Data",
  users: "Pengguna",
  replay: "Replay",
  settings: "Pengaturan Deteksi",
  audit: "Audit",
} as const;

export const shellUi = {
  brand: "RadarIsu",
  brandTagline: "Sistem peringatan dini isu di ruang siber sosial",
  footer: "Purwarupa Kartika Cyber Hackathon 2026",
  mainNavigation: "Navigasi utama",
  openMenu: "Buka menu",
  closeMenu: "Tutup menu",
  skipToContent: "Lewati ke konten",
  logout: "Keluar",
  collapsedHint: "Menu",
} as const;

export const simulationUi = {
  badge: "DATA SIMULASI",
  bannerTitle: "DATA SIMULASI",
  bannerBody: "Skenario Replay. Angka dan waktu pada layar ini bukan data nyata.",
  dataClockLabel: "Jam data:",
} as const;

export const stateUi = {
  loading: "Memuat…",
  retry: "Coba lagi",
  errorTitle: "Data tidak dapat dimuat",
  errorBody: "Terjadi gangguan saat mengambil data. Coba lagi beberapa saat.",
  notAvailableTitle: "Data tidak tersedia",
  notAvailableBody: "Data yang diminta tidak tersedia.",
  notImplementedTitle: "Fitur ini belum tersedia",
  notImplementedBody: "Bagian ini akan tersedia pada fase berikutnya.",
  loadedAtLabel: "Dimuat pukul",
  emptyTitle: "Tidak ada data",
  notAvailableValue: "—",
} as const;

export const confirmUi = {
  cancel: "Batal",
  pending: "Memproses…",
} as const;

export const paginationUi = {
  label: "Halaman",
  previous: "Sebelumnya",
  next: "Berikutnya",
  summary: (from: string, to: string, total: string) => `${from}–${to} dari ${total}`,
  page: (page: number, last: number) => `Halaman ${page} dari ${last}`,
} as const;

export const tableUi = {
  viewAsTable: "Lihat data sebagai tabel",
  empty: "Tidak ada data untuk ditampilkan.",
} as const;

/** Teks halaman pengembangan /dev/styleguide. */
export const styleguideUi = {
  title: "Styleguide",
  subtitle: "Komponen fondasi dan semua state-nya. Halaman ini hanya ada di mode pengembangan.",
  palette: "Token warna",
  type: "Tipografi",
  badges: "Severity dan status",
  time: "Waktu",
  table: "Tabel data",
  states: "State",
  feedback: "Kontrol dan dialog",
  stats: "Angka dan paginasi",
  skeletons: "Skeleton",
  simulation: "Penanda simulasi",
  sampleHeading: "Judul halaman (serif 24)",
  sampleBody: "Teks isi 14/20 untuk seluruh UI.",
  sampleMono: "@akun_contoh · 2026-10-27T07:29:00Z",
  hoverNote: "Arahkan kursor atau fokuskan waktu untuk melihat UTC.",
  columns: { title: "Judul", severity: "Severity", status: "Status", score: "Skor", detected: "Terdeteksi" },
  tableCaption: "Contoh tabel alert",
  tableEmpty: "Tidak ada alert untuk filter ini",
  tableEmptyHint: "Ubah filter atau rentang waktu.",
  confirmOpen: "Buka dialog konfirmasi",
  confirmTitle: "Tutup alert ini?",
  confirmBody: "Alert yang ditutup tidak dapat dibuka kembali.",
  confirmAction: "Tutup alert",
  fieldLabel: "Alasan penutupan",
  fieldError: "Catatan wajib diisi",
  statLabel: "Alert aktif",
  statHint: "Dari data contoh",
  filter: "Filter contoh",
  filterSeverity: "Severity",
  all: "Semua",
  buttons: { primary: "Utama", secondary: "Sekunder", destructive: "Hapus", pending: "Memproses", disabled: "Nonaktif" },
} as const;
