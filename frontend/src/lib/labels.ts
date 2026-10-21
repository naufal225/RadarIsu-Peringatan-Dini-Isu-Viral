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

export const sourceTypeLabels = { rss: "RSS", youtube: "YouTube", csv: "CSV", replay: "Replay" } as const;

export const sourceStatusLabels = { never: "Belum pernah diuji", ok: "Sehat", error: "Galat" } as const;

// PRD §9.7 audit actions.
export const auditActionLabels = {
  "auth.login": "Masuk",
  "auth.login_failed": "Gagal masuk",
  "auth.logout": "Keluar",
  "user.create": "Pengguna dibuat",
  "user.update": "Pengguna diubah",
  "user.deactivate": "Pengguna dinonaktifkan",
  "source.create": "Sumber dibuat",
  "source.update": "Sumber diubah",
  "source.test": "Uji koneksi sumber",
  "source.import": "Impor CSV",
  "topic.create": "Topik dibuat",
  "topic.update": "Topik diubah",
  "official_account.create": "Akun resmi ditambahkan",
  "official_account.delete": "Akun resmi dihapus",
  "alert.take": "Alert diambil",
  "alert.escalate": "Alert dieskalasi",
  "alert.false_positive": "Alert ditandai false positive",
  "alert.close": "Alert ditutup",
  "alert.approve": "Alert disetujui",
  "alert.return": "Alert dikembalikan",
  "alert.comment": "Komentar alert",
  "briefing.create": "Briefing disusun",
  "briefing.download": "Briefing diunduh",
  "replay.start": "Replay dimulai",
  "replay.stop": "Replay dihentikan",
  "settings.update": "Pengaturan diubah",
  "label.set": "Label diberikan",
  "evaluation.run": "Evaluasi dijalankan",
} as const;

// Error codes returned by the API (CSV import rows/files, source actions). Codes may carry
// a detail after a colon, e.g. "missing_columns:text,posted_at".
export const errorCodeLabels = {
  missing_text: "Kolom text kosong",
  missing_account_handle: "Kolom account_handle kosong",
  invalid_posted_at: "posted_at bukan ISO 8601 dengan zona waktu (mis. 2026-10-20T08:15:00+07:00)",
  invalid_account_created_at: "account_created_at bukan ISO 8601 dengan zona waktu",
  field_too_long: "Isian terlalu panjang (text maks 10.000, kolom lain maks 190 karakter)",
  column_count_mismatch: "Jumlah kolom tidak sesuai header",
  duplicate_row: "Baris duplikat (sudah ada di file atau di sumber ini)",
  empty_file: "File kosong",
  invalid_encoding: "File harus berenkode UTF-8",
  too_many_rows: "Lebih dari 50.000 baris",
  missing_columns: "Kolom wajib tidak ada",
  unknown_columns: "Kolom tidak dikenal",
  duplicate_columns: "Nama kolom ganda",
  source_not_csv: "Impor hanya untuk sumber bertipe CSV",
  offline_mode_enabled: "Mode Offline aktif: koneksi keluar dinonaktifkan",
  connection_test_not_supported: "Uji koneksi hanya untuk sumber RSS dan YouTube",
} as const;

/** Indonesian description of an API error code; unknown codes are shown as-is. */
export function describeErrorCode(code: string): string {
  const colon = code.indexOf(":");
  const key = colon === -1 ? code : code.slice(0, colon);
  const detail = colon === -1 ? "" : code.slice(colon + 1);
  const label = (errorCodeLabels as Record<string, string>)[key];
  if (!label) return code;
  return detail ? `${label}: ${detail}` : label;
}

// Generic UI copy.
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
  nav: {
    dashboard: "Dasbor",
    status: "Status sistem",
    users: "Pengguna",
    sources: "Sumber data",
    audit: "Audit log",
  },
  common: {
    save: "Simpan",
    saving: "Menyimpan…",
    add: "Tambah",
    cancel: "Batal",
    yes: "Ya",
    no: "Tidak",
    none: "—",
    previous: "Sebelumnya",
    next: "Berikutnya",
    page: "Halaman",
    loadError: "Gagal memuat data. Muat ulang halaman.",
    actionError: "Aksi gagal. Coba lagi.",
    invalidFields: "Periksa isian berikut:",
    active: "Aktif",
    inactive: "Nonaktif",
    activate: "Aktifkan",
    deactivate: "Nonaktifkan",
    empty: "Belum ada data.",
  },
  users: {
    title: "Pengguna",
    name: "Nama",
    email: "Email",
    password: "Kata sandi (min. 10 karakter)",
    role: "Peran",
    status: "Status",
    lastLogin: "Login terakhir",
    newUser: "Tambah pengguna",
  },
  sources: {
    title: "Sumber data",
    type: "Tipe",
    name: "Nama",
    url: "URL feed RSS",
    maxItems: "Maks. item per tarikan",
    videoIds: "ID video YouTube (pisahkan dengan koma atau baris baru)",
    interval: "Interval tarik (menit)",
    everyMinutes: (minutes: number) => `tiap ${minutes} menit`,
    file: "File",
    status: "Status",
    lastChecked: "Terakhir dicek",
    lastError: "Galat terakhir",
    rawItems: "Item mentah",
    newSource: "Tambah sumber",
    test: "Uji koneksi",
    testing: "Menguji…",
    upload: "Unggah CSV",
    uploading: "Mengunggah…",
    importHistory: "Riwayat impor",
    importResult: "Hasil impor",
    total: "Total baris",
    success: "Berhasil",
    failed: "Gagal",
    row: "Baris",
    problem: "Masalah",
    errorsTruncated: "Hanya 200 baris bermasalah pertama yang ditampilkan.",
    csvFormat:
      "Header wajib: text, account_handle, posted_at. Opsional: external_id, account_display_name, account_created_at. Waktu dalam ISO 8601 dengan zona waktu. Maks. 10 MB / 50.000 baris.",
    ingestLater: "Penarikan terjadwal RSS/YouTube aktif mulai Fase 3; saat ini hanya uji koneksi.",
  },
  audit: {
    title: "Audit log",
    time: "Waktu",
    user: "Pengguna",
    action: "Aksi",
    object: "Objek",
    ip: "IP",
    detail: "Detail",
    allUsers: "Semua pengguna",
    allActions: "Semua aksi",
    from: "Dari tanggal",
    to: "Sampai tanggal",
    filter: "Terapkan filter",
    system: "Sistem",
  },
  adminStatus: {
    title: "Status sistem",
    sources: "Kesehatan sumber",
    queue: "Antrean",
    pendingJobs: "Job menunggu",
    failedJobs: "Job gagal",
    recentFailures: "Kegagalan terakhir",
    counts: "Jumlah data",
    rawItems: "Item mentah",
    unprocessedRawItems: "Item mentah belum diproses",
    posts: "Posting",
    openAlerts: "Alert terbuka",
    offlineMode: "Mode Offline",
  },
} as const;
