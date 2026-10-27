import { notFound } from "next/navigation";
import { AuditPreview } from "./audit-preview";

// Hanya untuk pengembangan: tidak ada di build produksi dan tidak masuk menu.
export default function AuditPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return <AuditPreview />;
}
