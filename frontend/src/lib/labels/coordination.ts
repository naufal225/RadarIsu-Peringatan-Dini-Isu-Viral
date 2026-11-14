// F4 labels: coordination detection on the topic page (PRD §10.6) and the readable summary of alert
// evidence on the alert page. Re-exported through lib/labels.ts as `ui.coordination`.

export const coordinationUi = {
  panel: {
    title: "Deteksi koordinasi akun",
    intro:
      "Posting dengan teks hampir identik dari akun berbeda dalam jendela waktu sempit. Satu akun yang mengulang pesan tidak dihitung sebagai koordinasi. Panel ini hanya untuk Analis dan tidak membuat alert.",
    asOf: (when: string) => `Per ${when}`,
    asOfPrefix: "Per",
    windowFrom: "Jendela",
    windowTo: "sampai",
    window: (from: string, to: string) => `Jendela ${from} sampai ${to}`,
    triggered: "Koordinasi terdeteksi",
    notTriggered: "Belum ada koordinasi",
    postsInWindow: "Posting dalam jendela",
    accountsInWindow: "Akun dalam jendela",
    truncated: "Jendela melebihi batas posting; hanya posting terbaru yang dibandingkan.",
    empty: "Tidak ada klaster teks hampir identik dari cukup banyak akun pada jendela ini.",
    thresholds: (similarity: string, accounts: number, minutes: number) =>
      `Ambang: kemiripan ${similarity}, minimal ${accounts} akun berbeda, jendela ${minutes} menit.`,
    cluster: (id: number) => `Klaster ${id}`,
    clusterSummary: (accounts: number, posts: number) => `${accounts} akun · ${posts} posting`,
    similarity: (min: string, max: string) => `Kemiripan ${min} sampai ${max}`,
    synchronized: "Serentak",
    notSynchronized: "Tidak serentak",
    synchronizedDetail: (inWindow: number, total: number, minutes: number) =>
      `${inWindow} dari ${total} posting dalam ${minutes} menit`,
    sampleText: "Contoh teks",
    accountsShown: (shown: number, total: number) => (shown < total ? `Menampilkan ${shown} dari ${total} akun` : `${total} akun`),
    columns: { account: "Akun", similarity: "Kemiripan", age: "Umur akun", flags: "Penanda", posts: "Posting" },
    young: "Akun baru",
    sync: "Serentak",
    ageDays: (days: number) => `${days} hari`,
    ageUnknown: "Tidak diketahui",
  },
  evidence: {
    raw: "Data mentah",
    spikeSample: (rate: string, mean: string, z: string, needed: string) =>
      `Volume ${rate} posting per jam, rata-rata baseline ${mean}; z ${z} (ambang ${needed}).`,
    similarText: (similarity: string, cluster: number, accounts: number, posts: number) =>
      `Kemiripan ${similarity} dengan teks klaster ${cluster} (${accounts} akun, ${posts} posting).`,
    youngAccount: (days: string, limit: number) => `Akun berumur ${days} hari saat memposting (batas akun baru ${limit} hari).`,
    synchronizedPosting: (inWindow: number, total: number, minutes: number, ratio: string) =>
      `${inWindow} dari ${total} posting klaster berada dalam ${minutes} menit (porsi ${ratio}).`,
    truncated: "Jendela terpotong oleh batas posting.",
  },
} as const;
