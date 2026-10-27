import { notFound } from "next/navigation";
import { SourcesPreview } from "./sources-preview";

// Hanya untuk pengembangan: tidak ada di build produksi dan tidak masuk menu.
export default function SourcesPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return <SourcesPreview />;
}
