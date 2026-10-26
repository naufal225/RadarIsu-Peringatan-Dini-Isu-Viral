// F11 labels: Replay mode page (PRD §10.10, §12.2). Re-exported through lib/labels.ts as `ui.replay`.

export const replayStatusLabels = {
  idle: "Belum dijalankan",
  running: "Berjalan",
  finished: "Selesai",
  stopped: "Dihentikan",
} as const;

/** API error codes of the replay endpoints (see describeErrorCode in lib/labels.ts). */
export const replayErrorCodes = {
  invalid_rows: "Ada baris yang tidak valid",
  no_rows: "File tidak berisi baris data",
  no_incident_rows: "Skenario harus punya minimal satu baris fase incident",
  baseline_after_incident: "Baris baseline harus berakhir sebelum baris incident pertama",
  invalid_offset_seconds: "offset_seconds harus bilangan bulat 0 sampai 2.592.000",
  invalid_phase: "phase harus baseline atau incident",
  invalid_label_manual: "label_manual harus organic atau anomalous",
  invalid_account_age_days: "account_age_days harus bilangan bulat 0 sampai 36.500",
  already_running: "Skenario ini sedang berjalan",
  another_running: "Skenario lain sedang berjalan; hentikan dulu",
  empty_scenario: "Skenario tidak punya baris",
  not_running: "Skenario tidak sedang berjalan",
} as const;

export const replayUi = {
  title: "Mode Replay",
  intro:
    "Memutar ulang skenario melalui jalur data yang sama dengan sumber langsung: baris baseline masuk sekaligus, baris incident dialirkan sesuai kecepatan. Semua data ditandai simulasi.",
  workers:
    "Replay berjalan sebagai job di antrean replay. Jalankan pekerja khusus: php artisan queue:work --queue=replay (di samping pekerja antrean utama).",
  clockActive: (virtual: string) => `Jam data virtual: ${virtual}`,
  clockIdle: "Detektor memakai jam sebenarnya (tidak ada Replay berjalan).",
  scenarios: "Skenario",
  empty: "Belum ada skenario. Unggah CSV skenario di bawah.",
  columns: {
    name: "Skenario",
    rows: "Baris",
    status: "Status",
    progress: "Progres",
    speed: "Kecepatan",
    times: "Waktu",
    actions: "Aksi",
  },
  rowsCount: (total: number, incident: string) => `${total} baris · incident dimulai pada detik ke-${incident}`,
  progress: (done: number, total: number) => `${done} / ${total} baris`,
  speedValue: (factor: number) => `${factor}×`,
  anchor: (when: string) => `Jangkar virtual: ${when}`,
  started: (when: string) => `Mulai: ${when}`,
  finished: (when: string) => `Berhenti: ${when}`,
  runNumber: (n: number) => `Putaran ke-${n}`,
  error: "Galat",
  speedLabel: "Kecepatan (×)",
  speedHint: "Detik skenario per detik nyata. 60 berarti satu jam skenario dalam satu menit.",
  start: "Mulai",
  starting: "Memulai…",
  stop: "Hentikan",
  stopping: "Menghentikan…",
  stopConfirm: "Hentikan Replay yang sedang berjalan?",
  started_ok: "Replay dimulai.",
  stopped_ok: "Replay dihentikan.",
  upload: {
    title: "Unggah skenario",
    file: "File CSV skenario",
    name: "Nama skenario",
    description: "Deskripsi (opsional)",
    incidentStart: "Awal incident, detik (opsional)",
    defaultSpeed: "Kecepatan bawaan (×)",
    submit: "Unggah skenario",
    submitting: "Mengunggah…",
    done: (name: string) => `Skenario "${name}" tersimpan.`,
    rowsTruncated: "Hanya 50 baris bermasalah pertama yang ditampilkan.",
    row: "Baris",
    problem: "Masalah",
    format:
      "Header wajib: offset_seconds, phase (baseline atau incident), text, account_handle. Opsional: account_display_name, account_age_days (umur akun saat posting), label_manual (organic atau anomalous). Baris baseline harus berakhir sebelum incident dimulai. Maks. 10 MB / 50.000 baris.",
  },
} as const;
