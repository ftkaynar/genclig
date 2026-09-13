import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GençLİG",
  description: "Gençlerin şehir ve mahalle görevlerini oyunlaştıran platform",
  applicationName: "GençLİG",
  appleWebApp: {
    capable: true,
    title: "GençLİG",
    statusBarStyle: "default",
  },
};

// Mobile-first PWA: viewport meta'sı Next'in viewport export'u ile veriliyor.
// maximumScale sınırlanmadı; erişilebilirlik için kullanıcı zoom'u engellenmiyor.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#16A34A",
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
    <html lang="tr">
      <body className="min-h-dvh bg-white text-neutral-900 antialiased">
        {children}
      </body>
    </html>
  );
}
