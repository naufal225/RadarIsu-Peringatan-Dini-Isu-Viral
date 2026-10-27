import { notFound } from "next/navigation";
import { TopicsPreview } from "./topics-preview";

// Hanya untuk pengembangan: tidak ada di build produksi dan tidak masuk menu.
export default function TopicsPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return <TopicsPreview />;
}
