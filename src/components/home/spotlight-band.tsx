import Link from "next/link";

import { Countdown } from "@/components/tasks/countdown";
import { taskIconName } from "@/components/tasks/task-card";
import { Icon } from "@/components/ui/icon";
import { formatRemaining } from "@/lib/tasks/labels";
import type { TaskRow } from "@/lib/tasks/queries";
import {
  istanbulMidnightIso,
  msUntilIstanbulMidnight,
} from "@/lib/spotlight/queries";

/*
  GÜNÜN GÖREVİ bandı (D33 FAZ GG).

  Vitrin, günde bir görevi öne çıkarıp ödülünü iki katına çıkarıyor.
  Bandın tek işi bunu KAÇIRILMAYACAK kadar net söylemek: altın çerçeve,
  "2X ÖDÜL" rozeti ve gün sonuna geri sayım.

  Altın neden: token/ödül rengi zaten altın (lib/ui/accents.ts) ve
  buradaki vaat de bir ödül çarpanı. Marka moru kullanmak, bandı
  sayfadaki diğer mor yüzeylerle aynı ağırlığa indiriyordu.

  Ödül hapları ÇİFT değerle, normal değer üstü çizili: "2x" yazmak
  soyut, "+200" yanında üstü çizili "+100" görmek somut.

  Geri sayım gün sonuna (Europe/Istanbul 00:00) — vitrin takvim gününe
  bağlı. Damga sunucuda hesaplanıyor: render içinde Date.now() çağırmak
  bileşeni saf olmaktan çıkarıyor ve lint bunu hata sayıyor.
*/
export function SpotlightBand({ task }: { task: TaskRow }) {
  const endsAt = istanbulMidnightIso();
  const initialLabel = formatRemaining(msUntilIstanbulMidnight());

  return (
    <section className="mt-4">
      <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
        <Icon name="star" className="h-4 w-4 text-coin" />
        Günün Görevi
      </h2>

      {/* Altın gradyan kenar + yavaş parıltı: bant "canlı" duruyor. */}
      <div className="spotlight-frame anim-pop rounded-3xl p-[2px]">
        <Link
          href={`/gorevler/${task.id}`}
          className="relative flex items-center gap-3 overflow-hidden rounded-[calc(1.5rem-2px)] bg-card p-4 transition-transform active:scale-[0.99]"
        >
          {/* Köşede 2X rozeti: bandın vaadi tek bakışta okunmalı. */}
          <span className="spotlight-badge absolute right-0 top-0 rounded-bl-xl px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-[#3a2a00]">
            2X ÖDÜL
          </span>

          <span className="spotlight-dial flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-[#3a2a00]">
            <Icon name={taskIconName(task)} className="h-6 w-6" />
          </span>

          <span className="min-w-0 flex-1">
            <span className="line-clamp-2 pr-14 text-sm font-bold leading-snug text-ink">
              {task.title}
            </span>

            {/*
              Çift ödül: büyük çift değer + üstü çizili normal değer.
              Yalnız çift değeri göstermek "bu görev zaten böyle
              değerliymiş" diye okunuyordu; fark görünmeliydi.
            */}
            <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="reward-pill inline-flex items-center gap-1 rounded-full bg-xp px-2 py-0.5 text-[11px] font-extrabold text-[#06283a]">
                <Icon name="zap" className="h-3 w-3" />+{task.xp * 2}
                <s className="ml-0.5 font-bold opacity-60">+{task.xp}</s>
              </span>
              <span className="reward-pill inline-flex items-center gap-1 rounded-full bg-coin px-2 py-0.5 text-[11px] font-extrabold text-[#3a2a00]">
                <Icon name="coins" className="h-3 w-3" />+{task.coin * 2}
                <s className="ml-0.5 font-bold opacity-60">+{task.coin}</s>
              </span>
            </span>

            <span className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-coin">
              <Icon name="timer" className="h-3.5 w-3.5" />
              <Countdown endsAt={endsAt} initialLabel={initialLabel} />
            </span>
          </span>

          <Icon
            name="chevron-right"
            className="h-4 w-4 shrink-0 text-ink-muted"
          />
        </Link>
      </div>
    </section>
  );
}
