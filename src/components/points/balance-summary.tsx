import { Icon } from "@/components/ui/icon";
import { LevelRing } from "@/components/ui/level-ring";
import { formatPoints, type UserPoints } from "@/lib/points/queries";

/**
 * Ana ekrandaki bakiye özeti: seviye halkası, XP ilerlemesi ve Coin.
 *
 * Değerler işlem kayıtlarından türetiliyor; burada gösterilen hiçbir sayı
 * veritabanında bir sütun olarak durmuyor.
 */
export function BalanceSummary({
  points,
  todayXp,
  todayCoin,
}: {
  points: UserPoints;
  todayXp?: number;
  todayCoin?: number;
}) {
  const remaining =
    points.nextLevelXp !== null ? points.nextLevelXp - points.xp : null;

  return (
    <div className="mt-5 rounded-2xl bg-white/10 p-4">
      <div className="flex items-center gap-4">
        <LevelRing level={points.level} progress={points.progress} tone="light" />

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">
            {formatPoints(points.xp)} XP
          </p>
          <p className="mt-0.5 text-xs text-white/70">
            {remaining !== null
              ? `Sonraki seviyeye ${formatPoints(remaining)} XP`
              : "En üst seviye"}
          </p>

          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full rounded-full bg-cyan transition-[width] duration-700 ease-out"
              style={{ width: `${Math.round(points.progress * 100)}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mt-3.5 flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-coin/25 px-3 py-1.5 text-xs font-semibold text-white">
          <Icon name="coins" className="h-3.5 w-3.5" />
          {formatPoints(points.coin)} Token
        </span>

        {/* Bugünkü kazanç yalnızca sıfırdan büyükse gösteriliyor: "bugün 0 XP"
            bilgi vermiyor, sadece yer kaplıyordu. */}
        {todayXp !== undefined && (todayXp > 0 || (todayCoin ?? 0) > 0) ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium text-white">
            <Icon name="trending-up" className="h-3.5 w-3.5" />
            Bugün +{todayXp} XP
            {todayCoin ? ` • +${todayCoin} Token` : null}
          </span>
        ) : null}
      </div>
    </div>
  );
}
