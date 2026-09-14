import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/layout/AppShell";

import { buildApiUrl } from "@/lib/utils/api";

const roboto = Roboto({
  weight: ['300', '400', '500', '600', '700', '800'],
  subsets: ["latin"],
  variable: "--font-roboto",
  display: 'swap',
});

export function generateMetadata(): Metadata {
  return {
    title: "Dashboard PSC 119 — SPGDT Kemenkes RI",
    description: "Sistem Pemantauan Terpadu Layanan Kedaruratan Medis & Panggilan Gawat Darurat 119 Kementerian Kesehatan RI.",
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className={`${roboto.variable} font-roboto antialiased`}>
        <AppShell>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
