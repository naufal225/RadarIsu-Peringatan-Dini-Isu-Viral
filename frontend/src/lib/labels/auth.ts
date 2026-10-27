// F12 labels: roles, login, logout, 403 screen and user management (PRD §8.1, §12, §14).
// Re-exported through lib/labels.ts; import from there.

export const roleLabels = {
  admin: "Admin Sistem",
  analyst: "Analis",
  leader: "Pimpinan",
} as const;

export const authUi = {
  login: {
    title: "Masuk ke RadarIsu",
    subtitle: "Sistem peringatan dini isu di ruang siber sosial",
    email: "Email",
    password: "Kata sandi",
    submit: "Masuk",
    submitting: "Memproses…",
    invalidCredentials: "Email atau kata sandi tidak sesuai",
    throttled: "Terlalu banyak percobaan. Coba lagi beberapa saat.",
    genericError: "Gagal masuk. Coba lagi.",
    backendUnavailable: "Server RadarIsu tidak dapat dihubungi. Pastikan layanan backend berjalan, lalu coba lagi.",
  },
  logout: "Keluar",
  backendUnavailable: {
    title: "Server tidak dapat dihubungi",
    body: "Layanan backend RadarIsu tidak menjawab. Pastikan layanan berjalan, lalu muat ulang halaman ini.",
    retry: "Muat ulang",
  },
  forbidden: {
    title: "Akses ditolak",
    body: "Peran Anda tidak memiliki izin untuk membuka halaman ini.",
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
} as const;
