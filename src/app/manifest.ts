import type { MetadataRoute } from "next";

/*
  PWA manifest'i. Service worker bu dilimde YOK; yükleme (install) için
  manifest + ikonlar yeterli, offline davranışı sonraki dilimde eklenecek.

  AÇILIŞ EKRANI AÇIK (D36 FAZ SP). `background_color` Android'in açılış
  ekranının zemini ve eskiden #0B1220 idi: logonun gradyanı sol altta
  koyu laciverte gittiği için figürün yarısı o zeminde kayboluyordu
  (ölçülen kontrast 1.17:1, açık zeminde 14.13:1). Artık uygulama içi
  "logo anı" ile aynı açık marka tabanı.

  `theme_color` KOYU KALIYOR. O, açılış ekranının değil ÇALIŞAN
  uygulamanın sistem çubuğunu boyuyor; kullanıcı yüzü koyu tema
  varsayılanıyla açılıyor. Açık yapmak denendi ve elendi: koyu bir
  uygulamanın üstünde açık bir sistem çubuğu kalıyordu.
*/
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
    theme_color: "#0B1220",
    // Açılış ekranı zemini: uygulama içi logo anıyla aynı açık marka tabanı.
    background_color: "#EEF1F8",
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
