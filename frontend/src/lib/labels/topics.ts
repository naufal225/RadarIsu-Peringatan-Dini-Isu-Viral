// F2 labels: topics, templates, official accounts and the topic chart (PRD §9.8, §12.2, §14).
// Re-exported through lib/labels.ts as `topicCategoryLabels`, `sensitivityLabels` and `ui.topics`.

export const topicCategoryLabels = {
  institution: "Institusi",
  impersonation: "Peniruan",
  opsec: "OPSEC",
  general: "Umum",
} as const;

export const sensitivityLabels = { low: "Rendah", medium: "Sedang", high: "Tinggi" } as const;

export const topicsUi = {
  title: "Topik pantauan",
  intro:
    "Topik adalah kumpulan kata kunci yang dicari di postingan. Postingan yang memuat salah satu kata kunci sebagai kata atau frasa utuh dihitung ke topik itu, dan jumlahnya tampil per jam di grafik.",
  columns: { name: "Nama", category: "Kategori", keywords: "Kata kunci", sensitivity: "Sensitivitas", status: "Status" },
  template: "Templat",
  templatesTitle: "Templat topik",
  templatesIntro:
    "Titik awal untuk kasus penggunaan UC1 sampai UC3. Pakai templat, ganti setiap bagian [dalam kurung] dengan isi sebenarnya, lalu simpan sebagai topik.",
  useTemplate: "Pakai templat",
  edit: "Ubah",
  noTopics: "Belum ada topik. Buat topik pertama atau pakai salah satu templat.",
  form: {
    createTitle: "Buat topik",
    editTitle: (name: string) => `Ubah topik: ${name}`,
    name: "Nama topik",
    category: "Kategori",
    sensitivity: "Sensitivitas",
    sensitivityHint: "Topik bersensitivitas tinggi memicu peringatan lebih mudah.",
    keywords: "Kata kunci",
    keywordsHint:
      "Satu per baris atau pisahkan dengan koma. Dicocokkan sebagai kata atau frasa utuh tanpa membedakan huruf besar dan kecil, jadi \"korupsi\" tidak cocok dengan \"korupsinya\". Tambahkan varian sebagai kata kunci tersendiri.",
    active: "Aktif",
    create: "Buat topik",
    save: "Simpan perubahan",
    cancel: "Batal",
  },
  placeholderWarning: "Masih ada bagian [dalam kurung]. Ganti dengan isi sebenarnya sebelum menyimpan.",
  errors: {
    keyword_has_placeholder: "Kata kunci tidak boleh memuat tanda [ atau ]. Ganti bagian [dalam kurung] dengan isi sebenarnya.",
    keywords_unmatchable: "Kata kunci harus memuat huruf atau angka.",
    template_readonly: "Templat tidak bisa diubah. Buat topik baru dari templat ini.",
    range_too_long: "Rentang tanggal maksimum 31 hari.",
  } as Record<string, string>,
  detail: {
    back: "Kembali ke daftar topik",
    notFound: "Topik tidak ditemukan.",
    chartTitle: "Posting per jam",
    from: "Dari tanggal",
    to: "Sampai tanggal",
    apply: "Terapkan",
    reset: "Rentang bawaan",
    range: (from: string, to: string) => `Menampilkan ${from} sampai ${to}.`,
    totalPosts: "Total posting",
    peakHour: "Jam puncak",
    hoursWithData: "Jam dengan data",
    empty:
      "Belum ada data pada rentang ini. Data muncul setelah sumber diimpor dan diproses.",
    hourAxis: "Jam (waktu setempat)",
    volume: "Posting",
  },
  list: {
    subtitle: "Kumpulan kata kunci yang dipantau. Klik nama topik untuk melihat grafik volume per jam.",
    create: "Buat topik",
    fromScratch: "Buat dari nol",
    tableCaption: "Daftar topik pantauan",
    templatesCaption: "Daftar templat topik",
    keywordCount: (n: number) => `${n} kata kunci`,
    active: "Aktif",
    yes: "Ya",
    no: "Tidak",
    actions: "Aksi",
    close: "Tutup",
    placeholderMarker: "Masih berisi [isian]",
  },
  range: {
    label: "Rentang",
    last24: "24 jam terakhir data",
    last7: "7 hari terakhir data",
    note: (from: string, to: string) => `Data ${from} sampai ${to}.`,
    noteLabel: "Data",
    until: "sampai",
  },
  keywordsTitle: "Kata kunci",
  spikeStatus: "Status lonjakan saat ini",
  officialAccounts: {
    confirmRemoveTitle: (handle: string) => `Hapus akun resmi ${handle}?`,
    confirmRemoveBody: "Akun yang mirip dengan akun ini tidak akan ditandai lagi sebagai potensi peniruan.",
    tableCaption: "Daftar akun resmi",
    title: "Akun resmi",
    intro:
      "Daftar akun resmi satuan. Akun baru yang handle atau namanya mirip dengan salah satunya ditandai sebagai potensi peniruan.",
    handle: "Handle",
    displayName: "Nama tampilan",
    note: "Catatan",
    add: "Tambah akun resmi",
    remove: "Hapus",
    empty: "Belum ada akun resmi.",
    duplicate: "Handle ini sudah terdaftar.",
  },
} as const;
