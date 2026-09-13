import { formatPoints, type UserPoints } from "@/lib/points/queries";

/**
 * Ana ekrandaki bakiye özeti: seviye, XP ve Coin.
 * Değerler işlem kayıtlarından türetiliyor; burada gösterilen hiçbir sayı
 * veritabanında bir sütun olarak durmuyor.
 */
export function BalanceSummary({ points }: { points: UserPoints }) {
  const remaining =
    points.nextLevelXp !== null ? points.nextLevelXp - points.xp : null;

  return (
    <div className="mt-5 rounded-2xl bg-white/10 px-4 py-3.5 text-left">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold text-white">
          Seviye {points.level}
        </span>
        <span className="text-xs text-white/70">
          {remaining !== null
            ? `Sonraki seviyeye ${formatPoints(remaining)} XP`
            : "En üst seviye"}
        </span>
      </div>

      {/* İlerleme çubuğu: progress 0-1 arası geliyor. */}
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/20">
        <div
          className="h-full rounded-full bg-cta"
          style={{ width: `${Math.round(points.progress * 100)}%` }}
        />
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className="rounded-full bg-xp/25 px-2.5 py-1 text-xs font-semibold text-white">
          {formatPoints(points.xp)} XP
        </span>
        <span className="rounded-full bg-coin/25 px-2.5 py-1 text-xs font-semibold text-white">
          {formatPoints(points.coin)} Coin
        </span>
      </div>
    </div>
  );
}
