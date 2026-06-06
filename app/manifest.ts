import type { MetadataRoute } from "next";
import { withBasePath } from "@/lib/paths";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "株モン",
    short_name: "株モン",
    description: "株式をテーマにした育成・放置ゲーム",
    start_url: withBasePath("/"),
    scope: withBasePath("/"),
    display: "standalone",
    orientation: "portrait",
    background_color: "#061126",
    theme_color: "#061229",
    icons: [
      {
        src: withBasePath("/icons/kabumon-icon-192.png"),
        sizes: "192x192",
        type: "image/png"
      },
      {
        src: withBasePath("/icons/kabumon-icon-512.png"),
        sizes: "512x512",
        type: "image/png"
      }
    ]
  };
}
