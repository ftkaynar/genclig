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

      {/* Tek filtre kartı: sayfadaki yapının aynısı (D32 FAZ SR2). */}
      <div className="px-4 pb-3 pt-3">
        <div className="rounded-2xl border border-edge bg-card p-2">
          <SkeletonBlock className="h-[48px] w-full rounded-xl" />
          <div className="mt-2 px-2">
            <SkeletonChips count={4} />
          </div>
          <SkeletonBlock className="mt-2 h-10 w-full rounded-xl" />
        </div>
      </div>

      <main className="flex-1 px-4 pb-8 pt-4 has-bottom-nav">
        <SkeletonList count={6} />
      </main>


      <UserBottomNav active="ranking" />
    </div>
  );
}
