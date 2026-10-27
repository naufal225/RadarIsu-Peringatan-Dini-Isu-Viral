import { notFound } from "next/navigation";
import { StyleguideView } from "./styleguide-view";

// Hanya untuk pengembangan: tidak ada di build produksi dan tidak masuk menu.
export default function StyleguidePage() {
  if (process.env.NODE_ENV === "production") notFound();

  return <StyleguideView />;
}
