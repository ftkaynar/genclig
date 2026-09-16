import Link from "next/link";

import { Icon } from "@/components/ui/icon";
import { getViewerUser } from "@/lib/auth/viewer";
import { getUserPoints } from "@/lib/points/queries";
import { getMyBadgeIds, listRewards } from "@/lib/rewards/queries";

/*
  Ödül FAB'ı — tüm (user) ekranlarında sağ altta yüzen altın düğme.

  Neden var: ödül havuzu uygulamanın "niye uğraşıyorum" sorusunun cevabı
  ama alt gezinmede yeri yok (beş sekme dolu, altıncı sekme 360px'te
  dokunma hedeflerini parmak genişliğinin altına indiriyordu — D22'de
  ölçülmüştü). FAB, gezinmeyi büyütmeden ödülleri her ekranda bir dokunuş
  uzağa getiriyor.

  Alınabilir ödül varsa üzerinde kırmızı nokta: kullanıcı ekranın
  neresinde olursa olsun "alabileceğin bir şey var" sinyalini görüyor.

  Sunucu bileşeni: uygunluk hesabı zaten sunucuda yapılıyor ve istemciye
  ödül listesi taşımak gereksizdi.
*/
export async function RewardFab() {
  const user = await getViewerUser();
  if (!user) {
    return null;
  }

  const [points, rewards, myBadges] = await Promise.all([
    getUserPoints(user.id),
    listRewards(),
    getMyBadgeIds(),
  ]);

  const hasReady = rewards.some(
    (reward) =>
      points.level >= reward.min_level &&
      (!reward.required_badge_id || myBadges.has(reward.required_badge_id)) &&
      points.coin >= reward.coin_cost,
  );

  return (
    /*
      Konum: alt gezinmenin üstünde ve güvenli alanın dışında. Gezinme
      fixed olduğu için FAB de fixed; ikisi aynı hesaba yaslanıyor
      (.above-bottom-nav 85px + safe-area).
    */
    <Link
      href="/oduller"
      aria-label={
        hasReady ? "Ödüller — alabileceğin ödül var" : "Ödüller"
      }
      className="reward-fab above-bottom-nav fixed right-4 z-40"
    >
      <Icon name="gift" className="h-6 w-6" />

      {hasReady ? (
        <span
          aria-hidden
          className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-[#1a1200] bg-status-danger"
        />
      ) : null}
    </Link>
  );
}
