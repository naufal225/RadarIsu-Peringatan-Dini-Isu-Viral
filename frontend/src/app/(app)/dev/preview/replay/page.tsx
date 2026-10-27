import { notFound } from "next/navigation";
import { ReplayPreview } from "./replay-preview";

// Hanya untuk pengembangan: tidak ada di build produksi dan tidak masuk menu.
export default function ReplayPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return <ReplayPreview />;
}
