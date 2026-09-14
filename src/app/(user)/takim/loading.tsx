import { SkeletonHero, SkeletonList } from "@/components/ui/skeleton";
import { UserBottomNav } from "@/components/user-bottom-nav";
import { UserHeader } from "@/components/user-header";

/*
  Yükleme iskeleti.

  Sunucu bileşeni veriyi beklerken sayfanın şekli görünüyor. Üst bar ve alt
  gezinme gerçek bileşenler: yükleme sırasında yerlerinden oynamasınlar,
  yoksa veri gelince sayfa zıplıyordu.
*/
export default function Loading() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface">
      <UserHeader title="Takımım" signedIn />

      <main className="flex-1 px-4 py-4">
        <SkeletonHero />
        <div className="mt-4">
          <SkeletonList count={3} />
        </div>
      </main>

      <UserBottomNav active="profile" />
    </div>
  );
}
