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
};

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
            */}
            <span className="text-[30px] font-black leading-none text-[#ffe9a8]">
              {scope.rank === null ? (
                <span className="text-ink-muted">—</span>
              ) : (
                <>
                  <span className="text-[20px] align-top text-[#ffe9a8]/70">
                    #
                  </span>
                  <RankCounter to={scope.rank} />
                </>
              )}
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
