import { RewardFabButton } from "@/components/rewards/reward-fab-button";
import { getViewerUser } from "@/lib/auth/viewer";
import { getUserPoints } from "@/lib/points/queries";
import { rewardFabSignal } from "@/lib/rewards/fab";
import { getMyBadgeIds, listRewards } from "@/lib/rewards/queries";

/*
  Ödül FAB'ı — tüm (user) ekranlarında yüzen altın düğme.

  Neden var: ödül havuzu uygulamanın "niye uğraşıyorum" sorusunun cevabı
  ama alt gezinmede yeri yok (beş sekme dolu, altıncı sekme 360px'te
  dokunma hedeflerini parmak genişliğinin altına indiriyordu — D22'de
  ölçülmüştü). FAB, gezinmeyi büyütmeden ödülleri her ekranda bir dokunuş
  uzağa getiriyor.

  Bu dosya SUNUCU tarafı: uygunluk hesabı zaten sunucuda yapılıyor ve
  istemciye ödül listesi taşımak gereksizdi. Sürükleme, kenara yapışma
  ve animasyonlar istemci bileşeninde (reward-fab-button.tsx) — tarayıcı
  olayları olmadan yapılamıyor. İşaret hesabı lib/rewards/fab.ts'te
  (gerekçesi orada).
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

  const { hasReady, hasNew } = rewardFabSignal(rewards, points, myBadges);

  return <RewardFabButton hasReady={hasReady} hasNew={hasNew} />;
}
