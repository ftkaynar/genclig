import Link from "next/link";
import { redirect } from "next/navigation";

import { ChatView } from "@/components/community/chat-view";
import { EmptyState } from "@/components/ui/pills";
import { UserBottomNav } from "@/components/user-bottom-nav";
import { UserHud } from "@/components/user-hud";
import { getViewerProfile, getViewerUser } from "@/lib/auth/viewer";
import { getMyChannel, listChannelMessages } from "@/lib/community/queries";

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

export default async function CommunityPage() {
  const user = await getViewerUser();

  if (!user) {
    redirect("/giris?next=/topluluk");
  }

  const [channel, profile] = await Promise.all([
    getMyChannel(),
    getViewerProfile(),
  ]);

  // İlçesi olmayan kullanıcı hangi kanala gireceğini bilemiyor.
  if (!channel) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface">
        <UserHud title="Topluluk" />
        <main className="flex-1 px-4 py-4">
          <EmptyState
            icon="users"
            title="Önce ilçeni ayarla"
            description="Topluluk sohbeti ilçene göre açılıyor. Ayarlardan ilçeni seçtiğinde kanalın hazır olacak."
            action={
              <Link
                href="/ayarlar"
                className="btn-chunky bg-cta inline-block rounded-full px-5 py-2.5 text-sm font-semibold text-white"
              >
                Konumunu ayarla
              </Link>
            }
          />
        </main>
        <UserBottomNav active="home" />
      </div>
    );
  }

  const messages = await listChannelMessages(100);

  /*
    Yaş bilgisi yoksa güvenlik şeridi yine gösteriliyor.
    Neden: doğum tarihi boş olan bir hesabın yetişkin olduğunu varsaymak,
    çocuk güvenliğinde yanlış yöndeki varsayım. Fazladan uyarı zarar
    vermiyor, eksik uyarı veriyor.
  */
  const age = ageFrom(profile?.birth_date ?? null);
  const isMinor = age === null || age < 18;

  /*
    Susturma kararı için zamanla karşılaştırma gerekmiyor: `my_channel`
    RPC'si `muted_until` alanını zaten `until > now()` koşuluyla
    dolduruyor, yani dolu olması "şu an susturulmuş" demek. Bu değeri
    burada tekrar `Date.now()` ile karşılaştırmak hem gereksizdi hem de
    render'ı saf olmaktan çıkarıp lint hatası veriyordu.
  */
  const isMuted = channel.muted_until !== null;

  return (
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col bg-surface">
      <UserHud title={channel.name} />

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
