import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rizz: witty chat replies",
    short_name: "Rizz",
    description: "Drop a chat, pick a vibe, get 4 replies you can send.",
    start_url: "/",
    display: "standalone",
    background_color: "#14101f",
    theme_color: "#14101f",
    orientation: "portrait",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
