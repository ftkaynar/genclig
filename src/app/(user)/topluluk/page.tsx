import Link from "next/link";
import { RewardFab } from "@/components/rewards/reward-fab";
import { redirect } from "next/navigation";

import { ChatView } from "@/components/community/chat-view";
import { ProvincePicker } from "@/components/community/province-picker";
import { EmptyState } from "@/components/ui/pills";
import { UserBottomNav } from "@/components/user-bottom-nav";
import { UserHud } from "@/components/user-hud";
import { getViewerProfile, getViewerUser } from "@/lib/auth/viewer";
import {
  getChannelInfo,
  getMyChannel,
  listChannelMessagesOf,
  listProvinceChannels,
} from "@/lib/community/queries";

export const metadata = {
  title: "Topluluk — GençLİG",
};

/**
 * Doğum tarihinden yaş.
 *
 * Doğum günü henüz gelmediyse bir yıl düşülüyor; basit yıl farkı
 * ocak ayında doğanları bir yaş büyük gösteriyordu.
 */
function ageFrom(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const born = new Date(birthDate);
  if (Number.isNaN(born.getTime())) return null;

  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const monthDiff = now.getMonth() - born.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < born.getDate())) {
    age -= 1;
  }
  return age;
}

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ il?: string }>;
}) {
  const user = await getViewerUser();

  if (!user) {
    redirect("/giris?next=/topluluk");
  }

  const params = await searchParams;

  const [provinces, myChannel, profile] = await Promise.all([
    listProvinceChannels(),
    getMyChannel(),
    getViewerProfile(),
  ]);

  /*
    Hangi kanal açılacak (D32 FAZ KE)?

    1. URL'deki ?il= — kullanıcı açıkça seçmiş.
    2. Kendi ili — varsayılan.
    3. Hiçbiri yoksa listenin ilki — ili ayarlı olmayan kullanıcı da
       artık topluluğu görebiliyor. ÖNCEKİ DURUM: ili yoksa boş ekran
       ve "önce ilini ayarla" duvarı; il kilidi kalktığına göre bu duvar
       da anlamsızdı.

    Geçersiz ?il= sessizce varsayılana düşüyor: hata ekranı göstermek,
    eski bir bağlantıyı açan kullanıcıyı çıkmaza sokardı.
  */
  const requestedId = Number(params.il);
  const requested = Number.isFinite(requestedId)
    ? provinces.find((item) => item.province_id === requestedId)
    : undefined;

  const selectedId =
    requested?.channel_id ?? myChannel?.channel_id ?? provinces[0]?.channel_id;

  // Hiç il kanalı yoksa (tohum verisi eksik) sohbet kurulamaz.
  if (!selectedId) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface">
        <UserHud title="Topluluk" />
        <main className="flex-1 px-4 py-4 has-bottom-nav">
          <EmptyState
            icon="users"
            title="Kanal bulunamadı"
            description="Topluluk kanalları henüz hazır değil. Kısa süre sonra tekrar dene."
            action={
              <Link
                href="/"
                className="btn-chunky bg-cta inline-block rounded-full px-5 py-2.5 text-sm font-semibold text-white"
              >
                Ana sayfaya dön
              </Link>
            }
          />
        </main>
        <RewardFab />
        <UserBottomNav active="home" />
      </div>
    );
  }

  const [channel, messages] = await Promise.all([
    getChannelInfo(selectedId),
    listChannelMessagesOf(selectedId, 100),
  ]);

  if (!channel) {
    redirect("/topluluk");
  }

  /*
    Yaş bilgisi yoksa güvenlik şeridi yine gösteriliyor.
    Neden: doğum tarihi boş olan bir hesabın yetişkin olduğunu varsaymak,
    çocuk güvenliğinde yanlış yöndeki varsayım. Fazladan uyarı zarar
    vermiyor, eksik uyarı veriyor.
  */
  const age = ageFrom(profile?.birth_date ?? null);
  const isMinor = age === null || age < 18;

  /*
    Susturma kararı için zamanla karşılaştırma gerekmiyor: `channel_info`
    RPC'si `muted_until` alanını zaten `until > now()` koşuluyla
    dolduruyor, yani dolu olması "şu an susturulmuş" demek. Bu değeri
    burada tekrar `Date.now()` ile karşılaştırmak hem gereksizdi hem de
    render'ı saf olmaktan çıkarıp lint hatası veriyordu.
  */
  const isMuted = channel.muted_until !== null;

  return (
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col bg-surface">
      <UserHud title={channel.name} />

      <div className="shrink-0 px-4 pt-3">
        <ProvincePicker
          channels={provinces}
          currentId={selectedId}
          currentName={channel.district_name}
        />
      </div>

      <ChatView
        channel={channel}
        initialMessages={messages}
        isMinor={isMinor}
        isMuted={isMuted}
      />

      <UserBottomNav active="home" />
    </div>
  );
}
