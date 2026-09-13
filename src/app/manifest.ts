import type { MetadataRoute } from "next";

// PWA manifest'i. Service worker bu dilimde YOK; yükleme (install) için
// manifest + ikonlar yeterli, offline davranışı sonraki dilimde eklenecek.
// Renkler geçicidir, marka kimliği belirlenince güncellenecek.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GençLİG",
    short_name: "GençLİG",
    description: "Gençlerin şehir ve mahalle görevlerini oyunlaştıran platform",
    lang: "tr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    theme_color: "#16A34A",
    background_color: "#FFFFFF",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
