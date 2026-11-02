import type { Metadata } from "next";
import "./globals.css";
import "./layout-refinements.css";
import "./auth.css";

export const metadata: Metadata = {
  title: "Catering Desk · Your catering workspace",
  description: "A private workspace for your catering orders, customers, menu and kitchen preparation.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
