import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "株モン",
  title: "株モン",
  description: "株式をテーマにした育成・放置ゲーム",
  manifest: "/manifest.webmanifest",
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes"
  },
  appleWebApp: {
    capable: true,
    title: "株モン",
    statusBarStyle: "black-translucent"
  },
  icons: {
    icon: [
      { url: "/icons/kabumon-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/kabumon-icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [
      { url: "/icons/kabumon-apple-touch.png", sizes: "180x180", type: "image/png" }
    ]
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#061229"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
