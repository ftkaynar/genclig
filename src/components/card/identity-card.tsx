import Image from "next/image";

import { Icon } from "@/components/ui/icon";
import {
  STAT_META,
  TIER_LABEL,
  TIER_SURFACE,
  type UserStats,
} from "@/lib/stats/labels";

/*
  GENÇLİG Kimlik Kartı.

  Tasarım tamamen özgün: hiçbir oyunun ya da markanın kartı taklit
  edilmiyor, hiçbir lisanslı görsel kullanılmıyor. Düzen (sol üstte genel
  puan, ortada portre, altta istat ızgarası) spor kartlarının yüzyıllık
  ortak dili; yüzeyler, renkler ve tipografi GENÇLİG'in v2 paletinden.
*/

export type CardIdentity = {
  username: string;
  avatarUrl: string | null;
  level: number;
  /** "İstanbul · Kadıköy" gibi; yoksa gizleniyor. */
  location: string | null;
};

/** İstat değerinin vurgu rengi: yüksek olanlar öne çıkıyor. */
function statTone(value: number): string {
  if (value >= 80) return "text-[#7cf5d5]";
  if (value >= 60) return "text-white";
  return "text-white/70";
}

export function IdentityCard({
  identity,
  stats,
  size = "large",
}: {
  identity: CardIdentity;
  stats: UserStats;
  size?: "large" | "mini";
}) {
  const mini = size === "mini";
  const surface = TIER_SURFACE[stats.tier] ?? TIER_SURFACE.bronze;

  return (
    <article
      aria-label={`${identity.username} kimlik kartı, genel puan ${stats.ovr}`}
      className={`card-tier ${surface} relative overflow-hidden rounded-2xl ${
        mini ? "w-[132px]" : "w-full max-w-[280px]"
      }`}
      style={{ aspectRatio: "3 / 4.2" }}
    >
      <div className="card-inner flex h-full flex-col px-3 py-3 text-white">
        {/* ------------------------------------------------ üst: OVR + seviye */}
        <div className="flex items-start justify-between">
          <div className="leading-none">
            <p
              className={`font-bold tabular-nums ${
                mini ? "text-2xl" : "text-4xl"
              }`}
            >
              {stats.ovr}
            </p>
            <p
              className={`mt-0.5 font-bold uppercase tracking-widest text-white/80 ${
                mini ? "text-[7px]" : "text-[9px]"
              }`}
            >
              {TIER_LABEL[stats.tier] ?? stats.tier}
            </p>
          </div>

          <span
            className={`inline-flex items-center gap-0.5 rounded-full bg-black/30 px-1.5 py-0.5 font-bold ${
              mini ? "text-[8px]" : "text-[10px]"
            }`}
          >
            <Icon name="zap" className={mini ? "h-2 w-2" : "h-2.5 w-2.5"} />
            Sv {identity.level}
          </span>
        </div>

        {/* --------------------------------------------------- orta: portre */}
        <div className="flex flex-1 flex-col items-center justify-center gap-1">
          {identity.avatarUrl ? (
            <Image
              src={identity.avatarUrl}
              alt=""
              width={mini ? 44 : 84}
              height={mini ? 44 : 84}
              className="rounded-full border-2 border-white/40 object-cover"
              style={{ width: mini ? 44 : 84, height: mini ? 44 : 84 }}
              unoptimized
            />
          ) : (
            <span
              aria-hidden
              className="flex items-center justify-center rounded-full border-2 border-white/40 bg-black/25 font-bold"
              style={{
                width: mini ? 44 : 84,
                height: mini ? 44 : 84,
                fontSize: mini ? 18 : 34,
              }}
            >
              {identity.username.charAt(0).toUpperCase()}
            </span>
          )}

          <p
            className={`max-w-full truncate font-bold uppercase tracking-wide ${
              mini ? "text-[10px]" : "text-sm"
            }`}
          >
            {identity.username}
          </p>

          {identity.location ? (
            <p
              className={`flex items-center gap-0.5 text-white/75 ${
                mini ? "text-[7px]" : "text-[10px]"
              }`}
            >
              <Icon
                name="map-pin"
                className={mini ? "h-2 w-2" : "h-2.5 w-2.5"}
              />
              {identity.location}
            </p>
          ) : null}
        </div>

        {/* ------------------------------------------------ alt: istat ızgarası */}
        <div
          className={`mt-1 grid grid-cols-2 gap-x-2 border-t border-white/25 pt-1.5 ${
            mini ? "gap-y-0" : "gap-y-0.5"
          }`}
        >
          {STAT_META.map((meta) => {
            const value = stats[meta.key];
            return (
              <div
                key={meta.key}
                className={`flex items-center justify-between ${
                  mini ? "text-[8px]" : "text-[11px]"
                }`}
              >
                <span className="font-semibold tracking-wide text-white/70">
                  {meta.short}
                </span>
                <span
                  className={`font-bold tabular-nums ${statTone(value)}`}
                >
                  {value}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </article>
  );
}
