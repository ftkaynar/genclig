import Link from "next/link";

import { HScroll } from "@/components/ui/h-scroll";
import { Icon } from "@/components/ui/icon";
import { PERIODS, SCOPES } from "@/lib/leaderboard/queries";

/*
  Sıralama filtreleri — TEK KART (D32 FAZ SR2).

  ÖNCEKİ DURUM: üç ayrı şerit alt alta duruyordu (mod anahtarı, kapsam
  çipleri, dönem segmenti). Üçü farklı yükseklikte, farklı yatay payda ve
  farklı görsel dildeydi; ekranın üçte biri filtreye gidiyor ve hangi
  şeridin neyi süzdüğü okunmuyordu.

  v2: hepsi tek bir çerçeve içinde, aynı yatay hizada, aynı dokunma
  boyutunda (≥40px). Görsel olarak tek bir "filtre kartı" — üç ayrı
  kontrol değil, bir kontrol paneli.

  Alan çipleri Takım modunda gizleniyor: takım sıralaması coğrafi kapsam
  almıyor (getTeamLeaderboard yalnız dönem alıyor), çipleri orada
  göstermek çalışmayan bir filtre vaat ederdi.

  Filtreler URL'de taşınıyor (?kapsam=, ?donem=); yeni parametre yok —
  "Takım" tek bir kapsam değeri.
*/

const SCOPE_ICON: Record<string, string> = {
  turkiye: "globe",
  il: "map-pin",
  ilce: "compass",
  mahalle: "home",
  takimlar: "shield",
};

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
    parametresi denendi ve elendi — tek kapsam parametresi URL'i
    paylaşılabilir tutuyor, ikincisi yalnız karmaşa katıyordu.
  */
  const personalHref = href(isTeams ? "turkiye" : scope, period);

  return (
    <div className="px-4 pb-3 pt-3">
      <div className="rounded-2xl border border-edge bg-card p-2">
        {/* ------------------------------------------ 1. Bireysel | Takım */}
        <div
          role="group"
          aria-label="Sıralama kapsamı"
          className="relative flex rounded-xl bg-surface p-1"
        >
          {/* Kayan gösterge: seçili yarıya kayıyor. */}
          <span
            aria-hidden
            className={`brand-gradient absolute inset-y-1 w-[calc(50%-0.25rem)] rounded-lg transition-all duration-300 ease-out ${
              isTeams ? "left-1/2" : "left-1"
            }`}
          />

          <Link
            href={personalHref}
            aria-pressed={!isTeams}
            className={`relative z-10 flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-lg text-[13px] font-bold transition-colors ${
              isTeams ? "text-ink-muted hover:text-ink" : "text-white"
            }`}
          >
            <Icon name="user" className="h-4 w-4" />
            Bireysel
          </Link>

          <Link
            href={href(TEAM_SCOPE, period)}
            aria-pressed={isTeams}
            className={`relative z-10 flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-lg text-[13px] font-bold transition-colors ${
              isTeams ? "text-white" : "text-ink-muted hover:text-ink"
            }`}
          >
            <Icon name="shield" className="h-4 w-4" />
            Takım
          </Link>
        </div>

        {/* ------------------------------------------------ 2. Alan çipleri */}
        {isTeams ? null : (
          <nav aria-label="Alan" className="mt-2 px-2">
            <HScroll as="ul" ariaLabel="Alan filtresi">
              {PERSONAL_SCOPES.map((item) => {
                const isActive = item.key === scope;
                return (
                  <li key={item.key} className="shrink-0">
                    <Link
                      href={href(item.key, period)}
                      aria-current={isActive ? "page" : undefined}
                      className={`press-soft flex min-h-[40px] items-center gap-1.5 rounded-xl border px-3.5 text-[13px] font-medium ${
                        isActive
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-edge bg-surface text-ink-muted hover:text-ink"
                      }`}
                    >
                      <Icon
                        name={SCOPE_ICON[item.key] ?? "trophy"}
                        className="h-4 w-4"
                      />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </HScroll>
          </nav>
        )}

        {/* ---------------------------------------------------- 3. Dönem */}
        <nav aria-label="Dönem" className="mt-2">
          <ul className="flex gap-1.5">
            {PERIODS.map((item) => {
              const isActive = item.key === period;
              return (
                <li key={item.key} className="flex-1">
                  <Link
                    href={href(scope, item.key)}
                    aria-current={isActive ? "page" : undefined}
                    className={`press-soft flex min-h-[40px] items-center justify-center rounded-xl border text-[13px] transition-colors ${
                      isActive
                        ? "border-xp/60 bg-xp/15 font-bold text-xp"
                        : "border-edge bg-surface font-medium text-ink-muted hover:text-ink"
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
    </div>
  );
}
