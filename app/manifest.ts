import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "JB Squeaky Cleaners",
    short_name: "JB Squeaky",
    description: "JB Squeaky Cleaners LLC — Coming Soon",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#061426",
    theme_color: "#061426",
    icons: [
      {
        src: "/branding/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/branding/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
