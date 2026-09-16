import Link from "next/link";

import { HScroll } from "@/components/ui/h-scroll";
import { Icon } from "@/components/ui/icon";

/*
  Görev ekranı filtreleri.

  İki katman: üstte Bireysel|Takım segmentli anahtarı, altında tip çipleri.
  Segment anahtarında seçili durum gradyanlı bir "gösterge" olarak kayıyor —
  iki seçenek arasında hangisinin açık olduğu tek bakışta anlaşılsın.

  Filtreler URL üzerinden taşınıyor (?tip=, ?kapsam=), client state değil:
  sayfa sunucuda render ediliyor ve filtre sorguya giriyor. URL ayrıca
  paylaşılabilir ve geri tuşuyla çalışıyor.
*/

export const TASK_TYPE_TABS = [
  { key: "", label: "Tümü", icon: "list-checks" },
  { key: "continuous", label: "Sürekli", icon: "activity" },
  { key: "instant", label: "Anlık", icon: "zap" },
] as const;

export const TASK_SCOPES = [
  { key: "individual", label: "Bireysel", icon: "user" },
  { key: "team", label: "Takım", icon: "users" },
] as const;

export function buildTaskHref(tip: string, kapsam: string): string {
  const params = new URLSearchParams();
  if (tip) params.set("tip", tip);
  if (kapsam) params.set("kapsam", kapsam);
  const query = params.toString();
  return query ? `/gorevler?${query}` : "/gorevler";
}

/**
 * Bireysel | Takım segmentli anahtarı.
 *
 * Üçüncü bir konum ("Hepsi") bilerek yok: segment anahtarı iki durumlu
 * olduğunda kayan gösterge okunabiliyor, üç durumda anahtar olmaktan çıkıp
 * sıradan bir sekme şeridine dönüyordu. "Hepsi"ye dönüş, seçili tarafa
 * tekrar dokunarak yapılıyor.
 */
export function ScopeSwitch({
  activeScope,
  activeTab,
}: {
  activeScope: string;
  activeTab: string;
}) {
  return (
    <div
      role="group"
      aria-label="Görev kapsamı"
      className="relative flex rounded-full border border-edge bg-card p-1"
    >
      {/* Kayan gösterge: seçili yoksa gizli, varsa ilgili yarıya kayıyor. */}
      <span
        aria-hidden
        className={`brand-gradient absolute inset-y-1 w-[calc(50%-0.25rem)] rounded-full transition-all duration-300 ease-out ${
          activeScope === "individual"
            ? "left-1 opacity-100"
            : activeScope === "team"
              ? "left-[calc(50%+0.0rem)] opacity-100"
              : "left-1 opacity-0"
        }`}
      />

      {TASK_SCOPES.map((item) => {
        const isActive = item.key === activeScope;
        return (
          <Link
            key={item.key}
            // Seçiliyken tekrar dokunmak filtreyi kaldırıyor.
            href={buildTaskHref(activeTab, isActive ? "" : item.key)}
            aria-pressed={isActive}
            className={`relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-xs font-semibold transition-colors ${
              isActive ? "text-white" : "text-ink-muted hover:text-ink"
            }`}
          >
            <Icon name={item.icon} className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

/**
 * Tip çipleri: Tümü / Sürekli / Anlık, her birinde kaç görev olduğunu
 * gösteren sayı rozeti.
 *
 * Sayılar sunucuda hesaplanıyor; kullanıcı boş bir sekmeye tıklayıp
 * "hiç görev yok" ekranıyla karşılaşmasın diye.
 */
export function TypeChips({
  counts,
  activeTab,
  activeScope,
}: {
  counts: Record<string, number>;
  activeTab: string;
  activeScope: string;
}) {
  return (
    /*
      Tip çipleri de ortak şeride geçti (D34 FAZ SH).

      Önceden ham bir overflow-x-auto kabıydı: masaüstünde tarayıcının
      gri kaydırma çubuğu görünüyordu ve taşma olduğunda ok yoktu —
      kapsam çipleri (ScopeTabs) ise zaten HScroll kullanıyordu. Aynı
      ekranda iki şerit iki ayrı şekilde davranıyordu.
    */
    <nav aria-label="Görev türü">
      <HScroll as="ul" ariaLabel="Görev türü filtresi">
        {TASK_TYPE_TABS.map((tab) => {
          const isActive = tab.key === activeTab;
          const count = counts[tab.key] ?? 0;

          return (
            <li key={tab.key || "all"} className="shrink-0">
              <Link
                href={buildTaskHref(tab.key, activeScope)}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-edge bg-card text-ink-muted hover:text-ink"
                }`}
              >
                <span className="relative flex items-center">
                  <Icon name={tab.icon} className="h-3.5 w-3.5" />
                  {/* Anlık görevlerde yanıp sönen canlı noktası:
                      "şu an açık, süresi işliyor" sinyali. */}
                  {tab.key === "instant" && count > 0 ? (
                    <span
                      aria-hidden
                      className="live-dot absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-status-warning"
                    />
                  ) : null}
                </span>
                {tab.label}
                <span
                  className={`rounded-full px-1.5 text-[10px] font-bold ${
                    isActive
                      ? "bg-primary text-white"
                      : "bg-surface text-ink-muted"
                  }`}
                >
                  {count}
                </span>
              </Link>
            </li>
          );
        })}
      </HScroll>
    </nav>
  );
}
