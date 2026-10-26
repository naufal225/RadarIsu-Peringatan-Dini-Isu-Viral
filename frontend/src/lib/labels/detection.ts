// F3 labels: spike detection on the topic page (PRD §10.5). Re-exported through lib/labels.ts as `ui.detection`.

export const spikeStatusLabels = {
  triggered: "Lonjakan terdeteksi",
  below_threshold: "Di bawah ambang lonjakan",
  below_min_volume: "Volume terlalu kecil untuk dihitung",
  insufficient_baseline: "Data belum cukup untuk baseline",
} as const;

export const detectionUi = {
  spike: {
    title: "Deteksi lonjakan",
    intro:
      "Volume per jam dibandingkan dengan baseline riwayat topik ini. Lonjakan terpicu bila volume saat ini melewati ambang dan jumlah posting mencapai volume minimum.",
    hours: "Rentang grafik",
    hoursOption: (hours: number) => `${hours} jam terakhir`,
    asOf: (when: string) => `Per ${when}`,
    status: "Status",
    current: "Posting saat ini",
    currentHint: (minutes: number) => `Dalam ${minutes} menit terakhir`,
    baselineMean: "Rata-rata baseline per jam",
    baselineStd: "Simpangan baku baseline",
    baselineHours: "Jam riwayat baseline",
    z: "Nilai z saat ini",
    zNeeded: "z yang dibutuhkan",
    threshold: "Ambang (posting per jam)",
    minVolume: "Volume minimum",
    chartLabel: "Volume posting per jam dibandingkan ambang lonjakan",
    volume: "Volume",
    runningHour: "Jam berjalan (belum penuh)",
    thresholdLine: "Ambang lonjakan",
    meanLine: "Rata-rata baseline",
    insufficient: (have: number, need: number) =>
      `Riwayat topik baru ${have} jam; deteksi lonjakan menunggu sekurang-kurangnya ${need} jam.`,
    empty: "Belum ada posting pada rentang ini.",
    sensitivity: (name: string, offset: string) => `Sensitivitas ${name} (offset z ${offset})`,
    alertsLink: "Lihat daftar alert",
  },
} as const;
