import type { Metadata, Viewport } from "next";
import { AppProvider } from "@/components/provider";
import { Shell } from "@/components/shell";
import "./globals.css";
export const metadata: Metadata = { title: { default: "BrahmaShield · Disaster Situation Room", template: "%s · BrahmaShield" }, description: "Community disaster reporting and coordinated response for Northeast India. Prototype with clearly labelled demo data.", applicationName: "BrahmaShield", manifest: "/manifest.webmanifest", icons: { icon: "/icon.svg", apple: "/icon.svg" } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0b111b" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><AppProvider><Shell>{children}</Shell></AppProvider></body></html>;
}
