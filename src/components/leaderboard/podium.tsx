import { Icon } from "@/components/ui/icon";
import { formatPoints } from "@/lib/points/queries";
import type { LeaderboardRow } from "@/lib/leaderboard/queries";

/*
  İlk üç için podyum.

  Birinci ortada ve daha büyük; ikinci solda, üçüncü sağda. Sıra numarasına
  göre değil görsel hiyerarşiye göre diziliyor, mockup'taki düzen bu.
  Üçten az kişi varsa eksik basamaklar hiç çizilmiyor.
*/

const TONE: Record<number, { ring: string; badge: string; height: string }> = {
  1: { ring: "border-coin", badge: "bg-coin text-brand", height: "h-24" },
  2: { ring: "border-edge", badge: "bg-edge text-ink", height: "h-16" },
  3: { ring: "border-teal/60", badge: "bg-teal text-white", height: "h-12" },
};

function Step({
  row,
  highlight,
}: {
  row: LeaderboardRow;
  highlight: boolean;
}) {
  const tone = TONE[row.rank] ?? TONE[3];

  return (
    <div className="flex min-w-0 flex-1 flex-col items-center">
      <span
        className={`flex h-12 w-12 items-center justify-center rounded-full border-2 ${tone.ring} bg-card text-base font-bold text-ink`}
      >
        {row.username.charAt(0).toUpperCase()}
      </span>

      <span
        className={`mt-1.5 max-w-full truncate text-xs font-semibold ${
          highlight ? "text-primary" : "text-ink"
        }`}
      >
        {row.username}
      </span>
      <span className="text-[10px] text-ink-muted">Seviye {row.level}</span>

      <div
        className={`mt-2 flex w-full ${tone.height} flex-col items-center justify-start rounded-t-xl bg-surface pt-2`}
      >
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${tone.badge}`}
        >
          {row.rank}
        </span>
        <span className="mt-1 text-[11px] font-semibold text-ink">
          {formatPoints(row.total_xp)}
        </span>
      </div>
    </div>
  );
}

export function Podium({
  rows,
  currentUserId,
}: {
  rows: LeaderboardRow[];
  currentUserId: string;
}) {
  const first = rows.find((row) => row.rank === 1);
  const second = rows.find((row) => row.rank === 2);
  const third = rows.find((row) => row.rank === 3);

  if (!first) return null;

  return (
    <section className="rounded-2xl border border-edge bg-card p-4">
      <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-ink">
        <Icon name="trophy" className="h-4 w-4 text-coin" />
        Zirve
      </h2>

      <div className="flex items-end gap-2">
        {second ? (
          <Step row={second} highlight={second.user_id === currentUserId} />
        ) : (
          <div className="flex-1" />
        )}
        <Step row={first} highlight={first.user_id === currentUserId} />
        {third ? (
          <Step row={third} highlight={third.user_id === currentUserId} />
        ) : (
          <div className="flex-1" />
        )}
      </div>
    </section>
  );
}
