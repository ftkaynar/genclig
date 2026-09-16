import type { Metadata, Viewport } from "next";

import { ThemeProvider } from "@/components/theme-provider";
import { themeInitScript } from "@/components/theme-script";

import "./globals.css";

export const metadata: Metadata = {
  title: "GençLİG",
  description: "Gençlerin şehir ve mahalle görevlerini oyunlaştıran platform",
  applicationName: "GençLİG",
  appleWebApp: {
    capable: true,
    title: "GençLİG",
    statusBarStyle: "black-translucent",
  },
  /*
    Favicon seti public/ altında üretiliyor (pnpm brand:icons).

    Next app/favicon.ico dosyasını kendiliğinden alıyor ama biz public/
    altında tutuyoruz: ikonların tamamı tek script'ten çıkıyor ve ikisi
    ayrı yerde dursaydı biri güncellenip diğeri geride kalabilirdi. Bu
    yüzden bağlantılar burada açıkça yazılı.
  */
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32 16x16" },
      { url: "/icons/icon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

// Mobile-first PWA: viewport meta'sı Next'in viewport export'u ile veriliyor.
// maximumScale sınırlanmadı; erişilebilirlik için kullanıcı zoom'u engellenmiyor.
// themeColor koyu marka zemini: PWA olarak açıldığında sistem çubuğu uygulamanın
// varsayılan yüzü olan kullanıcı PWA'sı ile aynı renkte olsun diye.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0B1220",
};

// Neden LayoutProps<"/"> kullanılmıyor: o global tip .next/types altında build
// sırasında üretiliyor, temiz bir checkout'ta "tsc --noEmit" tek başına
// koşunca bulunamıyor. Açık prop tipi check:types'ı build'dan bağımsız kılar.
// Denenen ve elenen alternatif: check:all sırasını build-önce yapmak — tip
// kontrolünün hızlı kırılma avantajını kaybettiriyordu.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // suppressHydrationWarning: aşağıdaki script data-theme'i sunucu HTML'ine
    // eklenmemiş halde yazıyor; uyarı beklenen farkı bildiriyor, hata değil.
    <html lang="tr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-dvh bg-surface text-ink antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
