import type { Metadata } from "next";
// Font di-bundle lewat paket (tanpa CDN saat runtime; Design System §2 #13).
import "@fontsource-variable/inter";
import "@fontsource-variable/source-serif-4";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "RadarIsu",
  description: "Sistem peringatan dini isu, koordinasi akun, dan peniruan identitas",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
