import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { adClientId, adMode, adScriptSrc } from "@/lib/adConfig";
import { withBasePath } from "@/lib/paths";
import "./globals.css";
import "./home-polish.css";
import "./tab-polish.css";

export const metadata: Metadata = {
  applicationName: "株モン",
  title: "株モン",
  description: "株式をテーマにした育成・放置ゲーム",
  manifest: withBasePath("/manifest.webmanifest"),
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
      { url: withBasePath("/icons/kabumon-icon-192.png"), sizes: "192x192", type: "image/png" },
      { url: withBasePath("/icons/kabumon-icon-512.png"), sizes: "512x512", type: "image/png" }
    ],
    apple: [
      { url: withBasePath("/icons/kabumon-apple-touch.png"), sizes: "180x180", type: "image/png" }
    ]
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#061229"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>
        {adMode === "production" && adClientId && adScriptSrc && (
          <Script
            id="kabumon-adsense"
            async
            src={adScriptSrc}
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />
        )}
        {children}
      </body>
    </html>
  );
}
