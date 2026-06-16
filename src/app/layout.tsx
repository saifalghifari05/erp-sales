import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ERP Sales & Fitter Tarda",
  description: "Sistem internal Tarda Tailor",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
