import Link from "next/link";

import { Countdown } from "./countdown";
import { Icon } from "@/components/ui/icon";
import { IconBadge } from "@/components/ui/pills";
import { TaskReward } from "@/components/ui/task-reward";
import {
  CATEGORY_TONE,
  CATEGORY_TONE_FALLBACK,
  SUBMISSION_STATUS_LABEL,
  TASK_TYPE_LABEL,
  TIME_STATE_STYLE,
} from "@/lib/tasks/labels";
import type { SubmissionSummary, TaskRow } from "@/lib/tasks/queries";

/** XP ve coin rozetleri; ortak hap bileşenlerini kullanır. */
/**
 * Görevin ödül hapları.
 *
 * `spotlight` verildiğinde değerler ÇİFT gösteriliyor ve normal değer
 * üstü çizili yanında duruyor (D33 FAZ GG). Yalnız çift değeri
 * göstermek "bu görev zaten böyle değerliymiş" diye okunuyordu;
 * kullanıcının bugüne özel bir fırsat olduğunu görmesi gerekiyor.
 *
 * Çarpanı arayüz UYGULAMIYOR, yalnız gösteriyor: puanı
 * award_task_points yazıyor (rule: iş mantığı client'ta olmaz).
 */
export function RewardBadges({
  xp,
  coin,
  spotlight = false,
}: {
  xp: number;
  coin: number;
  spotlight?: boolean;
}) {
  /*
    D34 FAZ XP: detay sayfası da listelerle AYNI hapları kullanıyor.
    Önceden burada soluk kenarlı XpPill/CoinPill vardı, listelerde ise
    dolgun haplar — aynı görev iki ekranda iki ayrı ağırlıkta
    görünüyordu.
  */
  if (!spotlight) {
    return <TaskReward xp={xp} coin={coin} size="lg" />;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="spotlight-badge inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold tracking-wide text-[#3a2a00]">
        <Icon name="star" className="h-3 w-3" />
        GÜNÜN GÖREVİ · 2X ÖDÜL
      </span>
      <TaskReward
        xp={xp * 2}
        coin={coin * 2}
        strikeXp={xp}
        strikeCoin={coin}
        size="lg"
      />
    </div>
  );
}

/**
 * Görevin amblem ikonu: önce görevin kendi ikonu, yoksa kategorisininki,
 * o da yoksa Icon bileşeninin varsayılanı. Data-driven olduğu için yeni
 * görev tipleri kod değişmeden farklı ikon alabiliyor.
 */
export function taskIconName(task: TaskRow): string | null {
  return task.icon ?? task.task_categories?.icon ?? null;
}

export function taskTone(task: TaskRow): string {
  return task.task_categories
    ? (CATEGORY_TONE[task.task_categories.slug] ?? CATEGORY_TONE_FALLBACK)
    : CATEGORY_TONE_FALLBACK;
}

/*
  Zorluk kademesi.

  Çerçeve rengi + köşe rozeti birlikte kullanılıyor: renk tek başına
  ayırt edici değil (renk körlüğü), rozet metni kademeyi kesin söylüyor.
*/
const TIER = {
  easy: { border: "tier-bronze", chip: "bg-[#b07b4f]", label: "Kolay" },
  medium: { border: "tier-silver", chip: "bg-[#9aa6b8]", label: "Orta" },
  hard: { border: "tier-gold", chip: "bg-[#d4a02c]", label: "Zor" },
} as const;

function tierOf(difficulty: string) {
  return TIER[difficulty as keyof typeof TIER] ?? TIER.easy;
}

export function TaskCard({
  task,
  submission,
  teamCount,
}: {
  task: TaskRow;
  submission?: SubmissionSummary;
  /** Takım görevinde aynı görevi tamamlamış takım arkadaşı sayısı. */
  teamCount?: number;
}) {
  const done = submission?.status === "approved";
  const tier = tierOf(task.difficulty);

  return (
    <li>
      <Link
        href={`/gorevler/${task.id}`}
        className={`group relative block overflow-hidden rounded-2xl border-2 bg-card transition-all hover:shadow-sm active:scale-[0.99] ${tier.border}`}
      >
        {/* Köşe rozeti: kademe adı. */}
        <span
          className={`absolute right-0 top-0 rounded-bl-lg px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white ${tier.chip}`}
        >
          {tier.label}
        </span>

        {/* Yaklaşan görevde sol üstte belirgin şerit. */}
        {task.timeState === "upcoming" ? (
          <span className="brand-gradient absolute left-0 top-0 rounded-br-lg px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
            Yakında
          </span>
        ) : null}

        <span className="flex gap-3 p-3.5">
          <IconBadge
            icon={taskIconName(task)}
            tone={taskTone(task)}
            size="card"
          />

          <span className="flex min-w-0 flex-1 flex-col gap-1.5 pr-10">
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-ink-muted">
              {task.task_categories ? (
                <span className="truncate">{task.task_categories.name}</span>
              ) : null}
              <span aria-hidden>·</span>
              <span>{TASK_TYPE_LABEL[task.type] ?? task.type}</span>
            </span>

            <span className="line-clamp-2 text-sm font-semibold leading-snug text-ink">
              {task.title}
            </span>

            {/*
              Zaman durumu tek bir hapta: yaklaşan görevde BAŞLANGICA,
              süreli aktif görevde BİTİŞE geri sayım. İkisi aynı renkte
              olsaydı kullanıcı "2 saat" ifadesinin başlangıca mı bitişe mi
              olduğunu ayırt edemezdi.
            */}
            {task.timeState === "upcoming" && task.starts_at ? (
              <span
                className={`inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${TIME_STATE_STYLE.upcoming.chip}`}
              >
                <Icon name="calendar-clock" className="h-3.5 w-3.5" />
                <Countdown
                  endsAt={task.starts_at}
                  initialLabel={task.startsInLabel ?? ""}
                />
              </span>
            ) : task.ends_at ? (
              <span
                className={`inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${TIME_STATE_STYLE.instant.chip}`}
              >
                <Icon name="timer" className="h-3.5 w-3.5" />
                <Countdown
                  endsAt={task.ends_at}
                  initialLabel={task.remainingLabel ?? ""}
                />
              </span>
            ) : (
              <span
                className={`inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${TIME_STATE_STYLE.continuous.chip}`}
              >
                <Icon name="activity" className="h-3.5 w-3.5" />
                Sürekli
              </span>
            )}

            {task.scope === "team" ? (
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-magenta/15 px-2.5 py-1 text-[11px] font-semibold text-magenta">
                <Icon name="users" className="h-3.5 w-3.5" />
                Takım · {teamCount ?? 0}/{task.min_team_size ?? 2} kişi
              </span>
            ) : null}

            {submission ? (
              <span
                className={
                  done
                    ? "inline-flex w-fit items-center gap-1 rounded-full bg-status-success/15 px-2.5 py-1 text-[11px] font-semibold text-status-success"
                    : "inline-flex w-fit items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-[11px] font-semibold text-ink-muted"
                }
              >
                {done ? <Icon name="check" className="h-3 w-3" /> : null}
                {SUBMISSION_STATUS_LABEL[submission.status] ?? submission.status}
              </span>
            ) : null}
          </span>

          {/* Ödül hapları sağda dikey: kartın sağ kenarı bir "fiyat
              etiketi" sütunu gibi okunuyor, göz tek yerde tarıyor. */}
          <span className="flex shrink-0 flex-col items-end justify-center gap-1.5">
            <TaskReward xp={task.xp} coin={task.coin} size="md" />
            <Icon
              name="chevron-right"
              className="mt-1 h-4 w-4 text-ink-muted transition-transform group-hover:translate-x-0.5"
            />
          </span>
        </span>
      </Link>
    </li>
  );
}
