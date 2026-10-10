import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { AppProvider } from "@/components/provider";
import { Shell } from "@/components/shell";
import { LanguageProvider } from "@/components/language";
import "./globals.css";
const inter = Inter({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});
export const metadata: Metadata = {
  title: { default: "BrahmaShield · Disaster Situation Room", template: "%s · BrahmaShield" },
  description:
    "Community disaster reporting and coordinated response for Northeast India. Prototype with clearly labelled demo data.",
  applicationName: "BrahmaShield",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#172B36" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`}>
      <body>
        <LanguageProvider>
          <AppProvider>
            <Shell>{children}</Shell>
          </AppProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
