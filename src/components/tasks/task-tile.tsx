import Link from "next/link";

import { Countdown } from "./countdown";
import { taskIconName, taskTone } from "./task-card";
import { Icon } from "@/components/ui/icon";
import { taskArtUrl } from "@/lib/tasks/art";
import { TASK_STATE_STYLE, taskCardState } from "@/lib/tasks/labels";
import type { SubmissionSummary, TaskRow } from "@/lib/tasks/queries";

/*
  Görev kutucuğu v3 — mobil oyun estetiği (D28 FAZ G, D32 FAZ G3).

  ÖNCEKİ SORUN: kart bilgi olarak doğruydu ama "oyunsu" değildi. Ödül
  küçük iki hapta duruyordu, zorluk kademesi ince bir halkaydı, dokunuşun
  geri bildirimi yoktu. Kullanıcı kartı okuyordu; istemiyordu.

  v3'ün tek amacı ÖDÜLÜ öne çıkarmak. Başlıktan önce "+80 XP +50 Token"
  görünüyor; kartın en büyük ikinci öğesi o. Gençleri harekete geçiren
  şey görevin adı değil, kazancı.

  D32 eklentileri: durum mührü (tik/saat/alev), kapak görseli ve sürekli
  görevin günlük ritmi.

  Yüzeyler globals.css'te (.tile-edge, .tile-chip, .reward-pill,
  .countdown-pill, .tile-press, .tile-stagger, .state-seal, .repeat-pill).
  Burada yalnızca hangi durumda hangisinin takılacağı var.
*/

/*
  Zorluk kademesi.

  Renk + rozet birlikte: renk tek başına ayırt edici değil (renk körlüğü),
  rozetteki metin kademeyi kesin söylüyor. Bu kural D22'den beri aynı.
*/
const TIER = {
  easy: { edge: "tile-edge-easy", chip: "bg-[#b07b4f]", label: "KOLAY" },
  medium: { edge: "tile-edge-medium", chip: "bg-[#9aa6b8]", label: "ORTA" },
  hard: { edge: "tile-edge-hard", chip: "bg-[#d4a02c]", label: "ZOR" },
} as const;

function tierOf(difficulty: string) {
  return TIER[difficulty as keyof typeof TIER] ?? TIER.easy;
}

/**
 * Görev ızgarasının kare kartı.
 *
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
  index = 0,
}: {
  task: TaskRow;
  submission?: SubmissionSummary;
  teamCount?: number;
  /** Keşfet şeridinde mesafe rozeti ("1.2 km"). */
  distanceLabel?: string | null;
  small?: boolean;
  /** Izgaradaki sıra — kademeli beliriş gecikmesi için. */
  index?: number;
}) {
  const tier = tierOf(task.difficulty);
  const upcoming = task.timeState === "upcoming";
  const timed = !upcoming && Boolean(task.ends_at);

  /*
    Durum ritmi (D32 FAZ G3): tamamlandı / incelemede / tekrar yap.

    Kural labels.ts'te duruyor: aynı karar detay sayfasında ve listede
    aynı sonucu vermeli. İki ayrı kopyada tutmak, birinin unutulması
    demekti (aynı sınıf hata D24 ve D30'da ölçüldü).
  */
  const state = taskCardState(task.type, submission);
  const badge = state === "none" ? null : TASK_STATE_STYLE[state];
  const done = state === "done";

  /*
    Kapak görseli. Yoksa kategori gradyanı devrede kalıyor — görsel
    yüklemek yönetim tarafında ZORUNLU değil, aksi halde görev
    yayınlamak görsel beklemeye takılırdı.
  */
  const artUrl = taskArtUrl(task.art_key);

  return (
    <li
      className={`tile-stagger ${small ? "w-[160px] shrink-0 snap-start" : ""}`}
      style={{ "--i": index } as React.CSSProperties}
    >
      <Link
        href={`/gorevler/${task.id}`}
        className={`tile-press group relative flex h-full flex-col overflow-hidden rounded-2xl bg-card ${tier.edge}`}
        style={{ aspectRatio: small ? undefined : "3 / 4" }}
      >
        {/* --------------------------------------------- üst: kategori alanı */}
        <span
          className={`relative flex ${
            small ? "h-[92px]" : "h-[44%]"
          } items-center justify-center bg-gradient-to-br ${taskTone(task)}`}
        >
          {artUrl ? (
            /*
              Görsel <img> değil arka plan: kart 3/4 oranında ve kapak her
              zaman tam kaplamalı. next/image denendi ve elendi — 4 KB'lık
              yer tutucu SVG'ler için optimizasyon hattı kazanç değil
              fazladan istek getiriyordu. Gerçek WEBP'ler geldiğinde tekrar
              değerlendirilecek.
            */
            <span
              aria-hidden
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${artUrl})` }}
            />
          ) : (
            <span aria-hidden className="tile-pattern absolute inset-0" />
          )}

          {/*
            Kategori ikonu. Kapak görseli varsa küçülüp sol alta çekiliyor:
            görsel zaten konuyu anlatıyor, ortadaki büyük ikon onu örtüyordu.
          */}
          <span
            className={`tile-chip flex items-center justify-center rounded-2xl ${
              artUrl
                ? "absolute bottom-1.5 right-1.5 h-8 w-8"
                : small
                  ? "relative h-12 w-12"
                  : "relative h-[58px] w-[58px]"
            }`}
          >
            <Icon
              name={taskIconName(task)}
              className={
                artUrl
                  ? "h-4 w-4 text-white"
                  : small
                    ? "h-6 w-6 text-white"
                    : "h-8 w-8 text-white"
              }
              strokeWidth={2.1}
            />
          </span>

          {/* Sağ üst: zorluk kademesi. */}
          <span
            className={`tier-glow absolute right-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[8px] font-bold tracking-wider text-white ${tier.chip}`}
          >
            {tier.label}
          </span>

          {/* Sol üst: yaklaşan görev şeridi. */}
          {upcoming ? (
            <span className="upcoming-pill absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[8px] font-bold tracking-wider text-white">
              <Icon name="calendar-clock" className="h-2.5 w-2.5" />
              YAKINDA
            </span>
          ) : null}

          {/* Tamamlanan görevde hafif kutlama izi. */}
          {done ? (
            <span aria-hidden className="tile-done-trace absolute inset-0" />
          ) : null}
        </span>

        {/* --------------------------------------------------- durum mührü */}
        {/*
          ÖNCEKİ DURUM: sağ kenarda "Tamamlandı" yazan küçük bir kurdele.
          Oyunun en değerli anı (tamamlama) 9 punto bir etikete sıkışmıştı
          ve kartın en az bakılan köşesindeydi.

          v3: kapakla içeriğin sınırına oturan büyük yuvarlak mühür. Kart
          zeminiyle halkalanıyor, yani "kartın üstüne basılmış" gibi
          duruyor. İkon birincil, yanındaki metin doğrulayıcı — renk tek
          başına ayırt edici değil (renk körlüğü).
        */}
        {badge ? (
          <span
            className={`absolute left-2 top-[44%] z-10 flex -translate-y-1/2 items-center gap-1 ${
              small ? "scale-90" : ""
            }`}
          >
            <span
              className={`state-seal flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-4 ring-card ${badge.badge}`}
            >
              <Icon
                name={badge.icon}
                className="h-5 w-5 text-white"
                strokeWidth={2.8}
              />
            </span>
            <span
              className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold text-white ${badge.badge}`}
            >
              {badge.label}
            </span>
          </span>
        ) : null}

        {/* ------------------------------------------------------ alt: içerik */}
        <span className="flex min-w-0 flex-1 flex-col gap-1.5 p-2.5">
          {/*
            KAZANÇ ÖNİZLEMESİ — başlıktan ÖNCE geliyor.
            Sıralama bilinçli: göz kartın alt yarısına indiğinde ilk
            gördüğü şey ne kazanacağı olsun.
          */}
          <span className="flex items-center gap-1">
            <span
              className={`reward-pill inline-flex items-center gap-0.5 rounded-full bg-xp px-1.5 py-0.5 font-extrabold text-[#06283a] ${
                small ? "text-[10px]" : "text-[11px]"
              }`}
            >
              <Icon name="zap" className="h-3 w-3" />+{task.xp}
            </span>
            <span
              className={`reward-pill inline-flex items-center gap-0.5 rounded-full bg-coin px-1.5 py-0.5 font-extrabold text-[#3a2a00] ${
                small ? "text-[10px]" : "text-[11px]"
              }`}
            >
              <Icon name="coins" className="h-3 w-3" />+{task.coin}
            </span>
            {distanceLabel ? (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-ink-muted">
                <Icon name="map-pin" className="h-2.5 w-2.5" />
                {distanceLabel}
              </span>
            ) : null}
          </span>

          <span
            className={`line-clamp-2 font-semibold leading-snug text-ink ${
              small ? "text-[11px]" : "text-[13px]"
            }`}
          >
            {task.title}
          </span>

          {/* Zaman durumu en altta. */}
          <span className="mt-auto block">
            {upcoming && task.starts_at ? (
              <span className="upcoming-pill inline-flex max-w-full items-center gap-1 truncate rounded-full px-2 py-0.5 text-[10px] font-bold text-white">
                <Icon name="calendar-clock" className="h-3 w-3 shrink-0" />
                <Countdown
                  endsAt={task.starts_at}
                  initialLabel={task.startsInLabel ?? ""}
                />
              </span>
            ) : timed && task.ends_at ? (
              /*
                Canlı geri sayım: nabız atan nokta "süre AKIYOR" diyor.
                Nokta yalnızca burada — sürekli görevde yanıp sönen bir
                şey olması, aciliyet sinyalini değersizleştirirdi.
              */
              <span className="countdown-pill inline-flex max-w-full items-center gap-1 truncate rounded-full px-2 py-0.5 text-[10px] font-bold text-white">
                <span
                  aria-hidden
                  className="live-dot h-1.5 w-1.5 shrink-0 rounded-full bg-white"
                />
                <Countdown
                  endsAt={task.ends_at}
                  initialLabel={task.remainingLabel ?? ""}
                />
              </span>
            ) : state === "repeat" ? (
              /*
                Gün yenilendi: kart artık "yapıldı" demiyor, DAVET ediyor.
                Alev ikonu seri/ritim dilinden geliyor; turuncu bu kartta
                tek kullanımlık, başka turuncu davet yok.
              */
              <span className="repeat-pill inline-flex items-center gap-1 rounded-full bg-amber px-2 py-0.5 text-[10px] font-bold text-[#3a2a00]">
                <Icon name="flame" className="h-3 w-3" />
                Bugün tekrar yap
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-ink-muted">
                <Icon name="activity" className="h-3 w-3" />
                Sürekli
              </span>
            )}
          </span>
        </span>

        {/* Takım şeridi: alt kenarda belirgin. */}
        {task.scope === "team" ? (
          <span className="flex items-center justify-center gap-1 bg-magenta py-1 text-[10px] font-bold uppercase tracking-wide text-white">
            <Icon name="users" className="h-3 w-3" />
            Takım · {teamCount ?? 0}/{task.min_team_size ?? 2} kişi
          </span>
        ) : null}
      </Link>
    </li>
  );
}
