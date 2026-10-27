import { notFound } from "next/navigation";
import { SettingsPreview } from "./settings-preview";

// Hanya untuk pengembangan: tidak ada di build produksi dan tidak masuk menu.
export default function SettingsPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return <SettingsPreview />;
}
