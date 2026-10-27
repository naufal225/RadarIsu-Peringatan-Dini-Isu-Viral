import { notFound } from "next/navigation";
import { LabelingPreview } from "./labeling-preview";

// Hanya untuk pengembangan: tidak ada di build produksi dan tidak masuk menu.
export default function LabelingPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return <LabelingPreview />;
}
