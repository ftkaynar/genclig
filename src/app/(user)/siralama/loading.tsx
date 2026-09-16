import { SkeletonBlock, SkeletonChips, SkeletonList } from "@/components/ui/skeleton";
import { UserBottomNav } from "@/components/user-bottom-nav";
import { UserHudSkeleton } from "@/components/user-hud";

/*
  Yükleme iskeleti.

  Sunucu bileşeni veriyi beklerken sayfanın şekli görünüyor. Üst bar ve alt
  gezinme gerçek bileşenler: yükleme sırasında yerlerinden oynamasınlar,
  yoksa veri gelince sayfa zıplıyordu.

  Filtre bloğu da üç katmanın (mod anahtarı, alan çipleri, dönem segmenti)
  yüksekliğini taklit ediyor; aynı sebep — iskelette tek çip satırı varken
  veri gelince liste aşağı zıplıyordu.
*/
export default function Loading() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface">
      <UserHudSkeleton title="Sıralama" />

      <div className="border-b border-edge px-4 pb-3.5 pt-3">
        <SkeletonBlock className="h-10 w-full rounded-full" />
        <div className="mt-3">
          <SkeletonChips count={4} />
        </div>
        <SkeletonBlock className="mt-3 h-9 w-full rounded-full" />
      </div>

      <main className="flex-1 px-4 pb-8 pt-4 has-bottom-nav">
        <SkeletonList count={6} />
      </main>


      <UserBottomNav active="ranking" />
    </div>
  );
}
