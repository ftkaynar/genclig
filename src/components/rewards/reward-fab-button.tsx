"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";

import { Icon } from "@/components/ui/icon";

/*
  Ödül FAB'ı v2 — sürüklenebilir, kenara yapışan yüzen düğme (D35 FAZ F).

  NEDEN SÜRÜKLENEBİLİR: FAB sağ altta sabitti ve orada duran her şeyin
  üstünü kapatıyordu — görev kartının ödül şeridi, sohbetin son mesajı,
  sıralamada "benim sıram" bandının sağ ucu. Kullanıcının kapatabildiği
  bir düğme yapmak denendi ve elendi: kapatılan FAB bir daha
  açılamıyordu ve ödül mağazasına giden tek kısa yol kayboluyordu.
  Taşınabilir bir düğme hem engeli kaldırıyor hem kısayolu koruyor.

  NEDEN YALNIZ SOL/SAĞ KENAR: serbest bırakılan bir düğme ekranın
  ortasında kalırsa içeriğin tam üstünde durur ve durumu daha da
  kötüleştirir. Yatayda iki kararlı nokta var, dikeyde serbest.

  Konum localStorage'da: her ekranda yeni bir FAB örneği monte ediliyor
  (sunucu bileşeni her sayfada ayrı çağrılıyor), bu yüzden konum React
  ağacında tutulamaz. Sunucuya yazmak da denenmedi — kişisel ve
  cihaza özgü bir tercih, oraya taşımak gereksiz bir tur demekti.
*/

const POS_KEY = "genclig.reward-fab.pos";
const TIP_KEY = "genclig.reward-fab.tip";

type Side = "left" | "right";
type Pos = { side: Side; topPct: number };

/** Düğme çapı (globals.css .reward-fab ile aynı). */
const SIZE = 56;
/** Kenar boşluğu. */
const EDGE = 16;
/*
  Dikey sınırlar.

  Üst: HUD çubuğunun altı. Alt: alt gezinmenin üstü — 100px
  .above-bottom-nav ile AYNI sayı (D32 FAZ NAV2'de ekran görüntüsü
  taranarak ölçüldü; tahmin edilen 85px yanlıştı). İkisi ayrı yerde
  yazıldığı için buraya not düşüldü: biri değişirse diğeri de değişmeli.
*/
const TOP_LIMIT = 72;
const BOTTOM_LIMIT = 100 + SIZE + 8;

// ---------------------------------------------------------------------------
// Depolar
// ---------------------------------------------------------------------------

/*
  useSyncExternalStore kullanılıyor, useEffect + setState değil.

  Depodan okunan değeri effect içinde state'e yazmak `react-hooks/
  set-state-in-effect` kuralına takılıyordu (D32'de aynı sorunu
  yaşamıştık). getServerSnapshot boş dize döndürüyor: sunucu
  varsayılan konumu çiziyor, hydration sonrası istemci kayıtlı konuma
  geçiyor ve uyuşmazlık uyarısı çıkmıyor.
*/
const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

function readLocal(): string {
  try {
    return window.localStorage.getItem(POS_KEY) ?? "";
  } catch {
    // Gizli sekme ya da site verisi kapalı: varsayılan konum.
    return "";
  }
}

function emptySnapshot(): string {
  return "";
}

function writePos(pos: Pos): void {
  try {
    window.localStorage.setItem(POS_KEY, JSON.stringify(pos));
  } catch {
    // Yazılamıyorsa konum bu oturumda geçerli, kalıcı değil.
  }
  for (const listener of listeners) listener();
}

/** Kayıtlı konumu ayrıştırır; bozuk veri varsayılana düşüyor. */
function parsePos(raw: string): Pos | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<Pos>;
    const side: Side = value.side === "left" ? "left" : "right";
    const topPct = typeof value.topPct === "number" ? value.topPct : NaN;
    if (!Number.isFinite(topPct)) return null;
    return { side, topPct: Math.min(1, Math.max(0, topPct)) };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------

type DragState =
  | { kind: "idle" }
  /** Parmak basılı, henüz eşiği geçmedi ya da geçti: canlı piksel konum. */
  | { kind: "drag"; x: number; y: number }
  /** Bırakıldı, kenara kayıyor: hedef piksel konum + geçiş sınıfı. */
  | { kind: "settle"; x: number; y: number };

export function RewardFabButton({
  hasReady,
  hasNew,
}: {
  /** Şu anda alınabilecek en az bir ödül var. */
  hasReady: boolean;
  /** Alınabilir ödüllerden en az biri YENİ (son 7 gün). */
  hasNew: boolean;
}) {
  const raw = useSyncExternalStore(subscribe, readLocal, emptySnapshot);
  const stored = parsePos(raw);

  const [drag, setDrag] = useState<DragState>({ kind: "idle" });

  /*
    Sürükleme takibi ref'te, state'te değil: her pointermove'da state
    yazmak yeterli ama başlangıç noktası ve hız örneği RENDER'ı
    etkilemiyor — state'e koymak gereksiz bir render turu demekti.
  */
  const track = useRef({
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0,
    lastX: 0,
    lastY: 0,
    lastT: 0,
    vx: 0,
    vy: 0,
    moved: false,
  });

  /*
    İpucu oturum başına bir kez — animasyonu başlatan sınıf EFFECT'TE
    ekleniyor, render'da değil.

    ÖLÇÜLEN SORUN: ilk sürüm ipucunu useSyncExternalStore ile
    sessionStorage üzerinden okuyor, "görüldü" işaretini de kendi
    effect'inde yazıyordu. İki effect yarışıyordu: deponun hydration
    sonrası kontrolü yeniden render planlıyor, arkasından benim
    effect'im işareti yazıyor, planlanan render getSnapshot'ı TEKRAR
    çağırıp artık "görüldü" okuyordu. Sonuç: ipucu HİÇ görünmüyordu
    (headless Chrome ölçümünde iki sayfada da false).

    Şimdi ipucu her zaman DOM'da ama CSS ile gizli; görünürlüğü tek bir
    sınıf açıyor. State yok, depo yok, hydration uyuşmazlığı yok —
    sunucu ile istemci aynı işaretlemeyi üretiyor.
  */
  const tipRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const el = tipRef.current;
    if (!el) return;

    try {
      if (window.sessionStorage.getItem(TIP_KEY)) return;
      window.sessionStorage.setItem(TIP_KEY, "1");
    } catch {
      /*
        Oturum deposu kapalı (gizli sekme, site verisi engelli): ipucu
        hiç gösterilmiyor. Her sayfada göstermek denendi ve elendi —
        bir kerelik ipucu kalıcı bir gürültüye dönüşüyordu.
      */
      return;
    }

    el.classList.add("reward-fab-tip-show");
  }, []);

  function onPointerDown(event: React.PointerEvent<HTMLAnchorElement>) {
    // Yalnız birincil düğme / tek dokunuş. Sağ tık sürükleme başlatmıyor.
    if (event.button !== 0) return;

    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.setPointerCapture(event.pointerId);

    track.current = {
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      lastX: event.clientX,
      lastY: event.clientY,
      lastT: event.timeStamp,
      vx: 0,
      vy: 0,
      moved: false,
    };

    setDrag({ kind: "drag", x: rect.left, y: rect.top });
  }

  function onPointerMove(event: React.PointerEvent<HTMLAnchorElement>) {
    if (drag.kind !== "drag") return;

    const t = track.current;
    const dt = Math.max(1, event.timeStamp - t.lastT);

    t.vx = (event.clientX - t.lastX) / dt;
    t.vy = (event.clientY - t.lastY) / dt;
    t.lastX = event.clientX;
    t.lastY = event.clientY;
    t.lastT = event.timeStamp;

    /*
      DOKUNMA / SÜRÜKLEME EŞİĞİ: 8px.

      Eşik olmadan parmağın doğal titremesi her dokunuşu sürüklemeye
      çeviriyor ve bağlantı hiç açılmıyordu. 8px, bir dokunuşun tipik
      kaymasının üstünde ama kasıtlı bir hareketin çok altında.
    */
    if (
      !t.moved &&
      Math.abs(event.clientX - t.startX) + Math.abs(event.clientY - t.startY) > 8
    ) {
      t.moved = true;
    }

    setDrag({
      kind: "drag",
      x: event.clientX - t.offsetX,
      y: event.clientY - t.offsetY,
    });
  }

  function finish(event: React.PointerEvent<HTMLAnchorElement>) {
    if (drag.kind !== "drag") return;

    const t = track.current;

    if (!t.moved) {
      // Dokunma: konumu değiştirme, bağlantı açılsın.
      setDrag({ kind: "idle" });
      return;
    }

    const w = window.innerWidth;
    const h = window.innerHeight;

    /*
      ATALET: bırakma hızının 140ms'lik izdüşümü.

      Gerçek bir fizik döngüsü (her karede sönümleme) denendi ve
      elendi — 56px'lik bir düğme için görülebilir bir fark yaratmıyor,
      karşılığında bir animasyon döngüsü ve iptal mantığı geliyordu.
      Tek adımlık izdüşüm, "fırlatma" hissini CSS geçişiyle veriyor.
    */
    const PROJECT = 140;
    const projX = drag.x + t.vx * PROJECT;
    const projY = drag.y + t.vy * PROJECT;

    // Yatayda iki kararlı nokta: düğmenin MERKEZİ hangi yarıdaysa o kenar.
    const side: Side = projX + SIZE / 2 < w / 2 ? "left" : "right";
    const targetX = side === "left" ? EDGE : w - EDGE - SIZE;

    const maxY = Math.max(TOP_LIMIT, h - BOTTOM_LIMIT);
    const targetY = Math.min(maxY, Math.max(TOP_LIMIT, projY));

    /*
      Yüzde olarak saklanıyor, piksel olarak değil: telefon yatay
      çevrildiğinde ya da klavye açıldığında sabit piksel değeri
      ekranın dışına düşüyordu. CSS clamp'i zaten sınırları yeniden
      uyguluyor.
    */
    writePos({ side, topPct: h > 0 ? targetY / h : 0 });

    /*
      Hedef bırakılan yerle AYNIYSA geçiş hiç tetiklenmiyor, dolayısıyla
      transitionend de gelmiyor ve durum "settle"de takılı kalıyordu
      (düğme çalışmaya devam ediyor ama .reward-fab-settle sınıfı ve
      satır içi piksel konumu üzerinde kalıyor). Doğrudan idle'a
      geçiliyor: CSS ile sınırlanan konum aynı noktayı gösteriyor.
    */
    if (Math.round(targetX) === Math.round(drag.x) &&
        Math.round(targetY) === Math.round(drag.y)) {
      setDrag({ kind: "idle" });
    } else {
      setDrag({ kind: "settle", x: targetX, y: targetY });
    }

    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }

  function onClick(event: React.MouseEvent<HTMLAnchorElement>) {
    // Sürüklenen düğme bağlantı açmıyor: ödül mağazası kazara açılmasın.
    if (track.current.moved) {
      event.preventDefault();
      track.current.moved = false;
    }
  }

  // ---------------------------------------------------------------- görünüm

  const dragging = drag.kind === "drag";
  const settling = drag.kind === "settle";
  const floating = dragging || settling;

  const style: CSSProperties = floating
    ? { left: `${drag.x}px`, top: `${drag.y}px`, right: "auto", bottom: "auto" }
    : stored
      ? ({ "--fab-top": stored.topPct } as CSSProperties)
      : {};

  const anchorClass = floating
    ? ""
    : stored
      ? `reward-fab-placed ${stored.side === "left" ? "left-4" : "right-4"}`
      : "above-bottom-nav right-4";

  return (
    <Link
        href="/oduller"
        aria-label={
          hasNew
            ? "Ödül mağazası — yeni ödül var"
            : hasReady
              ? "Ödül mağazası — alabileceğin ödül var"
              : "Ödül mağazası"
        }
        draggable={false}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        onClick={onClick}
        onTransitionEnd={() => {
          /*
            Kayma bitti: piksel konumdan CSS ile sınırlanan konuma
            geçiliyor. İkisi aynı noktayı gösteriyor (hedef de aynı
            clamp ile hesaplandı), bu yüzden gözle görülür bir zıplama
            yok.
          */
          if (drag.kind === "settle") setDrag({ kind: "idle" });
        }}
        style={style}
        className={`reward-fab fixed z-40 ${anchorClass} ${
          dragging ? "reward-fab-dragging" : ""
        } ${settling ? "reward-fab-settle" : ""}`}
      >
        {/* Dönen parıltı halkası — düğmenin arkasında, ikonu kapatmıyor. */}
        <span aria-hidden className="reward-fab-ring" />
        {/* Periyodik ışık süpürmesi. */}
        <span aria-hidden className="reward-fab-sweep" />

        <Icon name="gift" className="relative z-10 h-6 w-6" />

        {hasNew ? (
          <span aria-hidden className="reward-fab-new">
            YENİ
          </span>
        ) : hasReady ? (
          /*
            Yeni kampanya yoksa SADE NABIZ: "YENİ" etiketini her
            alınabilir ödülde göstermek kelimeyi anlamsızlaştırıyordu —
            her zaman yeni olan hiçbir zaman yeni değil.
          */
          <span aria-hidden className="reward-fab-dot" />
        ) : null}

        <span aria-hidden ref={tipRef} className="reward-fab-tip">
          Ödül Mağazası
        </span>
    </Link>
  );
}
