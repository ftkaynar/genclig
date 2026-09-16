"use client";

import { useCallback, useRef, useState } from "react";

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
  const ref = useRef<HTMLDivElement | null>(null);
  const [atStart, setAtStart] = useState(true);
  /*
    ÖLÇÜLEN SORUN (D32 FAZ H): `atEnd` başlangıçta false'tu ve ilk
    scroll olayına kadar öyle kalıyordu. Taşması olmayan bir şeritte
    scroll olayı HİÇ tetiklenmiyor, dolayısıyla sağ ok sonsuza kadar
    görünüyordu — "burada daha çok şey var" diye yalan söylüyordu.

    Başlangıç artık true (ok yok) ve gerçek ölçüm eleman DOM'a
    bağlanınca yapılıyor.
  */
  const [atEnd, setAtEnd] = useState(true);

  function measure(el: HTMLDivElement) {
    const overflow = el.scrollWidth - el.clientWidth;
    setAtStart(el.scrollLeft <= 4);
    // 4px tolerans: alt piksel kaydırmada "sonda" durumu hiç oluşmuyordu.
    setAtEnd(overflow <= 4 || el.scrollLeft >= overflow - 4);
  }

  /*
    Ölçüm geri çağırma ref'iyle: eleman DOM'a bağlandığı anda
    çalışıyor. Effect ile yapmak `react-hooks/set-state-in-effect`
    kuralına takılıyordu (aynı kurala D22, D29, D30 ve D32'de
    takıldık); geri çağırma ref'i commit aşamasında koştuğu için
    kural kapsamında değil.
  */
  const attach = useCallback((el: HTMLDivElement | null) => {
    ref.current = el;
    if (el) measure(el);
  }, []);

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
        ref={attach as React.Ref<HTMLDivElement & HTMLUListElement>}
        onScroll={(e: React.UIEvent<HTMLElement>) =>
          measure(e.currentTarget as HTMLDivElement)
        }
        aria-label={ariaLabel}
        className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-4 pb-1"
      >
        {children}
      </Container>

      {/*
        SOLMA MASKESİ YOK (D34 FAZ SH).

        Önceden iki kenarda 48px genişliğinde gradyan katman vardı
        (`from-surface via-surface/80 to-transparent`). Amaç "kesilen
        kart devam ediyor" demekti ama sonuç tersiydi: kartın kenarı
        zemine karışıyor, kart yarım ve SOLUK görünüyordu. Ana
        sayfadaki "Bugün için önerilen" şeridinde en görünür haliyle
        — son kart her zaman soluk bir hayalet gibi duruyordu.

        Kenar algısını zaten OK DÜĞMESİ taşıyor: taşma varsa ok var,
        yoksa yok (D32 FAZ H'de ölçülüp düzeltilmişti). İki sinyal
        aynı şeyi söylüyordu ve biri içeriği bozuyordu.
      */}

      {/*
        Oklar: yarı saydam koyu daire + backdrop-blur, içinde beyaz
        chevron. Önceki sürüm kart zeminiyle aynı renkte kenarlı bir
        daireydi ve şeridin üstünde yama gibi duruyordu; cam etkisi
        altındaki kartın devam ettiğini gösteriyor.

        Varsayılan opaklık .75, hover/dokunmada 1: ok her zaman
        tam parlaklıkta olsaydı içeriğin önüne geçiyordu.
      */}
      {showLeft ? (
        <button
          type="button"
          onClick={() => nudge(-1)}
          aria-label="Geri kaydır"
          className="scroll-arrow absolute left-1 top-1/2 -translate-y-1/2"
        >
          <Icon name="chevron-right" className="h-4 w-4 rotate-180" />
        </button>
      ) : null}

      {showRight ? (
        <button
          type="button"
          onClick={() => nudge(1)}
          aria-label="İleri kaydır"
          className="scroll-arrow absolute right-1 top-1/2 -translate-y-1/2"
        >
          <Icon name="chevron-right" className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
