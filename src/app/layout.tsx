import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FinApp - Controle Financeiro",
  description: "Controle financeiro pessoal: gastos, cartoes, metas e relatorios",
  applicationName: "FinApp",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "FinApp",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#0F172A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
