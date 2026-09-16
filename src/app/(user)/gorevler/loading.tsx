import { SkeletonBlock, SkeletonChips } from "@/components/ui/skeleton";
import { UserBottomNav } from "@/components/user-bottom-nav";
import { UserHudSkeleton } from "@/components/user-hud";

/*
  Yükleme iskeleti.

  ÖLÇÜLEN SORUN (D32 FAZ D1): /gorevler web'de açılınca içerik "birden
  büyüyordu". Kök sebep animasyon DEĞİLDİ — genclig-rise yalnız opacity
  ve translateY oynatıyor, düzen kaydırmıyor.

  Sebep KAPSAYICI GENİŞLİĞİ uyuşmazlığıydı:

    iskelet: max-w-md                              (448px)
    sayfa:   max-w-md sm:max-w-3xl lg:max-w-5xl    (448 / 768 / 1024px)

  Mobilde ikisi aynı, bu yüzden sorun yalnız GENİŞ EKRANDA görünüyordu —
  kullanıcının "web'de" demesi tam olarak bunu işaret ediyor. Veri gelince
  kap 448'den 1024'e atlıyor ve tüm içerik yana açılıyordu.

  Ayrıca iskelet dikey bir LİSTE çiziyordu, sayfa ise 2-4 sütunlu kare
  kutucuk ızgarası: şekil de yükseklik de tutmuyordu.

  Bu dosya artık sayfanın kapsayıcısını ve ızgarasını birebir taklit
  ediyor. Diğer sekiz (user) sayfasında kap genişlikleri zaten
  uyuşuyordu (ölçüldü); uyuşmayan tek sayfa buydu.
*/
export default function Loading() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface sm:max-w-3xl lg:max-w-5xl">
      <UserHudSkeleton title="Görevler" />

      <main className="has-bottom-nav flex-1 px-4 py-4">
        <SkeletonBlock className="h-11 w-full rounded-full" />
        <div className="mt-3">
          <SkeletonChips count={3} />
        </div>

        {/* Sayfadaki ızgaranın aynısı: 2 / 3 / 4 sütun, 3:4 kutucuk. */}
        <ul className="mt-4 grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <li key={i}>
              <SkeletonBlock
                className="w-full rounded-2xl"
                style={{ aspectRatio: "3 / 4" }}
              />
            </li>
          ))}
        </ul>
      </main>


      <UserBottomNav active="tasks" />
    </div>
  );
}
