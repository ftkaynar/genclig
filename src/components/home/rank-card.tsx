"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/ui/icon";

/*
  "Sıralaman" kartı — Türkiye / İl / İlçe üç sütun (D31 FAZ H).

  ÖNCEKİ DURUM: yalnızca ilçe sırası vardı, yanında "arkadaş ekle"
  daveti. İki sorun:
    1. Tek kapsam "iyi miyim" sorusunun yalnız üçte birini yanıtlıyordu;
       Türkiye genelinde nerede olduğunu görmeden ilçe sırası bağlamsız.
    2. Arkadaş ekleme daveti burada yersizdi — /arkadaslar zaten var ve
       ana sayfanın işi sıralamayı göstermek.

  Sayılar giriş anında YUKARI SAYARAK geliyor: hareket eden bir sayı
  duran bir sayıdan daha çok bakılıyor ve sıralama bu ekranda göz
  çekmesi gereken şey.

  Sıra yoksa (hiç XP yok, konum ayarlı değil) o sütun "—" gösteriyor;
  sütunu tamamen gizlemek üç sütunlu ritmi bozuyordu.
*/

type Scope = {
  key: string;
  label: string;
  rank: number | null;
  size: number;
  /** 'up' | 'down' | 'same' | 'none' — M35b rank_trends()'ten. */
  dir: string;
};

/*
  Trend oku (D36 FAZ HR).

  YÖN TERSİ SEZGİSEL: sıralamada KÜÇÜK sayı iyidir. 12'den 5'e geçmek
  "yükseldi"dir ama sayı DÜŞMÜŞTÜR. Ok bu yüzden sayının değişimini
  değil KULLANICININ durumunun değişimini gösteriyor; çeviri SQL
  tarafında yapılıyor ve buraya hazır yön geliyor.

  Renk + ikon BİRLİKTE: yeşil/kırmızı tek başına ayırt edici değil
  (kırmızı-yeşil renk körlüğü en yaygın tür). Ok yönü kesin söylüyor.

  'none' = İLK GÜN: henüz karşılaştırılacak bir dün yok. Nötr GRİ tire
  çiziliyor, başka bir şey değil. Sarı tire "dün de aynıydı", gri tire
  "dün yok" demek; ikisi renkle ayrılıyor.
*/
const TREND = {
  up: { shape: "trend-up", label: "yükseldi" },
  down: { shape: "trend-down", label: "düştü" },
  same: { shape: "trend-same", label: "değişmedi" },
} as const;

/*
  YÖN İŞARETİ LUCIDE İKONU DEĞİL, SAF ŞEKİL (D38 FAZ T).

  ÖNCEKİ DURUM: `trending-up` / `trending-down` kullanılıyordu. Bunlar
  bir GRAFİK ikonu — zikzak bir çizgi ve ucunda küçük bir ok. 16px'te
  kartın içinde "görev ikonu" gibi okunuyordu ve yön bilgisi
  kaybolyordu. Ok, ikon değil İŞARET olmalı.

  Dolu üçgen (▲/▼) CSS kenarlıklarıyla çiziliyor: lucide'da dolu üçgen
  yok ve `triangle` içi boş, 8px'te seçilmiyor. Unicode ▲ karakteri
  denendi ve elendi — yazı tipine göre boyutu ve hizası oynuyor,
  Android'de sayıdan büyük çıkıyordu. Kenarlık üçgeni her yerde aynı.

  "Aynı" için üçgen değil kısa bir tire: eşitlik bir yön değil.
*/
function TrendMark({ dir }: { dir: string }) {
  const t = TREND[dir as keyof typeof TREND];

  /*
    Önceki gün verisi yok: nötr gri tire, AÇIKLAMA METNİ YOK.

    D37'de altına "Trend okları yarın başlıyor." cümlesi konmuştu;
    kaldırıldı. Kartın altına açıklama yazmak ekranı kirletiyor ve üç
    sütunluk sıkı bir bloğa dördüncü bir satır ekliyor. İşaretin
    kendisi zaten "henüz bir şey yok" diyor.
  */
  if (!t) {
    return (
      <span aria-hidden className="trend-mark trend-none" />
    );
  }

  return (
    <span
      title={`Önceki kayda göre ${t.label}`}
      className="inline-flex items-center"
    >
      <span aria-hidden className={`trend-mark ${t.shape}`} />
      <span className="sr-only">Önceki kayda göre {t.label}</span>
    </span>
  );
}

/** Sıra sayısını hedefe doğru sayarak getiren küçük bileşen. */
function RankCounter({ to }: { to: number }) {
  const [value, setValue] = useState(to);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    /*
      Yüksek sıralarda baştan saymak saçma oluyordu (#4213 için 4213
      adım). Başlangıç hedefin en fazla 40 fazlası: sayı hep AŞAĞI değil
      YUKARI doğru gelsin ama tur da kısa olsun.
    */
    const from = to + Math.min(40, Math.max(6, Math.round(to * 0.35)));
    setValue(from);

    const duration = 850;
    const start = performance.now();
    let frame = 0;

    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + (to - from) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [to]);

  return <>{value}</>;
}

export function RankCard({ scopes }: { scopes: Scope[] }) {
  return (
    <section
      className="anim-stagger mt-5"
      style={{ "--i": 3 } as React.CSSProperties}
    >
      <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
        <Icon name="trophy" className="h-4 w-4 text-coin" />
        Sıralaman
      </h2>

      <div className="grid grid-cols-3 gap-2">
        {scopes.map((scope) => (
          <Link
            key={scope.key}
            href={`/siralama?kapsam=${scope.key}&donem=week`}
            className="press-soft flex flex-col items-center rounded-2xl border border-edge bg-card px-2 py-3.5 hover:border-primary/60"
          >
            {/*
              Sayı AÇIK renkte ve büyük: kartın taşıdığı tek bilgi bu.
              Önceki sürümde 14px koyu gri idi ve kartın içinde
              kayboluyordu.

              D36 FAZ HR: ton bir kademe daha açıldı (#ffe9a8 -> #fff4d6)
              ve altına kendi renginde bir ışıma eklendi. Kart zemini
              koyu; soluk altın orada hâlâ "yazı" gibi okunuyordu, oysa
              bu sayı ekrandaki en parlak şey olmalı.

              Ok sayının YANINDA: altına koymak denendi ve elendi, üç
              sütunlu ızgarada kart yüksekliğini büyütüyor ve kaydırma
              gerektiriyordu.
            */}
            <span className="flex items-center gap-1">
              <span className="rank-number text-[30px] font-black leading-none">
                {scope.rank === null ? (
                  <span className="text-ink-muted">—</span>
                ) : (
                  <>
                    <span className="align-top text-[20px] opacity-70">#</span>
                    <RankCounter to={scope.rank} />
                  </>
                )}
              </span>
              {scope.rank === null ? null : <TrendMark dir={scope.dir} />}
            </span>

            <span className="mt-1.5 text-[11px] font-semibold text-ink">
              {scope.label}
            </span>
            <span className="text-[10px] text-ink-muted">
              {scope.rank === null ? "sırada değilsin" : `${scope.size} kişi`}
            </span>
          </Link>
        ))}
      </div>

    </section>
  );
}
