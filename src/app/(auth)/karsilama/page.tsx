import { WelcomeScreen } from "@/components/auth/welcome-screen";

export const metadata = {
  title: "GençLİG — Şehrini değiştir, kartını parlat",
};

/*
  Oturumsuz karşılama ekranı (D35 FAZ A).

  Bu rota doğrudan gezilmiyor: middleware, oturumu olmayan bir ziyaretçi
  `/` istediğinde buraya REWRITE ediyor (yönlendirme değil — adres
  çubuğunda `/` kalıyor).

  Neden ayrı bir rota: `(user)/loading.tsx` route group KÖKÜNDE duruyor
  ve altındaki her segmentin yükleme yedeği. Yani oturumsuz ziyaretçi
  `/` isteyince önce alt gezinmeli, HUD'lu tam uygulama iskeleti
  çiziliyordu (ölçüldü: HTML'de "Ana gezinme" iki kez). Karşılama
  ekranını `(auth)` grubuna taşımak o iskeletten tamamen kurtarıyor.

  Denenen ve elenen alternatif: `(user)/loading.tsx`'i nötrleştirmek.
  Bu, GİRİŞLİ ana sayfanın yükleme kararlılığını bozuyordu — iskeletteki
  gezinme oradaki zıplamayı önlemek için var.
*/
export default function WelcomePage() {
  return <WelcomeScreen />;
}
