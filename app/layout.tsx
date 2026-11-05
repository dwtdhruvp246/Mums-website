import type { Metadata, Viewport } from "next";
import PwaInstall from "./pwa-install";
import "./globals.css";
import "./layout-refinements.css";
import "./auth.css";
import "./menu-import.css";
import "./pwa.css";

export const metadata: Metadata = {
  title: "Catering Desk · Your catering workspace",
  description: "A private workspace for your catering orders, customers, menu and kitchen preparation.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/pwa/apple-touch-icon.png",
  },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#c74728" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased"><PwaInstall installPageUrl="https://dwtdhruvp246.github.io/Mums-website/" />{children}</body>
    </html>
  );
}
