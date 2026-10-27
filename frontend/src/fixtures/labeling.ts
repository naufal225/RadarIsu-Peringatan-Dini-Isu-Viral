// Fixture /labeling untuk /dev/preview/labeling dan tes. Bentuknya mengikuti respons nyata GET /labeling/posts.

import type { LabelingPost, LabelingResponse } from "@/lib/api-types/labeling";

export const LABELING_POSTS: LabelingPost[] = [
  {
    id: 301,
    text: "Waspada! Ada kabar penting soal layanan satuan kami, segera ikuti tautan resmi dan bagikan ke grup keluarga kalian, kode 1A2F",
    posted_at: "2026-10-27T07:12:00+00:00",
    sentiment: "negative",
    label_manual: null,
    is_simulated: true,
    account: { id: 41, handle: "@demo_koordinasi_7", display_name: "Akun demo_koordinasi 7" },
    topics: [{ id: 5, name: "Demo Replay: narasi terkoordinasi (simulasi)" }],
  },
  {
    id: 302,
    text: "Antrean di loket pagi tadi cukup panjang, tapi petugas ramah. <b>bukan HTML</b>",
    posted_at: "2026-10-27T06:40:00+00:00",
    sentiment: "neutral",
    label_manual: "organic",
    is_simulated: false,
    account: { id: 12, handle: "@warga_a", display_name: null },
    topics: [],
  },
  {
    id: 303,
    text: "Jadwal layanan minggu ini berubah, cek pengumuman resmi.",
    posted_at: "2026-10-27T05:05:00+00:00",
    sentiment: null,
    label_manual: "anomalous",
    is_simulated: true,
    account: null,
    topics: [{ id: 4, name: "Layanan publik satuan contoh" }],
  },
];

export const LABELING_PAGE: LabelingResponse = {
  data: LABELING_POSTS,
  meta: { current_page: 1, last_page: 4, per_page: 25, total: 87, progress: { labeled: 37, organic: 25, anomalous: 12, target: 200 } },
};

export const LABELING_DONE: LabelingResponse = {
  data: [],
  meta: { current_page: 1, last_page: 1, per_page: 25, total: 0, progress: { labeled: 202, organic: 162, anomalous: 40, target: 200 } },
};
