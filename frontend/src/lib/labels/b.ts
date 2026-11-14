// Domain B UI labels (PRD §8, §11, §14): Alerts, Triage, and Briefings.
// Re-exported through lib/labels.ts; import from there.

export const bUi = {
  nav: {
    alerts: "Peringatan & Isu",
    briefings: "Briefing",
  },
  alerts: {
    title: "Peringatan & Triase Isu",
    detailTitle: "Detail Peringatan",
    id: "ID",
    topicOrAccount: "Topik / Akun",
    kind: "Jenis",
    score: "Skor Ancaman",
    severity: "Tingkat Bahaya",
    status: "Status",
    detectedAt: "Waktu Deteksi",
    filterStatus: "Filter Status",
    filterSeverity: "Filter Tingkat Bahaya",
    filterKind: "Filter Jenis",
    allStatus: "Semua Status",
    allSeverity: "Semua Tingkat Bahaya",
    allKind: "Semua Jenis",
    viewDetail: "Lihat Detail",
    backToList: "Kembali ke Daftar",
    listSubtitle: "Diurutkan berdasarkan skor ancaman tertinggi.",
    filterGroup: "Filter alert",
    listEmpty: "Belum ada alert.",
    listEmptyFiltered: "Tidak ada alert dengan filter ini.",

    // Breakdown
    scoreBreakdown: "Rincian Skor Ancaman",
    spike: "Lonjakan Volume (Spike)",
    anomaly: "Koordinasi Akun (Anomali)",
    sentiment: "Sentimen Negatif",
    reach: "Jangkauan Sumber (Reach)",
    thresholds: "Ambang Batas Aktif",
    raw: "Mentah",
    weight: "Bobot",
    value: "Nilai",

    // Evidence
    evidence: "Bukti Terlampir",
    reason: "Alasan Bukti",
    account: "Akun Terkait",
    postSnippet: "Cuplikan Postingan",
    detail: "Detail Teknis",
    noEvidence: "Belum ada bukti terlampir.",

    // Actions & Timeline
    timeline: "Riwayat Penanganan",
    action: "Aksi",
    user: "Oleh",
    note: "Catatan",
    recommendation: "Rekomendasi Analis",
    time: "Waktu",

    // Triage Operations
    take: "Ambil Alih Triase",
    taking: "Mengambil alih…",
    escalate: "Eskalasi ke Pimpinan",
    escalating: "Mengeskalasi…",
    approve: "Setujui Rekomendasi",
    approving: "Menyetujui…",
    return: "Minta Analisis Ulang",
    returning: "Mengembalikan…",
    falsePositive: "Tandai False Positive",
    closingFp: "Menandai…",
    close: "Tutup Isu",
    closing: "Menutup…",
    comment: "Kirim Catatan / Komentar",
    commenting: "Mengirim…",
    addComment: "Tambah Komentar",

    recommendationPlaceholder: "Tuliskan rekomendasi tindakan institusional bagi pimpinan…",
    notePlaceholder: "Tuliskan catatan analisis tambahan…",
    commentPlaceholder: "Tuliskan komentar atau catatan koordinasi…",

    generateBriefing: "Susun Briefing PDF",
    generatingBriefing: "Menyusun PDF…",
    downloadBriefing: "Unduh Briefing PDF",

    simulatedWarning: "Peringatan ini terdeteksi dari data simulasi / replay.",
  },
  briefings: {
    title: "Laporan Briefing Institusional",
    briefingTitle: "Judul",
    relatedAlert: "Peringatan Terkait",
    author: "Penyusun",
    fileSize: "Ukuran",
    createdAt: "Dibuat Pada",
    download: "Unduh PDF",
    downloading: "Mengunduh…",
    summary: "Ringkasan Eksekutif",
    empty: "Belum ada dokumen briefing yang disusun.",
    createSuccess: "Dokumen briefing PDF berhasil disusun.",
  },
} as const;
