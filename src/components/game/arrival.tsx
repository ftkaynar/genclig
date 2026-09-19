"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { Icon } from "@/components/ui/icon";

/*
  Girişte "neler oldu" anı — kazanç sayacı + seviye/rozet kutlaması.

  Son görülen durum localStorage'da, CİHAZ BAZLI. Sunucuda tutmak
  denendi ve elendi: "kullanıcı bunu gördü mü" bilgisi cihaza ait, çünkü
  aynı hesap telefonda ve masaüstünde ayrı ayrı açılıyor ve kutlamayı
  ikisinde de görmek doğru. Sunucuda tutsaydık ikinci cihazda hiç
  görünmezdi.

  Delta yoksa hiçbir şey gösterilmiyor — her açılışta patlayan konfeti
  birkaç günde sıradanlaşıyor ve kutlama değerini yitiriyor.

  İlk ziyarette de gösterilmiyor: kayıtlı bir değer yoksa mevcut durum
  "başlangıç" olarak yazılıyor. Aksi hâlde yeni kullanıcı uygulamayı ilk
  açtığında "SEVİYE 1!" kutlaması görüyordu.
*/

const KEY = "genclig-last-seen-state";

type Seen = { xp: number; coin: number; level: number; badges: number };

function readSeen(): Seen | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Seen) : null;
  } catch {
    // Gizli sekme / site verisi engelli: kutlama atlanıyor, akış sürüyor.
    return null;
  }
}

function writeSeen(value: Seen) {
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // Yazılamazsa da uygulama çalışmaya devam ediyor.
  }
}

/*
  ÖLÇÜLEN HATA (D32 FAZ D2): seviye atlama pop-up'ı kullanıcıda HİÇ
  görünmedi. Karar mantığı bire bir taklit edilip dört senaryoda
  koşuldu:

    1. ilk açılış, sonra TAM YENİLEME ile seviye atlama -> POPUP ✓
    2. ilk açılış, sonra İSTEMCİ TARAFI gezinme ile dönüş -> HİÇBİR ŞEY
    3. uygulamada kalarak router.refresh ile atlama    -> HİÇBİR ŞEY
    4. Arrival yalnız ana sayfada                      -> profilde yok

  Sebep: "son görülen durum" MODÜL düzeyinde bir kez önbelleğe
  alınıyordu (`cachedSeen`) ve oturum boyunca asla tazelenmiyordu.
  İlk açılışta null okunuyor (baseline yok, doğru), ama kullanıcı
  görevi tamamlayıp ana sayfaya İSTEMCİ TARAFI gezinmeyle döndüğünde
  modül hâlâ yüklü ve önbellek hâlâ null — pop-up asla çıkmıyordu.
  Yalnızca tam sayfa yenilemesi modülü yeniden yükleyip baseline'ı
  okuyordu; kullanıcı normalde tam yenileme yapmıyor.

  DÜZELTME: önbellek BİLEŞEN ÖRNEĞİ düzeyine indi (useRef). Her
  mount taze okuyor; aynı örnek içinde sabit kalıyor (kutlama kendi
  yazdığı değeri okuyup anında kaybolmasın).

  `clientReady` hydration için: sunucuda localStorage yok, ilk render
  her zaman boş. useSyncExternalStore sunucu anlık görüntüsünü ayrı
  verdiği için uyuşmazlık çıkmıyor ve effect içinde setState
  gerekmiyor (`react-hooks/set-state-in-effect`; aynı kurala D22,
  D29 ve D30'da takıldık).
*/
/*
  Bileşen ÖRNEĞİNE ait küçük depo.

  Denenen ve elenen iki alternatif:
    - useRef ile render sırasında okumak: `react-hooks/refs` kuralı
      render sırasında ref okumayı hiç kabul etmiyor (11 hata).
    - useState(() => readSeen()): sunucu null, istemci dolu döner ve
      hydration uyuşmazlığı çıkarır.

  useSyncExternalStore sunucu anlık görüntüsünü ayrı alıyor, depo da
  useState ile ÖRNEK BAŞINA bir kez kuruluyor: her mount taze okuyor,
  aynı örnek içinde sabit kalıyor.
*/
function createSeenStore() {
  let snapshot: Seen | null | undefined;
  return {
    subscribe: () => () => {},
    get: (): Seen | null => {
      if (snapshot === undefined) {
        snapshot = readSeen();
      }
      return snapshot;
    },
  };
}

/** Sayıyı hedefe doğru sayarak artıran küçük bileşen. */
function Counter({
  from,
  to,
  className,
}: {
  from: number;
  to: number;
  className: string;
}) {
  const [value, setValue] = useState(from);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const duration = 900;
    const start = performance.now();
    let frame = 0;

    function tick(now: number) {
      // Yumuşak yavaşlama: doğrusal sayaç mekanik duruyordu.
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + (to - from) * eased));
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      }
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [from, to]);

  return <span className={className}>{value.toLocaleString("tr-TR")}</span>;
}

export function Arrival({
  xp,
  coin,
  level,
  badges,
  unlocked,
}: {
  xp: number;
  coin: number;
  level: number;
  badges: number;
  /** Bu seviyede açılan ödül/rozet adları. */
  unlocked: string[];
}) {
  const [store] = useState(createSeenStore);
  const seen = useSyncExternalStore(
    store.subscribe,
    store.get,
    // Sunucuda localStorage yok; kutlama yalnız istemcide çiziliyor.
    () => null,
  );

  const [closed, setClosed] = useState(false);

  /*
    Yeni durumu YAZMAK bir yan etki, state değil: bu yazım bir sonraki
    ziyaretin karşılaştırma noktasını kuruyor ve bu render'ı
    etkilemiyor.
  */
  useEffect(() => {
    writeSeen({ xp, coin, level, badges });
  }, [xp, coin, level, badges]);

  if (!seen || closed) {
    return null;
  }

  const gainedXp = xp - seen.xp;
  const gainedCoin = coin - seen.coin;
  const levelUp = level > seen.level;
  const newBadges = badges - seen.badges;

  if (gainedXp <= 0 && gainedCoin <= 0 && !levelUp && newBadges <= 0) {
    return null;
  }

  // ------------------------------------------------ seviye atlama: tam ekran
  if (levelUp) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Seviye ${level}`}
        className="fixed inset-0 z-50 flex items-center justify-center bg-brand/85 px-6 backdrop-blur-sm"
      >
        <div className="anim-pop relative w-full max-w-sm overflow-hidden rounded-3xl border border-coin/50 bg-card p-6 text-center">
          {/*
            Parçacıklar saf CSS: on iki span, her biri kendi açısında
            dışa fırlıyor. Kütüphane eklenmedi — kutlama yılda birkaç
            saniye görünen bir efekt için çalışma zamanına animasyon
            motoru sokmak kalıcı yük demekti.
          */}
          <span aria-hidden className="pointer-events-none absolute inset-0">
            {Array.from({ length: 12 }, (_, i) => (
              <span
                key={i}
                className="confetti-bit"
                style={
                  {
                    "--angle": `${i * 30}deg`,
                    "--delay": `${i * 40}ms`,
                  } as React.CSSProperties
                }
              />
            ))}
          </span>

          <span className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-full border-4 border-coin bg-coin/15">
            <Icon name="crown" className="h-9 w-9 text-coin" />
          </span>

          <p className="relative mt-4 text-3xl font-black tracking-tight text-ink">
            SEVİYE {level}!
          </p>
          <p className="relative mt-1 text-sm text-ink-muted">
            {seen.level}. seviyeden {level}. seviyeye çıktın.
          </p>

          {unlocked.length > 0 ? (
            <div className="relative mt-4 rounded-2xl bg-surface p-3 text-left">
              <p className="text-[11px] font-bold uppercase tracking-wide text-primary-ink">
                Yeni açılanlar
              </p>
              <ul className="mt-1.5 flex flex-col gap-1">
                {unlocked.map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-1.5 text-[13px] text-ink"
                  >
                    <Icon name="check" className="h-3.5 w-3.5 text-status-success" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <Button variant="primary" size="lg" block type="button" onClick={() => setClosed(true)}>
            Devam et
          </Button>
        </div>
      </div>
    );
  }

  // ------------------------------------------------ rozet: kısa pop-up
  if (newBadges > 0) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Yeni rozet"
        className="fixed inset-0 z-50 flex items-center justify-center bg-brand/80 px-6 backdrop-blur-sm"
      >
        <div className="anim-pop w-full max-w-xs rounded-3xl border border-coin/50 bg-card p-6 text-center">
          <span className="badge-earned mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-coin/20 text-coin">
            <Icon name="award" className="h-8 w-8" />
          </span>
          <p className="mt-3 text-lg font-bold text-ink">
            {newBadges > 1 ? `${newBadges} yeni rozet!` : "Yeni rozet!"}
          </p>
          <Link
            href="/profil"
            onClick={() => setClosed(true)}
            className="btn-chunky bg-cta mt-4 block w-full rounded-full px-5 py-2.5 text-sm font-bold text-white"
          >
            Rozetlerime bak
          </Link>
          <Button variant="secondary" size="md" block type="button" onClick={() => setClosed(true)}>
            Kapat
          </Button>
        </div>
      </div>
    );
  }

  // ------------------------------------------------ kazanç: sayan şerit
  return (
    <div className="anim-stagger mb-3 flex items-center gap-2.5 rounded-2xl border border-primary/40 bg-primary/10 px-3.5 py-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary-ink">
        <Icon name="sparkles" className="h-4.5 w-4.5" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-bold text-ink">
          Yokken kazandıkların
        </span>
        <span className="flex items-center gap-2 text-[12px] font-semibold">
          {gainedXp > 0 ? (
            <span className="text-xp">
              +<Counter from={0} to={gainedXp} className="tabular-nums" /> XP
            </span>
          ) : null}
          {gainedCoin > 0 ? (
            <span className="text-coin">
              +<Counter from={0} to={gainedCoin} className="tabular-nums" />{" "}
              Token
            </span>
          ) : null}
        </span>
      </span>

      <button
        type="button"
        onClick={() => setClosed(true)}
        aria-label="Kapat"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-muted"
      >
        <Icon name="x" className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
