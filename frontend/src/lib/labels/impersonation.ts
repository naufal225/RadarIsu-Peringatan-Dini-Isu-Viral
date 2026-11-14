// F13 labels: impersonation detection on the topics page (PRD §10.7) and the readable summary of its
// alert evidence. Re-exported through lib/labels.ts as `ui.impersonation`.

export const impersonationUi = {
  panel: {
    title: "Akun mirip akun resmi",
    intro:
      "Akun yang pertama kali terlihat dalam jendela waktu terakhir dan namanya mirip akun resmi. Nama dinormalisasi lebih dulu (huruf kecil, Unicode, pemisah dibuang, karakter mirip disamakan). Akun resmi sendiri tidak pernah ditandai. Panel ini hanya untuk Analis dan tidak membuat alert.",
    asOf: (when: string) => `Per ${when}`,
    asOfPrefix: "Per",
    windowFrom: "Akun pertama kali terlihat",
    windowTo: "sampai",
    firstSeenPrefix: "Pertama terlihat",
    window: (from: string, to: string) => `Akun pertama kali terlihat ${from} sampai ${to}`,
    officialsCount: (count: number) => `${count} akun resmi sebagai pembanding`,
    filterOfficial: "Akun resmi",
    allOfficials: "Semua akun resmi",
    noOfficials: "Belum ada akun resmi. Tambahkan akun resmi di bagian di atas agar peniruan bisa dideteksi.",
    empty: "Tidak ada akun yang mirip akun resmi pada jendela ini.",
    columns: { account: "Akun", imitates: "Meniru", similarity: "Kemiripan", rules: "Aturan terpicu", age: "Umur akun", alert: "Alert" },
    sameName: "Nama sama setelah dinormalisasi",
    field: { handle: "handle", display_name: "nama tampilan" },
    comparedField: (field: string) => `dibandingkan lewat ${field}`,
    young: "Akun baru",
    ageDays: (days: number) => `${days} hari`,
    ageUnknown: "Tidak diketahui",
    firstSeen: (when: string) => `Pertama terlihat ${when}`,
    otherMatches: (items: string) => `Juga mirip: ${items}`,
    noAlert: "Belum ada alert",
    viewAlert: "Buka alert",
    noRules: "Tanpa aturan tambahan",
  },
  rules: {
    unicode_folded: "Karakter Unicode disamakan",
    separators_removed: "Pemisah dan spasi dibuang",
    confusable_chars: (pairs: string) => `Karakter mirip disamakan (${pairs})`,
    affix_stripped: (word: string, position: string) => `Imbuhan "${word}" di ${position === "prefix" ? "awal" : "akhir"} dibuang`,
    trailing_digits_stripped: (digits: string) => `Angka di ujung dibuang (${digits})`,
  },
  evidence: {
    nameSimilarity: (similarity: string, official: string, field: string) =>
      `Kemiripan ${similarity} dengan akun resmi ${official} (lewat ${field}).`,
    sameName: "Nama sama setelah dinormalisasi.",
    rules: (rules: string) => `Aturan: ${rules}.`,
    fieldNames: { handle: "handle", display_name: "nama tampilan" },
  },
} as const;
