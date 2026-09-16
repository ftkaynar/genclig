"use client";

import { useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

/*
  Zincir tamamlama kutlaması (D33 FAZ Z).

  Bir kez gösteriliyor: zincir kimliği localStorage'a yazılıyor ve
  ikinci ziyarette pop-up çıkmıyor. Her açılışta patlayan konfeti
  birkaç günde sıradanlaşıyor ve kutlama değerini yitiriyor — aynı
  karar D30'da giriş kutlamasında da verilmişti.

  CİHAZ BAZLI: "bu kullanıcı bunu gördü mü" bilgisi cihaza ait, çünkü
  aynı hesap telefonda ve masaüstünde ayrı açılıyor ve kutlamayı
  ikisinde de görmek doğru. Sunucuda tutmak ikinci cihazda hiç
  göstermemek demekti.

  Bonusun kendisi ZATEN yazılmış durumda (check_chain_completion);
  bu bileşen yalnız haberi veriyor. Kutlamayı görmemek ödülü
  kaybettirmiyor.
*/

const KEY = "genclig-seen-chains";

function readSeen(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    // Gizli sekme / site verisi engelli: kutlama atlanıyor, akış sürüyor.
    return [];
  }
}

function writeSeen(list: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Yazılamazsa da uygulama çalışmaya devam ediyor.
  }
}

/*
  Bileşen ÖRNEĞİNE ait küçük depo.

  Denenen ve elenen iki alternatif (D32 FAZ D2'de ölçüldü):
    - useRef ile render sırasında okumak: `react-hooks/refs` kuralı
      render sırasında ref okumayı hiç kabul etmiyor.
    - useState(() => readSeen()): sunucu boş, istemci dolu döner ve
      hydration uyuşmazlığı çıkarır.

  useSyncExternalStore sunucu anlık görüntüsünü ayrı alıyor.
*/
function createSeenStore() {
  let snapshot: string[] | undefined;
  return {
    subscribe: () => () => {},
    get: (): string[] => {
      if (snapshot === undefined) snapshot = readSeen();
      return snapshot;
    },
  };
}

const EMPTY: string[] = [];

export function ChainCelebration({
  chainId,
  title,
  bonusXp,
  bonusToken,
}: {
  chainId: string;
  title: string;
  bonusXp: number;
  bonusToken: number;
}) {
  const [store] = useState(createSeenStore);
  const seen = useSyncExternalStore(store.subscribe, store.get, () => EMPTY);

  const [dismissed, setDismissed] = useState(false);

  // Sunucuda ve daha önce görülmüşse hiç çizilmiyor.
  if (dismissed || seen.includes(chainId)) return null;

  function close() {
    writeSeen([...readSeen(), chainId]);
    setDismissed(true);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Zincir tamamlandı"
      className="fixed inset-0 z-50 flex items-center justify-center bg-brand/85 px-6 backdrop-blur-sm"
    >
      {/* relative ŞART: konfeti mutlak konumlu ve kartı referans alıyor. */}
      <div className="anim-pop relative w-full max-w-sm overflow-hidden rounded-3xl border border-edge bg-card p-6 text-center">
        {/* Konfeti: saf CSS, kütüphane yok (D30 kararı). */}
        <span aria-hidden className="pointer-events-none absolute inset-0">
          {Array.from({ length: 14 }, (_, i) => (
            <span
              key={i}
              className="confetti-bit"
              style={
                {
                  "--dx": `${(i - 7) * 18}px`,
                  "--dy": `${120 + (i % 5) * 26}px`,
                  "--rot": `${180 + i * 37}deg`,
                  left: `${8 + i * 6.4}%`,
                } as React.CSSProperties
              }
            />
          ))}
        </span>

        <span className="anim-glow mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-status-success text-white">
          <Icon name="check" className="h-9 w-9" strokeWidth={2.8} />
        </span>

        <p className="mt-4 text-xs font-bold uppercase tracking-wider text-status-success">
          Zincir tamamlandı
        </p>
        <p className="mt-1 text-lg font-bold text-ink">{title}</p>

        <div className="mt-4 flex items-center justify-center gap-2">
          <span className="reward-pill inline-flex items-center gap-1 rounded-full bg-xp px-3 py-1 text-sm font-extrabold text-[#06283a]">
            <Icon name="zap" className="h-4 w-4" />+{bonusXp}
          </span>
          <span className="reward-pill inline-flex items-center gap-1 rounded-full bg-coin px-3 py-1 text-sm font-extrabold text-[#3a2a00]">
            <Icon name="coins" className="h-4 w-4" />+{bonusToken}
          </span>
        </div>

        <div className="mt-6">
          <Button variant="primary" size="md" block type="button" onClick={close}>
            Harika!
          </Button>
        </div>
      </div>
    </div>
  );
}
