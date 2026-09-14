import { Icon } from "@/components/ui/icon";

export type LevelNode = {
  level: number;
  minXp: number;
  /** Bu seviyeye ulaşınca kesişen rozetler (XP eşikli rozetler). */
  badges: { name: string; icon: string | null }[];
};

/*
  Seviye Yolu.

  Dikey bir yol: mevcut seviye vurgulu, sonraki beş seviye düğüm olarak
  sıralı, aralarında ilerlemeyi gösteren çizgi. XP eşiği o seviyeye denk
  gelen rozetler düğümün yanında ikonla beliriyor.

  Yeni tablo YOK: tamamı `levels` ve `badges` verisinden türetiliyor.
  Rozet eşleşmesi yalnızca `xp_total` kriterli rozetlerde mümkün — diğer
  kriterler (görev sayısı, kategori, bildirim) XP'ye çevrilemiyor, bu
  yüzden yolda görünmüyorlar. Bu bilinçli: uydurma bir eşleştirme,
  kullanıcıya yanlış bir hedef gösterirdi.
*/
export function LevelPath({
  currentLevel,
  currentXp,
  nodes,
}: {
  currentLevel: number;
  currentXp: number;
  nodes: LevelNode[];
}) {
  if (nodes.length === 0) return null;

  return (
    <section className="mt-5">
      <h2 className="text-sm font-semibold text-ink">Seviye Yolu</h2>
      <p className="mt-0.5 text-[11px] text-ink-muted">
        Sıradaki seviyeler ve yolda açılan rozetler.
      </p>

      <ol className="mt-3 flex flex-col">
        {nodes.map((node, index) => {
          const reached = node.level <= currentLevel;
          const isCurrent = node.level === currentLevel;
          const remaining = node.minXp - currentXp;
          const isLast = index === nodes.length - 1;

          return (
            <li key={node.level} className="flex gap-3">
              {/* Sol sütun: düğüm + bağlantı çizgisi. */}
              <span className="flex flex-col items-center">
                <span
                  className={
                    isCurrent
                      ? "brand-gradient nav-glow flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                      : reached
                        ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary"
                        : "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-edge bg-card text-sm font-bold text-ink-muted"
                  }
                >
                  {node.level}
                </span>
                {!isLast ? (
                  <span
                    className={`w-0.5 flex-1 ${
                      reached ? "bg-primary/40" : "bg-edge"
                    }`}
                    style={{ minHeight: 28 }}
                  />
                ) : null}
              </span>

              {/* Sağ sütun: başlık, kalan XP, rozetler. */}
              <span className="flex-1 pb-4">
                <span className="flex items-baseline justify-between gap-2">
                  <span
                    className={`text-sm font-semibold ${
                      isCurrent ? "text-primary" : "text-ink"
                    }`}
                  >
                    Seviye {node.level}
                    {isCurrent ? " · şu an buradasın" : ""}
                  </span>
                  <span className="shrink-0 text-[11px] font-medium text-ink-muted">
                    {reached
                      ? `${node.minXp} XP`
                      : `${remaining} XP kaldı`}
                  </span>
                </span>

                {node.badges.length > 0 ? (
                  <span className="mt-1.5 flex flex-wrap gap-1.5">
                    {node.badges.map((badge) => (
                      <span
                        key={badge.name}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          reached
                            ? "bg-coin/15 text-coin"
                            : "bg-surface text-ink-muted"
                        }`}
                      >
                        <Icon name={badge.icon ?? "award"} className="h-3 w-3" />
                        {badge.name}
                      </span>
                    ))}
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
