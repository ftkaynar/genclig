import Link from "next/link";

import { Icon } from "@/components/ui/icon";
import { PERIODS, SCOPES } from "@/lib/leaderboard/queries";

/*
  Sıralama filtreleri — görev ekranıyla aynı dil.

  ÖNCEKİ SORUN: altı kapsam (Türkiye, İl, İlçe, Mahalle, Arkadaşlar,
  Takımlar) tek bir yatay şeritte yan yana duruyordu. Takımlar diğer
  beşiyle aynı türden değil — farklı bir liste, farklı bir satır şekli,
  "benim sıram" bandı orada hiç yok — ama şeritte eşit bir çip gibi
  görünüyordu. Şerit ayrıca ekrana sığmıyor, Takımlar çoğu telefonda
  kaydırılmadan görünmüyordu.

  Yeni yapı üç katman, görev ekranındaki (task-filters.tsx) kalıbın aynısı:
    1. Bireysel | Takım segment anahtarı — kayan gradyan gösterge
    2. Alan çipleri (Türkiye / İl / İlçe / Mahalle)
    3. Dönem segmenti (Bu Hafta / Bu Ay / Tümü)

  Alan çipleri Takım modunda gizleniyor: takım sıralaması coğrafi kapsam
  almıyor (getTeamLeaderboard yalnızca dönem alıyor), çipleri orada
  göstermek çalışmayan bir filtre vaat ederdi.

  Filtreler URL'de taşınıyor (?kapsam=, ?donem=); yeni bir parametre
  eklenmedi — "Takım" tek bir kapsam değeri (takimlar), bu yüzden mod
  anahtarı da aynı parametreyi yazıyor.

  Kapsam ikonları hiyerarşiyi anlatıyor: Türkiye globe, il/ilçe/mahalle
  giderek daralan konum katmanları.
*/

const SCOPE_ICON: Record<string, string> = {
  turkiye: "globe",
  il: "map-pin",
  ilce: "compass",
  mahalle: "home",
  takimlar: "shield",
};

/** Takım kapsamı mod anahtarına taşındı; çip şeridinde yeri yok. */
const TEAM_SCOPE = "takimlar";

const PERSONAL_SCOPES = SCOPES.filter((item) => item.key !== TEAM_SCOPE);

function href(scope: string, period: string): string {
  return `/siralama?kapsam=${scope}&donem=${period}`;
}

export function ScopeTabs({
  scope,
  period,
}: {
  scope: string;
  period: string;
}) {
  const isTeams = scope === TEAM_SCOPE;

  /*
    Takımdan bireysele dönerken Türkiye'ye düşülüyor: takım modundayken
    saklanacak bir alan seçimi yok. Ayrı bir "son seçilen alan"
    parametresi denendi ve elendi — URL'i paylaşılabilir tutmak için tek
    kapsam parametresi yeterli, ikinci parametre yalnızca karmaşa katıyordu.
  */
  const personalHref = href(isTeams ? "turkiye" : scope, period);

  return (
    <div className="border-b border-edge px-4 pb-3.5 pt-3">
      {/* -------------------------------------------- 1. Bireysel | Takım */}
      <div
        role="group"
        aria-label="Sıralama kapsamı"
        className="relative flex rounded-full border border-edge bg-card p-1"
      >
        {/* Kayan gösterge: seçili yarıya kayıyor. */}
        <span
          aria-hidden
          className={`brand-gradient absolute inset-y-1 w-[calc(50%-0.25rem)] rounded-full transition-all duration-300 ease-out ${
            isTeams ? "left-1/2" : "left-1"
          }`}
        />

        <Link
          href={personalHref}
          aria-pressed={!isTeams}
          className={`relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-xs font-semibold transition-colors ${
            isTeams ? "text-ink-muted hover:text-ink" : "text-white"
          }`}
        >
          <Icon name="user" className="h-4 w-4" />
          Bireysel
        </Link>

        <Link
          href={href(TEAM_SCOPE, period)}
          aria-pressed={isTeams}
          className={`relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-xs font-semibold transition-colors ${
            isTeams ? "text-white" : "text-ink-muted hover:text-ink"
          }`}
        >
          <Icon name="shield" className="h-4 w-4" />
          Takım
        </Link>
      </div>

      {/* ------------------------------------------------- 2. Alan çipleri */}
      {isTeams ? null : (
        <nav aria-label="Alan" className="mt-3">
          <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {PERSONAL_SCOPES.map((item) => {
              const isActive = item.key === scope;
              return (
                <li key={item.key} className="shrink-0">
                  <Link
                    href={href(item.key, period)}
                    aria-current={isActive ? "page" : undefined}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      isActive
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-edge bg-card text-ink-muted hover:text-ink"
                    }`}
                  >
                    <Icon
                      name={SCOPE_ICON[item.key] ?? "trophy"}
                      className="h-3.5 w-3.5"
                    />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      {/* ---------------------------------------------------- 3. Dönem */}
      {/*
        Dönem segmenti bilerek çiplerden farklı bir kontrol: üç satır aynı
        görünseydi hangisinin neyi filtrelediği okunmuyordu. Tam genişlikte
        bölünmüş bir anahtar, kapsam çiplerinden ayrı bir eksen olduğunu
        söylüyor.
      */}
      <nav aria-label="Dönem" className="mt-3">
        <ul className="flex rounded-full border border-edge bg-card p-1">
          {PERIODS.map((item) => {
            const isActive = item.key === period;
            return (
              <li key={item.key} className="flex-1">
                <Link
                  href={href(scope, item.key)}
                  aria-current={isActive ? "page" : undefined}
                  className={`block rounded-full py-1.5 text-center text-[11px] transition-colors ${
                    isActive
                      ? "bg-xp/20 font-semibold text-xp"
                      : "font-medium text-ink-muted hover:text-ink"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
