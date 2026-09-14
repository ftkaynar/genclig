import { Icon } from "@/components/ui/icon";

export type LevelNode = {
  level: number;
  minXp: number;
  /** Bu seviyede açılan rozetler (XP eşikli rozetler). */
  badges: { name: string; icon: string | null }[];
  /** Bu seviyede açılan ödüller. */
  rewards: { title: string }[];
};

/*
  Seviye Yolu v2 — zigzag yol.

  Düğümler sola-sağa alternatif diziliyor ve aralarındaki bağlayıcı çizgi
  ilerledikçe doluyor. Düz dikey liste denenmişti (v1): okunuyordu ama
  "yol" hissi yoktu ve kilometre taşları sıradan satırlar gibi
  duruyordu. Zigzag, her düğümü ayrı bir durak gibi gösteriyor.

  Yeni tablo YOK: tamamı levels + badges + rewards(min_level) verisinden.
  Rozet eşleşmesi yalnızca `xp_total` kriterli rozetlerde mümkün; diğer
  kriterler (görev sayısı, kategori) XP'ye çevrilemiyor ve uydurma bir
  eşleştirme kullanıcıya yanlış hedef gösterirdi.
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
      <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
        <Icon name="trending-up" className="h-4 w-4 text-primary" />
        Seviye Yolu
      </h2>
      <p className="mt-0.5 text-[11px] text-ink-muted">
        Sıradaki duraklar ve yolda açılan ödüller.
      </p>

      <ol className="mt-4 flex flex-col">
        {nodes.map((node, index) => {
          const reached = node.level <= currentLevel;
          const isCurrent = node.level === currentLevel;
          const remaining = node.minXp - currentXp;
          const isLast = index === nodes.length - 1;
          const onLeft = index % 2 === 0;

          const milestones = [
            ...node.badges.map((badge) => ({
              icon: badge.icon ?? "award",
              text: badge.name,
            })),
            ...node.rewards.map((reward) => ({
              icon: "gift",
              text: reward.title,
            })),
          ];

          return (
            <li
              key={node.level}
              className={`relative flex ${
                onLeft ? "flex-row" : "flex-row-reverse"
              } items-start gap-3`}
            >
              {/* ------------------------------------------- düğüm sütunu */}
              <span className="relative flex w-12 shrink-0 flex-col items-center">
                <span
                  className={
                    isCurrent
                      ? "brand-gradient node-pulse flex h-12 w-12 items-center justify-center rounded-full text-base font-bold text-white"
                      : reached
                        ? "flex h-10 w-10 items-center justify-center rounded-full bg-primary/25 text-sm font-bold text-primary ring-2 ring-primary/40"
                        : "flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-edge bg-card text-sm font-bold text-ink-muted"
                  }
                >
                  {reached ? (
                    node.level
                  ) : (
                    <Icon name="lock" className="h-4 w-4" />
                  )}
                </span>

                {/* Bağlayıcı çizgi: geçilen kısım gradyanlı, gelecek gri. */}
                {!isLast ? (
                  <span
                    className={`w-1 flex-1 rounded-full ${
                      reached
                        ? "bg-gradient-to-b from-primary to-indigo"
                        : "bg-edge"
                    }`}
                    style={{ minHeight: milestones.length > 0 ? 56 : 36 }}
                  />
                ) : null}
              </span>

              {/* ------------------------------------------- içerik sütunu */}
              <span
                className={`flex-1 pb-4 ${onLeft ? "text-left" : "text-right"}`}
              >
                <span
                  className={`block text-sm font-semibold ${
                    isCurrent ? "text-primary" : reached ? "text-ink" : "text-ink-muted"
                  }`}
                >
                  Seviye {node.level}
                  {isCurrent ? " · buradasın" : ""}
                </span>

                <span className="block text-[11px] text-ink-muted">
                  {reached ? `${node.minXp} XP` : `${remaining} XP kaldı`}
                </span>

                {/* Mevcut seviyede bir sonrakine ilerleme çubuğu. */}
                {isCurrent && nodes[index + 1] ? (
                  <span className="mt-1.5 block">
                    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-edge">
                      <span
                        className="brand-gradient block h-full rounded-full"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(
                              0,
                              Math.round(
                                ((currentXp - node.minXp) /
                                  Math.max(
                                    1,
                                    nodes[index + 1].minXp - node.minXp,
                                  )) *
                                  100,
                              ),
                            ),
                          )}%`,
                        }}
                      />
                    </span>
                    <span className="mt-0.5 block text-[10px] font-medium text-primary">
                      Seviye {nodes[index + 1].level} için{" "}
                      {nodes[index + 1].minXp - currentXp} XP
                    </span>
                  </span>
                ) : null}

                {/* Kilometre taşları */}
                {milestones.length > 0 ? (
                  <span
                    className={`mt-1.5 flex flex-wrap gap-1 ${
                      onLeft ? "" : "justify-end"
                    }`}
                  >
                    {milestones.map((item) => (
                      <span
                        key={item.text}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          reached
                            ? "bg-coin/15 text-coin"
                            : "bg-surface text-ink-muted"
                        }`}
                      >
                        <Icon name={item.icon} className="h-3 w-3" />
                        {item.text}
                        {!reached ? (
                          <span className="text-[9px] font-normal">
                            · burada açılır
                          </span>
                        ) : null}
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
