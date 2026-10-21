// UI label map (PRD §14). Code identifiers stay English; every user-facing string comes from here.

export const roleLabels = {
  admin: "Admin Sistem",
  analyst: "Analis",
  leader: "Pimpinan",
} as const;

export const alertStatusLabels = {
  new: "Baru",
  reviewing: "Ditinjau",
  escalated: "Dieskalasi",
  returned: "Dikembalikan",
  approved: "Disetujui",
  false_positive: "False Positive",
  closed: "Ditutup",
} as const;

export const severityLabels = { low: "Rendah", medium: "Sedang", high: "Tinggi" } as const;

export const alertKindLabels = { issue: "Isu", impersonation: "Peniruan Akun" } as const;

export const sentimentLabels = { positive: "Positif", negative: "Negatif", neutral: "Netral" } as const;

export const manualLabelLabels = { organic: "Organik", anomalous: "Tidak Wajar" } as const;

export const evidenceReasonLabels = {
  similar_text: "Teks sangat mirip",
  young_account: "Akun baru",
  synchronized_posting: "Posting serentak",
  name_similarity: "Nama mirip akun resmi",
  spike_sample: "Contoh posting saat lonjakan",
} as const;

export const topicCategoryLabels = {
  institution: "Institusi",
  impersonation: "Peniruan",
  opsec: "OPSEC",
  general: "Umum",
} as const;

export const alertActionLabels = {
  take: "Ambil",
  escalate: "Eskalasi",
  approve: "Setujui",
  return: "Minta analisis lanjutan",
  comment: "Komentar",
} as const;

// Generic UI copy used by the Phase 1 shell.
export const ui = {
  appName: "RadarIsu",
  simulatedData: "DATA SIMULASI",
  login: {
    title: "Masuk ke RadarIsu",
    email: "Email",
    password: "Kata sandi",
    submit: "Masuk",
    submitting: "Memproses…",
    invalidCredentials: "Email atau kata sandi salah, atau akun nonaktif.",
    throttled: "Terlalu banyak percobaan. Coba lagi dalam satu menit.",
    genericError: "Gagal masuk. Coba lagi.",
  },
  logout: "Keluar",
  loading: "Memuat…",
  forbidden: {
    title: "Akses ditolak",
    body: "Peran Anda tidak memiliki izin untuk membuka halaman ini.",
  },
  dashboard: {
    title: "Dasbor situasi",
    pending: "Ringkasan situasi tersedia pada fase berikutnya.",
  },
  adminStatus: {
    title: "Status sistem",
    pending: "Kesehatan sistem tersedia pada fase berikutnya.",
  },
} as const;
