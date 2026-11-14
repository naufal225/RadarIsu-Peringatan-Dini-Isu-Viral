// UI labels for Situation Dashboard (F8, Domain C).
// Reference: PRD §11.2, §12.2, docs/CONTRACTS.md §3.2.

export const dashboardUi = {
  title: "Dasbor situasi",
  subtitle: "Pemantauan ancaman dan peringatan dini isu viral secara real-time.",
  kpi: {
    activeIssues: "Isu Aktif",
    activeIssuesDesc: "Isu terbuka yang berpotensi menjadi ancaman",
    highestSeverity: "Keparahan Tertinggi",
    highestSeverityDesc: "Tingkat keparahan ancaman paling kritis saat ini",
    awaitingDecision: "Menunggu Keputusan",
    awaitingDecisionDesc: "Alert dieskalasi yang memerlukan keputusan Pimpinan",
  },
  trend: {
    title: "Tren Volume Pembicaraan (24 Jam)",
    subtitle: "Agregasi posting per jam di seluruh sumber dan topik pantauan.",
    totalPosts: "Total Posting (24 Jam)",
    peakHour: "Jam Puncak",
    postsCount: "posting",
    volume: "Volume Posting",
    noData: "Belum ada rekaman posting pada rentang waktu ini.",
  },
  issues: {
    title: "Daftar Isu Prioritas",
    subtitle: "Isu aktif yang diurutkan berdasarkan skor ancaman tertinggi.",
    viewAllAlerts: "Lihat Semua Alert",
    empty: "Tidak ada isu atau ancaman aktif saat ini.",
    table: {
      topic: "Topik / Subjek",
      kind: "Jenis",
      score: "Skor Ancaman",
      severity: "Keparahan",
      status: "Status",
      detectedAt: "Terdeteksi",
      action: "Aksi",
    },
    viewDetail: "Buka Detail",
  },
  priority: {
    title: "Perlu ditangani",
    subtitle: "Isu yang menunggu tindakan Anda.",
    empty: "Tidak ada isu yang menunggu tindakan.",
    open: "Buka",
  },
  quickLinks: {
    title: "Tindakan Cepat",
    triageAlerts: "Triase Alert Baru",
    reviewEscalated: "Tinjau Isu Dieskalasi",
    viewTopics: "Kelola Topik Pantauan",
    viewBriefings: "Unduh Briefing PDF",
    labelingQueue: "Antrean Pelabelan",
    evaluation: "Hasil Evaluasi",
  },
};
