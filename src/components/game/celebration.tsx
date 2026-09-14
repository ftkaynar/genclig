"use client";

import { useEffect, useMemo, useState } from "react";

import { Icon } from "@/components/ui/icon";

/*
  Görev tamamlama kutlaması.

  Tam ekran örtü; XP sayacı yukarı sayıyor, seviye atlandıysa konfeti patlıyor.
  Konfeti mutlak konumlu küçük div'lerle çiziliyor — kütüphane eklemedik,
  çünkü efekt saniyeler sürüyor ve bundle'a kalıcı yük bindirmeye değmiyor.

  Parçacıkların yönü ve rengi bir kez hesaplanıp sabitleniyor; her render'da
  yeniden rastgele üretilseydi konfeti uçarken titrerdi.
*/

const CONFETTI_COLORS = [
  "#7C3AED",
  "#6366F1",
  "#22D3EE",
  "#EC4899",
  "#F5B301",
  "#22C55E",
];

type Particle = {
  left: number;
  delay: number;
  duration: number;
  color: string;
  dx: string;
  dy: string;
  rot: string;
  size: number;
};

function makeParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, index) => {
    // Deterministik olmayan ama tek seferlik: bileşen ömrü boyunca sabit.
    const angle = (index / count) * Math.PI * 2;
    return {
      left: 8 + Math.random() * 84,
      delay: Math.random() * 250,
      duration: 1100 + Math.random() * 900,
      color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
      dx: `${Math.round(Math.cos(angle) * (40 + Math.random() * 90))}px`,
      dy: `${Math.round(120 + Math.random() * 220)}px`,
      rot: `${Math.round(180 + Math.random() * 540)}deg`,
      size: 6 + Math.round(Math.random() * 6),
    };
  });
}

/** Sıfırdan hedefe sayan rakam. */
function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (target <= 0) {
      return;
    }

    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      // easeOutCubic: sonuna doğru yavaşlayınca sayı "oturuyor".
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));

      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);

  return value;
}

export type CelebrationData = {
  xp: number;
  coin: number;
  approved: boolean;
  levelUp?: { level: number } | null;
};

export function Celebration({
  data,
  onClose,
}: {
  data: CelebrationData;
  onClose: () => void;
}) {
  const xpShown = useCountUp(data.approved ? data.xp : 0);
  const particles = useMemo(
    () => (data.levelUp ? makeParticles(28) : []),
    [data.levelUp],
  );

  // Örtü açıkken sayfa kaymasın.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Görev sonucu"
      className="fixed inset-0 z-50 flex items-center justify-center bg-brand/85 px-6 backdrop-blur-sm"
    >
      {particles.map((particle, index) => (
        <span
          key={index}
          aria-hidden
          className="pointer-events-none absolute top-1/3 rounded-sm"
          style={
            {
              left: `${particle.left}%`,
              width: particle.size,
              height: particle.size * 1.6,
              backgroundColor: particle.color,
              animation: `genclig-confetti ${particle.duration}ms ease-out ${particle.delay}ms forwards`,
              "--dx": particle.dx,
              "--dy": particle.dy,
              "--rot": particle.rot,
            } as React.CSSProperties
          }
        />
      ))}

      <div className="anim-pop w-full max-w-sm rounded-3xl border border-white/15 bg-card/95 p-6 text-center shadow-2xl">
        {data.levelUp ? (
          <>
            <span className="brand-gradient anim-glow mx-auto flex h-20 w-20 items-center justify-center rounded-full text-white">
              <Icon name="trophy" className="h-9 w-9" />
            </span>
            <p className="mt-4 text-3xl font-black tracking-tight text-ink">
              SEVİYE {data.levelUp.level}!
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              Yeni seviyeye ulaştın. Devam et.
            </p>
          </>
        ) : (
          <>
            <span
              className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full text-white ${
                data.approved ? "brand-gradient" : "bg-status-warning"
              }`}
            >
              <Icon
                name={data.approved ? "check" : "timer"}
                className="h-9 w-9"
              />
            </span>
            <p className="mt-4 text-xl font-bold text-ink">
              {data.approved ? "Görev tamamlandı" : "İncelemeye alındı"}
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              {data.approved
                ? "Ödülün hesabına geçti."
                : "Onaylandığında ödülün hesabına geçecek."}
            </p>
          </>
        )}

        {data.approved ? (
          <div className="anim-rise mt-5 flex items-center justify-center gap-3">
            <span className="flex items-baseline gap-1 rounded-2xl bg-xp/15 px-4 py-2.5 text-xp">
              <Icon name="zap" className="h-5 w-5 self-center" />
              <span className="text-2xl font-black tabular-nums">
                +{xpShown}
              </span>
              <span className="text-sm font-semibold">XP</span>
            </span>

            <span className="flex items-baseline gap-1 rounded-2xl bg-coin/15 px-4 py-2.5 text-coin">
              <Icon name="coins" className="h-5 w-5 self-center" />
              <span className="text-2xl font-black tabular-nums">
                +{data.coin}
              </span>
            </span>
          </div>
        ) : null}

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-full bg-cta px-6 py-3 text-base font-semibold text-white transition-opacity hover:opacity-90"
        >
          Devam
        </button>
      </div>
    </div>
  );
}
