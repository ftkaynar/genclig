import type { RewardRow } from "@/lib/rewards/queries";

/*
  Ödül FAB'ının işaret mantığı (D35 FAZ F).

  NEDEN AYRI DOSYA: hesap bileşenin içindeydi ve `Date.now()` çağırıyordu;
  eslint `react-hooks/purity` bunu render sırasında saf olmayan çağrı
  olarak reddetti (haklı: aynı render iki kez koşsa iki farklı sonuç
  verebilir). Zaman okuması bileşen dosyasının dışına taşındı; bileşen
  artık yalnızca sonucu alıyor.
*/

/*
  "Yeni" penceresi: 7 gün.

  Kampanyalar hafta hafta yayınlanıyor. Daha kısa bir pencere (24 saat)
  rozetin hiç görülmemesine yol açıyordu, daha uzunu (30 gün) rozeti
  kalıcı hale getirip anlamını yok ediyordu.
*/
const NEW_DAYS = 7;

export type FabSignal = {
  /** Şu anda alınabilecek en az bir ödül var. */
  hasReady: boolean;
  /** Alınabilir ödüllerden en az biri son 7 günde eklendi. */
  hasNew: boolean;
};

export function rewardFabSignal(
  rewards: RewardRow[],
  viewer: { level: number; coin: number },
  myBadges: Set<string>,
): FabSignal {
  /** Kullanıcı ŞU ANDA alabilir mi: seviye + rozet + coin. */
  const affordable = rewards.filter(
    (reward) =>
      viewer.level >= reward.min_level &&
      (!reward.required_badge_id || myBadges.has(reward.required_badge_id)) &&
      viewer.coin >= reward.coin_cost,
  );

  const since = Date.now() - NEW_DAYS * 24 * 60 * 60 * 1000;

  /*
    "YENİ" rozeti yalnızca ALINABİLİR ve yeni bir ödül varsa.

    Yeni ama parası yetmeyen bir ödül için "YENİ" göstermek denendi ve
    elendi: kullanıcı düğmeye basıyor, hiçbir şey alamıyor ve rozet
    yalancı çıkıyor. Rozetin sözü "şimdi alabileceğin yeni bir şey var".
  */
  const hasNew = affordable.some((reward) => {
    if (!reward.created_at) return false;
    const at = Date.parse(reward.created_at);
    return Number.isFinite(at) && at >= since;
  });

  return { hasReady: affordable.length > 0, hasNew };
}
