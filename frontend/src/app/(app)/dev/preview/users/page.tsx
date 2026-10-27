import { notFound } from "next/navigation";
import { UsersPreview } from "./users-preview";

// Hanya untuk pengembangan: tidak ada di build produksi dan tidak masuk menu.
export default function UsersPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return <UsersPreview />;
}
