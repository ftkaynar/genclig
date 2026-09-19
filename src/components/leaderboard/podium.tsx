import { Icon } from "@/components/ui/icon";
import { formatPoints } from "@/lib/points/queries";

/*
  Podyum v2.

  ÖNCEKİ DÜZEN: üç basamak yan yana, ortadaki daha yüksek. Telefonda üç
  sütun 120px'e sıkışıyor, isimler kırpılıyor ve birincinin "zirve"
  olduğu okunmuyordu — üç kutu birbirine çok benziyordu.

  v2: birinci TEK BAŞINA üstte ve büyük ("Zirve"), ikinci ve üçüncü
  ALTINDA YAN YANA iki eşit kutu. Böylece hiyerarşi boyutla değil
  konumla anlatılıyor ve iki eşit kutu telefonda rahat sığıyor.

  Aynı düzen takım sıralamasında da kullanılıyor; bu yüzden bileşen
  kullanıcıya değil genel bir "yarışmacı" şekline bağlı.
*/

export type PodiumEntry = {
  rank: number;
  id: string;
  name: string;
  /** Kullanıcıda "Seviye 7", takımda "5 üye". */
  subtitle: string;
  totalXp: number;
  /** Takımda takım ikonu; kullanıcıda null (baş harf gösteriliyor). */
  icon?: string | null;
};

const TONE: Record<number, { ring: string; badge: string; glow: string }> = {
  1: {
    ring: "border-[#d4a02c]",
    badge: "bg-[#d4a02c] text-[#3a2a00]",
    glow: "shadow-[0_0_24px_rgba(212,160,44,0.35)]",
  },
  2: {
    ring: "border-[#9aa6b8]",
    badge: "bg-[#9aa6b8] text-[#101720]",
    glow: "",
  },
  3: {
    ring: "border-[#b07b4f]",
    badge: "bg-[#b07b4f] text-white",
    glow: "",
  },
};

function Avatar({
  entry,
  size,
  ring,
}: {
  entry: PodiumEntry;
  size: string;
  ring: string;
}) {
  return (
    <span
      className={`flex ${size} items-center justify-center rounded-full border-2 ${ring} bg-surface font-bold text-ink`}
    >
      {entry.icon ? (
        <Icon name={entry.icon} className="h-1/2 w-1/2" />
      ) : (
        entry.name.charAt(0).toUpperCase()
      )}
    </span>
  );
}

/** İkinci ve üçüncü için eşit kutu. */
function RunnerUp({
  entry,
  highlight,
}: {
  entry: PodiumEntry;
  highlight: boolean;
}) {
  const tone = TONE[entry.rank] ?? TONE[3];

  return (
    <div
      className={`flex min-w-0 flex-1 flex-col items-center rounded-2xl border bg-surface px-2 py-3 ${
        highlight ? "border-primary/60" : "border-edge"
      }`}
    >
      <span className="relative">
        <Avatar entry={entry} size="h-11 w-11" ring={tone.ring} />
        <span
          className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${tone.badge}`}
        >
          {entry.rank}
        </span>
      </span>

      <span
        className={`mt-2 max-w-full truncate text-xs font-semibold ${
          highlight ? "text-primary-ink" : "text-ink"
        }`}
      >
        {entry.name}
      </span>
      <span className="max-w-full truncate text-[10px] text-ink-muted">
        {entry.subtitle}
      </span>
      <span className="mt-1 rounded-full bg-xp/15 px-2 py-0.5 text-[11px] font-bold text-xp">
        {formatPoints(entry.totalXp)}
      </span>
    </div>
  );
}

export function Podium({
  entries,
  currentId,
}: {
  entries: PodiumEntry[];
  /** Vurgulanacak kullanıcı ya da takım kimliği. */
  currentId: string;
}) {
  const first = entries.find((e) => e.rank === 1);
  const second = entries.find((e) => e.rank === 2);
  const third = entries.find((e) => e.rank === 3);

  if (!first) return null;

  const firstTone = TONE[1];
  const firstMine = first.id === currentId;

  return (
    <section className="anim-stagger rounded-2xl border border-edge bg-card p-4">
      <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-ink">
        <Icon name="trophy" className="h-4 w-4 text-coin" />
        Zirve
      </h2>

      {/* ------------------------------------------------- 1. tek başına */}
      <div
        className={`flex flex-col items-center rounded-2xl border-2 px-3 py-4 ${firstTone.ring} ${firstTone.glow} ${
          firstMine ? "bg-primary/10" : "bg-surface"
        }`}
      >
        <Icon name="crown" className="mb-1 h-6 w-6 text-[#d4a02c]" />

        <span className="relative">
          <Avatar entry={first} size="h-16 w-16 text-xl" ring={firstTone.ring} />
          <span
            className={`absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${firstTone.badge}`}
          >
            1
          </span>
        </span>

        <span
          className={`mt-2 max-w-full truncate text-sm font-bold ${
            firstMine ? "text-primary-ink" : "text-ink"
          }`}
        >
          {first.name}
        </span>
        <span className="max-w-full truncate text-[11px] text-ink-muted">
          {first.subtitle}
        </span>
        <span className="mt-1.5 rounded-full bg-xp/20 px-3 py-1 text-sm font-bold text-xp">
          {formatPoints(first.totalXp)} XP
        </span>
      </div>

      {/* --------------------------------------- 2. ve 3. yan yana, eşit */}
      {second || third ? (
        <div className="mt-2.5 flex gap-2.5">
          {second ? (
            <RunnerUp entry={second} highlight={second.id === currentId} />
          ) : (
            <div className="flex-1" />
          )}
          {third ? (
            <RunnerUp entry={third} highlight={third.id === currentId} />
          ) : (
            <div className="flex-1" />
          )}
        </div>
      ) : null}
    </section>
  );
}
