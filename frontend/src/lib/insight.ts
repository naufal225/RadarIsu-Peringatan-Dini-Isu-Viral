// Insight dari data yang sudah dikirim endpoint (PRD §6.1). Murni: tanpa fetch, tanpa teks UI.

export type EvidenceRow = {
  reason: string;
  account: { id: number } | null;
};

/** Komposisi bukti satu alert: jumlah per alasan, dan akun unik per kategori. */
export type EvidenceComposition = {
  total: number;
  byReason: Record<string, number>;
  accounts: number;
  youngAccounts: number;
  synchronizedAccounts: number;
};

export function evidenceComposition(evidence: EvidenceRow[]): EvidenceComposition {
  const byReason: Record<string, number> = {};
  const all = new Set<number>();
  const young = new Set<number>();
  const synced = new Set<number>();

  for (const row of evidence) {
    byReason[row.reason] = (byReason[row.reason] ?? 0) + 1;
    if (row.account) {
      all.add(row.account.id);
      if (row.reason === "young_account") young.add(row.account.id);
      if (row.reason === "synchronized_posting") synced.add(row.account.id);
    }
  }

  return {
    total: evidence.length,
    byReason,
    accounts: all.size,
    youngAccounts: young.size,
    synchronizedAccounts: synced.size,
  };
}

export type SentimentMix = {
  positive: number;
  negative: number;
  neutral: number;
  total: number;
  /** Bagian 0–1 dari total; nol bila tidak ada posting. */
  share: { positive: number; negative: number; neutral: number };
  /** True bila semua posting netral: sinyal sentimen tidak bervariasi, perlu dicatat sebagai batasan. */
  onlyNeutral: boolean;
};

/** Komposisi sentimen dari baris metrik per jam (positive_count, negative_count, neutral_count). */
export function sentimentMix(rows: { positive_count: number; negative_count: number; neutral_count: number }[]): SentimentMix {
  let positive = 0;
  let negative = 0;
  let neutral = 0;
  for (const row of rows) {
    positive += row.positive_count;
    negative += row.negative_count;
    neutral += row.neutral_count;
  }
  const total = positive + negative + neutral;
  const share = (n: number) => (total === 0 ? 0 : n / total);
  return {
    positive,
    negative,
    neutral,
    total,
    share: { positive: share(positive), negative: share(negative), neutral: share(neutral) },
    onlyNeutral: total > 0 && positive === 0 && negative === 0,
  };
}

export type RunPoint = { id: number; label: string; f1: number | null };

/** Titik tren F1 dari riwayat run (terbaru di depan), dibalik agar kronologis dari kiri ke kanan. */
export function f1Trend(runs: { id: number; created_at: string; f1: number | null }[]): RunPoint[] {
  return [...runs]
    .reverse()
    .map((run) => ({ id: run.id, label: run.created_at, f1: run.f1 }));
}
