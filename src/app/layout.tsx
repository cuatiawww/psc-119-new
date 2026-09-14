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

export async function generateMetadata(): Promise<Metadata> {
  const backendBase = (
    process.env.SIPKK_BACKEND_BASE_URL ||
    process.env.NEXT_PUBLIC_SIPKK_BACKEND_BASE_URL ||
    'https://sipkk-new.mediaciptainformasi.co.id'
  ).replace(/\/+$/, '')

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 2000)

  try {
    const res = await fetch(`${backendBase}/api/settings`, {
      next: { revalidate: 3600 },
      signal: controller.signal
    });
    clearTimeout(timeoutId)
    const payload = await res.json();
    if (payload?.success && payload?.settings) {
      return {
        title: payload.settings.frontend_app_title || "Dashboard EOC - Kemenkes RI",
        description: payload.settings.frontend_app_subtitle || "Sistem pemantauan terpadu untuk melihat capaian, sebaran, dan perkembangan fasilitas kesehatan di seluruh wilayah Indonesia.",
      };
    }
  } catch (error) {
    clearTimeout(timeoutId)
  }

  return {
    title: "Dashboard EOC - Kemenkes RI",
    description: "Sistem pemantauan terpadu untuk melihat capaian, sebaran, dan perkembangan fasilitas kesehatan di seluruh wilayah Indonesia.",
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
