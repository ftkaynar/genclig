"use client";

import { useState } from "react";

import { IdentityCard, type CardIdentity } from "./identity-card";
import { Icon } from "@/components/ui/icon";
import { STAT_META, type UserStats } from "@/lib/stats/labels";

/*
  Çevrilebilir kimlik kartı.

  Çevirme tekniği ödül ekranındaki ile aynı (`.flip-scene` / `.flip-inner`,
  D22 FAZ R): dış kap perspektif, iç kap döner, iki yüz arka yüzü gizler.
  Ayrı bir teknik kullanmak, `prefers-reduced-motion` davranışını iki
  yerde ayrı ayrı yönetmek demekti — o ayar zaten globals.css'te bu
  sınıflar için tanımlı.
*/
export function FlipCard({
  identity,
  stats,
  badges,
  totals,
}: {
  identity: CardIdentity;
  stats: UserStats;
  badges: { id: string; name: string; icon: string | null }[];
  totals: { tasks: number; reports: number; friends: number };
}) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div className="flex flex-col items-center">
      <div className="flip-scene w-full max-w-[300px]">
        <div className={`flip-inner ${flipped ? "is-flipped" : ""}`}>
          {/* ------------------------------------------------------- ön yüz */}
          <div className="flip-face flip-front">
            <IdentityCard identity={identity} stats={stats} />
          </div>

          {/* ------------------------------------------------------ arka yüz */}
          <div
            className="flip-face flip-back overflow-hidden rounded-2xl border border-edge bg-card p-3"
            /* Kartla aynı en-boy: VIP kart 100/142, arka yüz de öyle
               olmalı yoksa çevrilince yükseklik zıplıyordu. */
            style={{ aspectRatio: "100 / 142" }}
          >
            <div className="flex h-full flex-col overflow-y-auto">
              <p className="text-[11px] font-bold uppercase tracking-wide text-primary">
                İstat kırılımı
              </p>

              <ul className="mt-1.5 flex flex-col gap-1.5">
                {STAT_META.map((meta) => {
                  const value = stats[meta.key];
                  return (
                    <li key={meta.key}>
                      <div className="flex items-baseline justify-between">
                        <span className="text-[11px] font-semibold text-ink">
                          {meta.name}
                        </span>
                        <span className="text-[11px] font-bold tabular-nums text-primary">
                          {value}
                        </span>
                      </div>
                      <span className="mt-0.5 block h-1.5 w-full overflow-hidden rounded-full bg-surface">
                        <span
                          className="brand-gradient block h-full rounded-full"
                          style={{ width: `${value}%` }}
                        />
                      </span>
                      {/* Nasıl artacağını bilmeyen kullanıcı yükseltmeye
                          de çalışmıyor. */}
                      <span className="mt-0.5 block text-[9px] leading-tight text-ink-muted">
                        {meta.hint}
                      </span>
                    </li>
                  );
                })}
              </ul>

              <p className="mt-2.5 text-[11px] font-bold uppercase tracking-wide text-primary">
                Özet
              </p>
              <div className="mt-1 grid grid-cols-3 gap-1">
                <span className="rounded-lg bg-surface px-1 py-1 text-center">
                  <span className="block text-sm font-bold text-ink">
                    {totals.tasks}
                  </span>
                  <span className="block text-[8px] text-ink-muted">görev</span>
                </span>
                <span className="rounded-lg bg-surface px-1 py-1 text-center">
                  <span className="block text-sm font-bold text-ink">
                    {totals.reports}
                  </span>
                  <span className="block text-[8px] text-ink-muted">
                    bildirim
                  </span>
                </span>
                <span className="rounded-lg bg-surface px-1 py-1 text-center">
                  <span className="block text-sm font-bold text-ink">
                    {totals.friends}
                  </span>
                  <span className="block text-[8px] text-ink-muted">
                    arkadaş
                  </span>
                </span>
              </div>

              {badges.length > 0 ? (
                <>
                  <p className="mt-2.5 text-[11px] font-bold uppercase tracking-wide text-primary">
                    Rozetler
                  </p>
                  <ul className="mt-1 flex flex-wrap gap-1">
                    {badges.slice(0, 12).map((badge) => (
                      <li
                        key={badge.id}
                        title={badge.name}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-coin/15 text-coin"
                      >
                        <Icon
                          name={badge.icon ?? "award"}
                          className="h-3.5 w-3.5"
                        />
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Ön/arka göstergesi — iki nokta, dokununca çeviriyor. */}
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setFlipped(false)}
          aria-label="Kartın ön yüzü"
          aria-pressed={!flipped}
          className={`h-2 w-2 rounded-full transition-colors ${
            flipped ? "bg-edge" : "bg-primary"
          }`}
        />
        <button
          type="button"
          onClick={() => setFlipped(true)}
          aria-label="Kartın arka yüzü"
          aria-pressed={flipped}
          className={`h-2 w-2 rounded-full transition-colors ${
            flipped ? "bg-primary" : "bg-edge"
          }`}
        />
      </div>

      <button
        type="button"
        onClick={() => setFlipped(!flipped)}
        className="mt-2 flex items-center gap-1 text-[11px] font-medium text-ink-muted hover:text-ink"
      >
        <Icon name="chevron-right" className="h-3 w-3" />
        {flipped ? "Kartı çevir" : "Ayrıntıları gör"}
      </button>
    </div>
  );
}
