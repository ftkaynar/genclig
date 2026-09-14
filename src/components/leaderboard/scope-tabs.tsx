import Link from "next/link";

import { Icon } from "@/components/ui/icon";
import { PERIODS, SCOPES } from "@/lib/leaderboard/queries";

/*
  Sıralama sekmeleri — görev ekranıyla aynı dil.

  Üstte kapsam çipleri (ikonlu, seçilide gradyan), altında dönem hapları.
  Görev ekranındaki gibi tek bir segment anahtarı kullanılmadı: orada iki
  seçenek vardı ve kayan gösterge okunuyordu, burada altı kapsam var ve
  aynı bileşen sıkışıp okunmaz hâle geliyordu. Bunun yerine seçili çip
  gradyanla dolduruluyor.

  Kapsam ikonları hiyerarşiyi anlatıyor: Türkiye globe, il/ilçe/mahalle
  giderek daralan konum katmanları, arkadaşlar users, takımlar shield.
*/
const SCOPE_ICON: Record<string, string> = {
  turkiye: "globe",
  il: "map-pin",
  ilce: "compass",
  mahalle: "home",
  arkadaslar: "users",
  takimlar: "shield",
};

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
  return (
    <div className="px-4 pt-3">
      <nav aria-label="Kapsam">
        <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {SCOPES.map((item) => {
            const isActive = item.key === scope;
            return (
              <li key={item.key} className="shrink-0">
                <Link
                  href={href(item.key, period)}
                  aria-current={isActive ? "page" : undefined}
                  className={
                    isActive
                      ? "brand-gradient flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold text-white"
                      : "flex items-center gap-1.5 rounded-full border border-edge bg-card px-3.5 py-2 text-xs font-medium text-ink-muted hover:text-ink"
                  }
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
        </ul>
      </nav>

      <nav aria-label="Dönem" className="mt-2">
        <ul className="flex gap-2">
          {PERIODS.map((item) => {
            const isActive = item.key === period;
            return (
              <li key={item.key}>
                <Link
                  href={href(scope, item.key)}
                  aria-current={isActive ? "page" : undefined}
                  className={
                    isActive
                      ? "block rounded-full bg-xp/20 px-3 py-1 text-[11px] font-semibold text-xp"
                      : "block rounded-full border border-edge px-3 py-1 text-[11px] font-medium text-ink-muted hover:text-ink"
                  }
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
