"use client";

import { useState } from "react";

import { Icon } from "@/components/ui/icon";
import type { MyInvite } from "@/lib/referrals/queries";

/*
  Davet kartı (D33 FAZ DV).

  Kod BÜYÜK ve seçilebilir: kullanıcı en sık yaptığı şey kodu okuyup
  arkadaşına söylemek. Küçük punto bir kod, telefonda okunmuyordu.

  Ödül metni AYARLARDAN geliyor, koda gömülü değil: yönetici miktarı
  değiştirince kart da değişmeli. Sabit "+100 Token" yazısı, ayar 50'ye
  indiğinde yalan söylüyordu.

  Kopyalama geri bildirimi 2 saniye: daha kısası fark edilmiyor, daha
  uzunu "kopyalandı" yazısını kalıcı sanmaya yol açıyordu.
*/
export function InviteCard({
  invite,
  link,
}: {
  invite: MyInvite;
  link: string;
}) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  async function copy(value: string, what: "code" | "link") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      // Pano izni yoksa metin zaten ekranda ve elle seçilebiliyor.
    }
  }

  async function share() {
    // Web Share API varsa yerel paylaşım sayfası; yoksa panoya kopyala.
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({
          title: "GençLİG",
          text: `GençLİG'e katıl, ikimiz de kazanalım. Davet kodum: ${invite.invite_code}`,
          url: link,
        });
        return;
      } catch {
        // Kullanıcı vazgeçti ya da API engelli: kopyalamaya düşülüyor.
      }
    }
    await copy(link, "link");
  }

  return (
    <section className="mb-4 rounded-3xl border border-cyan/40 bg-gradient-to-br from-cyan/10 to-primary/10 p-4">
      <p className="flex items-center gap-1.5 text-sm font-bold text-ink">
        <Icon name="users" className="h-4 w-4 text-cyan" />
        Arkadaşını davet et
      </p>

      <p className="mt-1 text-xs text-ink-muted">
        Arkadaşın ilk görevini tamamladığında{" "}
        <strong className="text-ink">ikiniz de kazanırsınız</strong>: sana +
        {invite.inviter_xp} XP ve +{invite.inviter_token} Token, ona +
        {invite.invited_xp} XP ve +{invite.invited_token} Token.
      </p>

      {/* Kod: büyük, harf aralıklı, seçilebilir. */}
      <div className="mt-3 flex items-center gap-2">
        <span className="flex-1 select-all rounded-2xl border border-edge bg-card px-3 py-2.5 text-center font-mono text-xl font-extrabold tracking-[0.2em] text-ink">
          {invite.invite_code}
        </span>
        <button
          type="button"
          onClick={() => copy(invite.invite_code ?? "", "code")}
          aria-label="Kodu kopyala"
          className="press-soft flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-2xl border border-edge bg-card text-cyan"
        >
          <Icon name={copied === "code" ? "check" : "copy"} className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={share}
          className="btn-surface btn-cyan press-soft inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-[14px] px-4 text-[13px] font-bold text-[#06283a]"
        >
          <Icon name="megaphone" className="h-4 w-4" />
          {copied === "link" ? "Bağlantı kopyalandı" : "Davet bağlantısını paylaş"}
        </button>
      </div>

      {/* Sayaç: emeğin karşılığı görünsün. */}
      {invite.invited_count > 0 ? (
        <p className="mt-2.5 text-[11px] font-semibold text-ink-muted">
          {invite.invited_count} kişi kodunla katıldı ·{" "}
          <span className="text-status-success">
            {invite.rewarded_count} ödül kazandırdı
          </span>
        </p>
      ) : null}

      {!invite.active ? (
        <p className="mt-2.5 rounded-xl bg-status-warning/10 px-3 py-1.5 text-[11px] font-medium text-status-warning">
          Davet ödülleri şu an kapalı. Kodun çalışmaya devam ediyor.
        </p>
      ) : null}
    </section>
  );
}
