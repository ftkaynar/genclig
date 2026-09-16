"use client";

import { useRef, useState } from "react";

import { Icon } from "@/components/ui/icon";

/*
  Yatay kaydırma şeridi — ok düğmeli, kaydırma çubuğu gizli.

  ÖNCEKİ SORUN: şeritlerin altında tarayıcının kendi kaydırma çubuğu
  duruyordu. Masaüstünde çirkin bir gri bar, mobilde ise hiç görünmüyor
  ve şeridin kaydırılabildiği belli olmuyordu — kullanıcı sağdaki
  kartların varlığını bilmiyordu.

  Çözüm iki parça:
    1. Çubuk gizli (.scrollbar-none)
    2. Taşma varsa kenarlarda ok düğmesi + solma maskesi

  Oklar TAŞMA VARSA görünüyor. Her zaman görünseydi tek kartlık bir
  şeritte bile ok çıkar ve "burada daha çok şey var" diye yalan söylerdi.

  Durum scroll olayından okunuyor, ResizeObserver'dan değil: şeridin
  içeriği sunucudan geliyor ve render sonrası değişmiyor; ilk ölçüm
  `onScroll`in ilk tetiklenmesine kadar varsayılan (sağ ok görünür)
  kalıyor, bu da doğru tarafta hata yapmak demek.
*/
export function HScroll({
  children,
  className = "",
  ariaLabel,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
  /*
    Kaydırma kabı `ul` olabiliyor: içine <li> koyan şeritlerde (görev
    kutucukları) kabın div olması geçersiz HTML üretiyor ve ekran
    okuyucu listeyi liste olarak duyurmuyordu.
  */
  as?: "div" | "ul";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  function measure(el: HTMLDivElement) {
    const overflow = el.scrollWidth - el.clientWidth;
    setAtStart(el.scrollLeft <= 4);
    // 4px tolerans: alt piksel kaydırmada "sonda" durumu hiç oluşmuyordu.
    setAtEnd(overflow <= 4 || el.scrollLeft >= overflow - 4);
  }

  function nudge(direction: -1 | 1) {
    const el = ref.current;
    if (!el) return;
    // Bir ekran değil, %80: kullanıcı nerede kaldığını kaybetmesin.
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: "smooth" });
  }

  const showLeft = !atStart;
  const showRight = !atEnd;
  const Container = as;

  return (
    <div className={`relative ${className}`}>
      <Container
        ref={ref as React.Ref<HTMLDivElement & HTMLUListElement>}
        onScroll={(e: React.UIEvent<HTMLElement>) =>
          measure(e.currentTarget as HTMLDivElement)
        }
        aria-label={ariaLabel}
        className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-4 pb-1"
      >
        {children}
      </Container>

      {/* Kenar solması: kesilen kart "bitti" değil "devam ediyor" desin. */}
      {showLeft ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-surface to-transparent"
        />
      ) : null}
      {showRight ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-surface to-transparent"
        />
      ) : null}

      {showLeft ? (
        <button
          type="button"
          onClick={() => nudge(-1)}
          aria-label="Geri kaydır"
          className="absolute left-0 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-edge bg-card text-ink shadow-md transition-transform active:scale-90"
        >
          <Icon name="chevron-right" className="h-4 w-4 rotate-180" />
        </button>
      ) : null}

      {showRight ? (
        <button
          type="button"
          onClick={() => nudge(1)}
          aria-label="İleri kaydır"
          className="absolute right-0 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-edge bg-card text-ink shadow-md transition-transform active:scale-90"
        >
          <Icon name="chevron-right" className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
