import Link from "next/link";

import { Countdown } from "./countdown";
import { taskIconName, taskTone } from "./task-card";
import { Icon } from "@/components/ui/icon";
import { SUBMISSION_STATUS_LABEL } from "@/lib/tasks/labels";
import type { SubmissionSummary, TaskRow } from "@/lib/tasks/queries";

/*
  Zorluk kademesi — kart listesiyle aynı dil (D22 FAZ G).
  Renk tek başına ayırt edici değil, bu yüzden rozette kademe adı da yazılı.
*/
const TIER = {
  easy: { ring: "ring-[#b07b4f]", chip: "bg-[#b07b4f]", label: "Kolay" },
  medium: { ring: "ring-[#9aa6b8]", chip: "bg-[#9aa6b8]", label: "Orta" },
  hard: { ring: "ring-[#d4a02c]", chip: "bg-[#d4a02c]", label: "Zor" },
} as const;

function tierOf(difficulty: string) {
  return TIER[difficulty as keyof typeof TIER] ?? TIER.easy;
}

/**
 * Görev ızgarasının kare kartı.
 *
 * Üst yarı kategori gradyanı + büyük ikon, alt yarı metin ve ödüller.
 * `small` varyantı keşif şeritlerinde kullanılıyor: aynı bileşen iki yerde
 * dursun diye ayrı bir kart yazılmadı — iki kart iki ayrı görsel dil
 * demekti ve biri güncellenince diğeri geride kalıyordu.
 */
export function TaskTile({
  task,
  submission,
  teamCount,
  distanceLabel,
  small = false,
}: {
  task: TaskRow;
  submission?: SubmissionSummary;
  teamCount?: number;
  /** Keşfet şeridinde mesafe rozeti ("1.2 km"). */
  distanceLabel?: string | null;
  small?: boolean;
}) {
  const tier = tierOf(task.difficulty);
  const done = submission?.status === "approved";
  const pending = submission?.status === "pending";

  /*
    Zaman çipi burada kart listesindekinden farklı: oradaki çip açık kart
    yüzeyinde duruyor ve yarı saydam renkli zemin + renkli metin okunuyor.
    Kutucukta çip kategori gradyanının ÜSTÜNDE; aynı stil okunmuyordu.
    Bu yüzden koyu saydam zemin + beyaz metin, ikon durumu taşıyor.
  */
  const timeChip =
    task.timeState === "upcoming"
      ? { icon: "calendar-clock", label: "Yakında" }
      : task.ends_at
        ? { icon: "timer", label: "Aktif" }
        : { icon: "activity", label: "Sürekli" };

  return (
    <li className={small ? "w-[150px] shrink-0 snap-start" : ""}>
      <Link
        href={`/gorevler/${task.id}`}
        className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border border-edge bg-card ring-1 ring-inset transition-transform duration-150 ease-out active:translate-y-0.5 ${tier.ring}`}
        style={{ aspectRatio: small ? undefined : "3 / 4" }}
      >
        {/* --------------------------------------------- üst yarı: ikon alanı */}
        <span
          className={`relative flex ${
            small ? "h-[84px]" : "h-[46%]"
          } items-center justify-center bg-gradient-to-br ${taskTone(task)}`}
        >
          {/*
            Hafif ızgara deseni: düz gradyan zemin bu boyutta yassı
            duruyordu. SVG yerine CSS gradyanı — ek istek yok ve tema
            değişiminde rengi takip ediyor.
          */}
          <span aria-hidden className="tile-pattern absolute inset-0" />

          <Icon
            name={taskIconName(task)}
            className={small ? "relative h-9 w-9" : "relative h-14 w-14"}
            strokeWidth={2}
          />

          {/* Sol üst: zaman durumu */}
          <span
            className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-black/35 px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur-sm"
          >
            <Icon name={timeChip.icon} className="h-2.5 w-2.5" />
            {timeChip.label}
          </span>

          {/* Sağ üst: zorluk kademesi (küçük parıltı) */}
          <span
            className={`tier-glow absolute right-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white ${tier.chip}`}
          >
            {tier.label}
          </span>
        </span>

        {/* ----------------------------------------------- köşe kurdelesi */}
        {done || pending ? (
          <span
            className={`absolute right-0 top-[44%] rounded-l-md px-2 py-0.5 text-[9px] font-bold text-white ${
              done ? "bg-status-success" : "bg-status-warning"
            }`}
          >
            {done
              ? "Tamamlandı"
              : (SUBMISSION_STATUS_LABEL[submission?.status ?? ""] ??
                "İncelemede")}
          </span>
        ) : null}

        {/* --------------------------------------------- alt yarı: metin */}
        <span className="flex min-w-0 flex-1 flex-col gap-1.5 p-2.5">
          <span
            className={`line-clamp-2 font-semibold leading-snug text-ink ${
              small ? "text-[11px]" : "text-[13px]"
            }`}
          >
            {task.title}
          </span>

          <span className="flex flex-wrap items-center gap-1">
            <span className="inline-flex items-center gap-0.5 rounded-full bg-xp/15 px-1.5 py-0.5 text-[10px] font-bold text-xp">
              <Icon name="zap" className="h-2.5 w-2.5" />
              {task.xp}
            </span>
            <span className="inline-flex items-center gap-0.5 rounded-full bg-coin/15 px-1.5 py-0.5 text-[10px] font-bold text-coin">
              <Icon name="coins" className="h-2.5 w-2.5" />
              {task.coin}
            </span>
            {distanceLabel ? (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-ink-muted">
                <Icon name="map-pin" className="h-2.5 w-2.5" />
                {distanceLabel}
              </span>
            ) : null}
          </span>

          {/* Durum satırı en altta: geri sayım ya da "Sürekli". */}
          <span className="mt-auto block truncate text-[10px] font-medium text-ink-muted">
            {task.timeState === "upcoming" && task.starts_at ? (
              <Countdown
                endsAt={task.starts_at}
                initialLabel={task.startsInLabel ?? ""}
              />
            ) : task.ends_at ? (
              <Countdown
                endsAt={task.ends_at}
                initialLabel={task.remainingLabel ?? ""}
              />
            ) : (
              "Sürekli"
            )}
          </span>
        </span>

        {/* Takım şeridi */}
        {task.scope === "team" ? (
          <span className="flex items-center justify-center gap-1 bg-magenta/15 py-1 text-[10px] font-semibold text-magenta">
            <Icon name="users" className="h-3 w-3" />
            Takım · {teamCount ?? 0}/{task.min_team_size ?? 2}
          </span>
        ) : null}
      </Link>
    </li>
  );
}
