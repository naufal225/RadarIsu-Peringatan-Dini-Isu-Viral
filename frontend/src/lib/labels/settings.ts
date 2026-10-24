// F15 labels: detection settings page (PRD §9.6, §12.2). Re-exported through lib/labels.ts as `ui.settings`.
// Hints match docs/DETECTION_SETTINGS.md; keep the two in step.

type FieldCopy = { label: string; hint: string };

export const settingsUi = {
  title: "Pengaturan deteksi",
  intro:
    "Ambang dan bobot yang dipakai detektor dan skor ancaman. Perubahan berlaku pada siklus deteksi berikutnya dan dicatat di audit log. Setelah mengubah, jalankan ulang Evaluasi untuk melihat dampaknya.",
  save: "Simpan pengaturan",
  reset: "Batalkan perubahan",
  saved: "Pengaturan disimpan.",
  unchanged: "Tidak ada perubahan.",
  lastUpdated: (name: string, when: string) => `Terakhir diubah oleh ${name} pada ${when}.`,
  neverUpdated: "Belum pernah diubah dari nilai awal.",
  invalidFields: "Periksa isian berikut:",
  groups: {
    spike: "Deteksi lonjakan isu",
    coordination: "Deteksi koordinasi akun",
    impersonation: "Deteksi peniruan identitas",
    weights: "Bobot skor ancaman",
    severity: "Batas tingkat keparahan",
    sensitivity: "Sensitivitas topik",
  },
  fields: {
    z_threshold: {
      label: "Ambang lonjakan (z)",
      hint: "Seberapa jauh volume 60 menit terakhir harus melampaui rata-rata baseline, dalam simpangan baku. Lebih tinggi berarti lebih sedikit alert. Nilai efektif tidak pernah di bawah 2,0.",
    },
    min_volume: {
      label: "Volume minimum",
      hint: "Jumlah posting minimum dalam 60 menit terakhir agar lonjakan dihitung. Mencegah alert dari topik yang sangat sepi.",
    },
    baseline_hours: {
      label: "Panjang baseline (jam)",
      hint: "Berapa jam riwayat yang dipakai untuk menghitung volume normal (rata-rata dan simpangan baku).",
    },
    min_baseline_hours: {
      label: "Baseline minimum (jam)",
      hint: "Bila riwayat kurang dari ini, deteksi lonjakan dilewati dan komponen lonjakan bernilai 0. Tidak boleh melebihi panjang baseline.",
    },
    coordination_window_minutes: {
      label: "Jendela koordinasi (menit)",
      hint: "Rentang waktu posting yang dibandingkan saat mencari teks hampir identik. Lebih lebar menangkap kampanye yang lambat, tetapi menambah klaster palsu.",
    },
    similarity_threshold: {
      label: "Ambang kemiripan teks",
      hint: "Kemiripan trigram (0,3 sampai 1) agar dua posting dianggap hampir identik. Lebih tinggi berarti lebih ketat.",
    },
    min_accounts_cluster: {
      label: "Akun minimum per klaster",
      hint: "Klaster teks mirip ditandai terkoordinasi bila berasal dari sekurang-kurangnya sekian akun berbeda.",
    },
    young_account_days: {
      label: "Batas akun baru (hari)",
      hint: "Akun yang lebih muda dari ini saat memposting mendapat bukti Akun baru, dan menambah poin pada skor peniruan.",
    },
    impersonation_threshold: {
      label: "Ambang kemiripan nama",
      hint: "Kemiripan handle atau nama tampilan terhadap akun resmi agar akun baru ditandai sebagai potensi peniruan.",
    },
    "weights.spike": {
      label: "Bobot lonjakan",
      hint: "Poin maksimum dari seberapa besar lonjakan volume.",
    },
    "weights.anomaly": {
      label: "Bobot akun tidak wajar",
      hint: "Poin maksimum dari porsi akun yang ditandai oleh deteksi koordinasi.",
    },
    "weights.sentiment": {
      label: "Bobot sentimen negatif",
      hint: "Poin maksimum dari porsi posting bersentimen negatif.",
    },
    "weights.reach": {
      label: "Bobot jangkauan",
      hint: "Poin maksimum dari porsi sumber aktif yang ikut membahas topik.",
    },
    "severity_cutoffs.medium": {
      label: "Skor minimum severity Sedang",
      hint: "Skor di bawah ini berstatus Rendah. Harus lebih kecil dari batas Tinggi.",
    },
    "severity_cutoffs.high": {
      label: "Skor minimum severity Tinggi",
      hint: "Skor sebesar ini atau lebih berstatus Tinggi.",
    },
    "sensitivity_z_offset.low": {
      label: "Offset z, sensitivitas Rendah",
      hint: "Ditambahkan ke ambang z untuk topik bersensitivitas Rendah. Nilai positif membuatnya lebih sulit memicu alert.",
    },
    "sensitivity_z_offset.medium": {
      label: "Offset z, sensitivitas Sedang",
      hint: "Ditambahkan ke ambang z untuk topik bersensitivitas Sedang.",
    },
    "sensitivity_z_offset.high": {
      label: "Offset z, sensitivitas Tinggi",
      hint: "Ditambahkan ke ambang z untuk topik bersensitivitas Tinggi. Nilai negatif membuatnya lebih mudah memicu alert.",
    },
  } satisfies Record<string, FieldCopy>,
  rules: {
    weights: "Jumlah bobot harus tepat 100.",
    "severity_cutoffs.medium": "Batas Sedang harus lebih kecil dari batas Tinggi.",
    min_baseline_hours: "Baseline minimum tidak boleh melebihi panjang baseline.",
    sensitivity_z_offset: "Urutan offset harus Rendah ≥ Sedang ≥ Tinggi.",
  } as Record<string, string>,
  weightsTotal: (total: number) => `Jumlah bobot: ${total} dari 100`,
  preview: {
    title: "Pratinjau rumus skor",
    intro:
      "Skor = lonjakan + akun tidak wajar + sentimen negatif + jangkauan, dibulatkan, dengan nilai tiap komponen dibatasi bobotnya. Ubah contoh masukan untuk melihat dampak bobot dan batas yang sedang diisi.",
    formula: (w: { spike: number; anomaly: number; sentiment: number; reach: number }) =>
      `skor = min(z / 6, 1) × ${w.spike} + min(akun tidak wajar / akun unik, 1) × ${w.anomaly} + (posting negatif / volume) × ${w.sentiment} + min(sumber / sumber aktif, 1) × ${w.reach}`,
    inputs: {
      z: "Nilai z lonjakan",
      anomalousRatio: "Rasio akun tidak wajar (0 sampai 1)",
      negativeRatio: "Rasio posting negatif (0 sampai 1)",
      reachRatio: "Rasio sumber aktif (0 sampai 1)",
    },
    component: "Komponen",
    raw: "Nilai",
    weight: "Bobot",
    points: "Poin",
    components: {
      spike: "Lonjakan",
      anomaly: "Akun tidak wajar",
      sentiment: "Sentimen negatif",
      reach: "Jangkauan",
    },
    score: "Skor",
    severity: "Severity",
    effectiveZ: "Ambang z efektif per sensitivitas",
    effectiveZNote: "Ambang z ditambah offset, minimal 2,0.",
    unavailable: "Pratinjau tersedia setelah semua isian valid.",
  },
} as const;
