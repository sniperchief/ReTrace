import type { MetadataRoute } from "next";
import { getMessages } from "@/i18n";

/** Lets technicians install ReTrace on their phone's home screen. */
export default function manifest(): MetadataRoute.Manifest {
  const t = getMessages();
  return {
    name: t.app.name,
    short_name: t.app.name,
    description: t.app.tagline,
    start_url: "/home",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fafafa",
    theme_color: "#151035",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
