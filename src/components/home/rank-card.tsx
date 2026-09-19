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

  'none' = İLK GÜN: henüz karşılaştırılacak bir dün yok.

  ÖNCEKİ DURUM: bu durumda hiçbir şey basılmıyordu. Gerekçesi "nötr bir
  çizgi 'değişmedi' demek olur, oysa bilinmiyor" idi — mantık doğruydu
  ama sonucu yanlış: üç kartın da yanı bomboş kalıyordu ve proje sahibi
  özelliği "yapılmamış" sandı (D37 teşhisi: bulutta yalnız bugünün 3
  snapshot satırı vardı, önceki günden 0).

  Sessizlik, "bilinmiyor"u anlatmıyor. Artık nötr bir tire + "Yarın
  karşılaştırılacak" ipucu var: dikkat çekmeden "veri birikiyor" diyor.
  Renk ink-muted, yani üç yönün hiçbiriyle karışmıyor — sarı eşittir
  "dün de aynıydı", gri tire "dün yok" demek.
*/
const TREND = {
  up: { icon: "trending-up", className: "text-status-success", label: "yükseldi" },
  down: { icon: "trending-down", className: "text-status-danger", label: "düştü" },
  same: { icon: "minus", className: "text-coin", label: "değişmedi" },
} as const;

/** İlk gün: karşılaştırma yok, ama boşluk da bırakılmıyor. */
function TrendPending() {
  return (
    <span
      title="Yarın karşılaştırılacak"
      className="trend-pending inline-flex items-center text-ink-muted"
    >
      <Icon name="minus" className="h-4 w-4" strokeWidth={3} />
      <span className="sr-only">
        Karşılaştırma için henüz veri yok, yarın karşılaştırılacak
      </span>
    </span>
  );
}

function TrendArrow({ dir }: { dir: string }) {
  const t = TREND[dir as keyof typeof TREND];
  if (!t) return <TrendPending />;

  return (
    <span
      title={`Önceki kayda göre ${t.label}`}
      className={`inline-flex items-center ${t.className}`}
    >
      <Icon name={t.icon} className="h-4 w-4" strokeWidth={3} />
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
  /*
    İLK GÜN AÇIKLAMASI (D37 FAZ T).

    Tire ikonunun `title` ipucu masaüstünde çalışıyor ama bu bir mobil
    uygulama; dokunmatik ekranda hover yok, yani ipucu hiç okunmuyor.
    Bu yüzden açıklama bloğun ALTINDA tek satır.

    Kart BAŞINA değil blok başına: üç kartın altına üç ayrı "yarın
    karşılaştırılacak" yazmak, 390px'te üç sütunlu ritmi bozuyor ve
    aynı cümleyi üç kez okutuyordu.

    Yalnızca sırası OLAN ve hepsi 'none' olan durumda çıkıyor. Bir
    kapsamda bile ok varsa mekanizma görünür biçimde çalışıyor demektir
    ve cümle gereksiz gürültü olurdu.
  */
  const siralananlar = scopes.filter((scope) => scope.rank !== null);
  const ilkGun =
    siralananlar.length > 0 &&
    siralananlar.every((scope) => !TREND[scope.dir as keyof typeof TREND]);

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
              {scope.rank === null ? null : <TrendArrow dir={scope.dir} />}
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

      {ilkGun ? (
        <p className="mt-1.5 flex items-center gap-1 text-[10px] text-ink-muted">
          <Icon name="minus" className="h-3 w-3 shrink-0" strokeWidth={3} />
          Bugünkü sıran kaydedildi. Trend okları yarın başlıyor.
        </p>
      ) : null}
    </section>
  );
}
