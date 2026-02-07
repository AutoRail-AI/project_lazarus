import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Project Lazarus",
    short_name: "Lazarus",
    description:
      "Reincarnate Legacy Software - AI-powered autonomous code migration",
    start_url: "/",
    display: "standalone",
    background_color: "#0A0A0F",
    theme_color: "#6E18B3",
    icons: [
      {
        src: "/web-app-manifest-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/web-app-manifest-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}
