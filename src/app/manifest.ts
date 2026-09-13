import type { MetadataRoute } from "next";

// PWA manifest'i. Service worker bu dilimde YOK; yükleme (install) için
// manifest + ikonlar yeterli, offline davranışı sonraki dilimde eklenecek.
// Renkler marka paletinden: koyu zemin #0A1626. Kullanıcı PWA'sı koyu tema
// varsayılanıyla açıldığı için yükleme ekranı ve sistem çubuğu da koyu.
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
    theme_color: "#0A1626",
    background_color: "#0A1626",
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
