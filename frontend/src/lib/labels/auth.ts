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
    subtitle: "Akun yang dapat masuk ke RadarIsu dan perannya.",
    editUser: "Ubah pengguna",
    edit: "Ubah",
    active: "Aktif",
    isActive: "Akun aktif (dapat masuk)",
    actions: "Aksi",
    save: "Simpan",
    saving: "Menyimpan…",
    close: "Tutup",
    you: "Anda",
    never: "Belum pernah",
    yes: "Ya",
    no: "Tidak",
    empty: "Belum ada pengguna.",
    tableCaption: "Daftar pengguna",
    // Pesan 422 per bidang. Server mengirim teks bahasa Inggris, jadi UI menampilkan terjemahan menurut bidangnya.
    fieldErrors: {
      name: "Nama wajib diisi, maksimal 120 karakter.",
      email: "Email tidak valid atau sudah dipakai akun lain.",
      password: "Kata sandi minimal 10 karakter.",
      role: "Pilih peran yang tersedia.",
      is_active: "Anda tidak dapat menonaktifkan akun Anda sendiri.",
      role_self: "Anda tidak dapat mengubah peran Anda sendiri.",
    },
  },
} as const;
