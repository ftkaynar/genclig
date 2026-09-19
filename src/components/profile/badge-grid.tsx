"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

import { BadgeMedal } from "./badge-medal";
import { badgeTone } from "@/lib/profile/badge-tones";

export type BadgeItem = {
  id: string;
  /** Rozet rengini belirliyor; bkz. lib/profile/badge-tones.ts */
  slug: string;
  name: string;
  description: string;
  icon: string | null;
  earned: boolean;
  earned_at: string | null;
  criteriaText: string;
  progress: { current: number; target: number } | null;
  xp_bonus: number;
  coin_bonus: number;
};

/*
  Rozet ızgarası.

  ÖNCEKİ SORUN: kilitli rozette rozetin kendi ikonu yerine kilit ikonu
  gösteriliyordu; kullanıcı neyi kazanacağını göremiyordu ve bütün
  kilitliler birbirinin aynısıydı.

  Yeni davranış: kilitli rozette de KENDİ ikonu duruyor — soluk ama
  seçilebilir netlikte — ve üstüne küçük bir kilit rozeti biniyor.
  Kazanılan rozet dolu renkte ve hafif parıltılı.

  Renk artık rozete özel: her rozet slug'ından gelen kendi tonunda
  çiziliyor (bkz. lib/profile/badge-tones.ts). Önceden kazanılmış her
  rozet aynı altın tonundaydı, kilitliler tek tip griydi; ızgara tek
  renkli görünüyordu. Kilitli rozet de aynı rengi taşıyor ama kısılmış,
  böylece kazanılmış ile kilitli hâlâ bir bakışta ayrılıyor.
*/
function badgeDate(value: string): string {
  return new Date(value).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function BadgeGrid({ badges }: { badges: BadgeItem[] }) {
  const [open, setOpen] = useState<BadgeItem | null>(null);

  if (badges.length === 0) {
    return (
      <p className="mt-2 text-sm text-ink-muted">Henüz rozet tanımlanmamış.</p>
    );
  }

  return (
    <>
      <ul className="mt-3 grid grid-cols-3 gap-2.5">
        {badges.map((badge) => {
          const tone = badgeTone(badge.slug);
          const ratio = badge.progress
            ? Math.min(
                100,
                Math.round(
                  (badge.progress.current /
                    Math.max(1, badge.progress.target)) *
                    100,
                ),
              )
            : 0;

          return (
            <li key={badge.id}>
              <button
                type="button"
                onClick={() => setOpen(badge)}
                className={`flex w-full flex-col items-center rounded-xl border p-2.5 text-center transition-colors ${
                  badge.earned
                    ? tone.card
                    : "border-edge bg-surface hover:border-primary/40"
                }`}
              >
                {/*
                  Madalya (D36 FAZ RZ). Kilit ikonu da madalyanın kendi
                  katmanı — eskiden ayrı bir mutlak konumlu rozetti ve
                  madalya küçüldüğünde orantısı bozuluyordu.
                */}
                <BadgeMedal
                  icon={badge.icon}
                  tone={tone}
                  earned={badge.earned}
                  size="md"
                />

                <span
                  className={`mt-1.5 line-clamp-2 text-[11px] font-semibold ${
                    badge.earned ? "text-ink" : "text-ink-muted"
                  }`}
                >
                  {badge.name}
                </span>

                {/* Kilitliyse kriter + ilerleme; kazanılmışsa tarih. */}
                {badge.earned ? (
                  badge.earned_at ? (
                    <span className={`mt-0.5 text-[9px] ${tone.text}`}>
                      {badgeDate(badge.earned_at)}
                    </span>
                  ) : null
                ) : (
                  <>
                    <span className="mt-0.5 line-clamp-2 text-[9px] leading-tight text-ink-muted">
                      {badge.criteriaText}
                    </span>
                    {badge.progress ? (
                      <>
                        <span className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-edge">
                          <span
                            className="bar-fill brand-gradient block h-full rounded-full"
                            style={{ width: `${ratio}%` }}
                          />
                        </span>
                        <span className="mt-0.5 text-[9px] font-semibold text-primary">
                          {badge.progress.current}/{badge.progress.target}
                        </span>
                      </>
                    ) : null}
                  </>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {/* --------------------------------------------------- detay modalı */}
      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-brand/80 px-6 backdrop-blur-sm"
        >
          <div className="anim-pop w-full max-w-sm rounded-3xl border border-edge bg-card p-6 text-center">
            <span className="flex justify-center">
              <BadgeMedal
                icon={open.icon}
                tone={badgeTone(open.slug)}
                earned={open.earned}
                size="lg"
              />
            </span>

            <p className="mt-3 text-lg font-bold text-ink">{open.name}</p>
            <p className="mt-1 text-sm text-ink-muted">{open.description}</p>

            <p className="mt-3 rounded-xl bg-surface px-3.5 py-2.5 text-xs text-ink-muted">
              <strong className="text-ink">Nasıl kazanılır:</strong>{" "}
              {open.criteriaText}
            </p>

            {open.earned ? (
              <p
                className={`mt-3 text-sm font-semibold ${
                  badgeTone(open.slug).text
                }`}
              >
                {open.earned_at
                  ? `${badgeDate(open.earned_at)} tarihinde kazandın`
                  : "Kazanıldı"}
              </p>
            ) : open.progress ? (
              <div className="mt-3">
                <span className="block h-2 w-full overflow-hidden rounded-full bg-surface">
                  <span
                    className="bar-fill brand-gradient block h-full rounded-full"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round(
                          (open.progress.current /
                            Math.max(1, open.progress.target)) *
                            100,
                        ),
                      )}%`,
                    }}
                  />
                </span>
                <p className="mt-1 text-sm font-semibold text-primary">
                  {open.progress.current} / {open.progress.target}
                </p>
              </div>
            ) : null}

            {open.xp_bonus > 0 || open.coin_bonus > 0 ? (
              <p className="mt-2 text-xs text-ink-muted">
                Ödül: +{open.xp_bonus} XP • +{open.coin_bonus} Token
              </p>
            ) : null}

            <Button variant="secondary" size="md" block type="button" onClick={() => setOpen(null)}>
              Kapat
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
