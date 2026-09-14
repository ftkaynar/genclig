import Link from "next/link";

import { Icon } from "@/components/ui/icon";

/*
  Kullanıcı PWA'sının alt gezinmesi — v2.

  Ortadaki Görevler sekmesi yükseltilmiş gradyan daire: uygulamanın asıl
  eylemi görev yapmak ve beş eşit sekme arasında kaybolmuştu. Diğer dördü
  ikon + etiket; aktif olan dolgun renkte, pasifler soluk.

  Beş sekmede kalındı. Altıncı sekme denendi ve elendi: 360px genişlikte
  dokunma hedefleri parmak genişliğinin altına iniyordu. Arkadaşlar,
  Takımım, Ödüller ve Destek ana sayfadaki hızlı erişim ızgarasında.

  `prefetch` bilerek varsayılanda (açık) bırakıldı: sekmeler arası geçiş
  ağ turu beklemeden açılsın.
*/
const ITEMS = [
  { key: "home", label: "Ana Sayfa", href: "/", icon: "home" },
  { key: "discover", label: "Keşfet", href: "/kesfet", icon: "compass" },
  { key: "tasks", label: "Görevler", href: "/gorevler", icon: "list-checks" },
  { key: "ranking", label: "Sıralama", href: "/siralama", icon: "trophy" },
  { key: "profile", label: "Profil", href: "/profil", icon: "user" },
] as const;

export type BottomNavKey = (typeof ITEMS)[number]["key"];

export function UserBottomNav({ active }: { active: BottomNavKey }) {
  return (
    <nav
      aria-label="Ana gezinme"
      className="sticky bottom-0 z-30 border-t border-edge bg-card"
    >
      <ul className="flex items-end justify-between px-2 pb-2 pt-1.5">
        {ITEMS.map((item) => {
          const isActive = item.key === active;

          // Ortadaki sekme: yükseltilmiş gradyan daire.
          if (item.key === "tasks") {
            return (
              <li key={item.key} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className="group flex flex-col items-center gap-1"
                >
                  <span
                    className={`brand-gradient -mt-6 flex h-14 w-14 items-center justify-center rounded-full text-white ring-4 ring-card transition-transform duration-200 ease-out group-active:scale-95 ${
                      isActive ? "nav-glow scale-105" : ""
                    }`}
                  >
                    <Icon name={item.icon} className="h-6 w-6" />
                  </span>
                  <span
                    className={`text-[11px] ${
                      isActive
                        ? "font-semibold text-primary"
                        : "font-medium text-ink-muted"
                    }`}
                  >
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          }

          return (
            <li key={item.key} className="flex-1">
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className="group flex flex-col items-center gap-0.5 rounded-lg py-1"
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all duration-200 ease-out group-active:scale-90 ${
                    isActive
                      ? "bg-primary/15 text-primary"
                      : "text-ink-muted group-hover:text-ink"
                  }`}
                >
                  <Icon
                    name={item.icon}
                    className="h-[18px] w-[18px]"
                    // Aktif sekmede daha kalın çizgi: dolu ikon hissi
                    // veriyor, ayrı bir "filled" ikon kümesi taşımadan.
                    strokeWidth={isActive ? 2.6 : 1.9}
                  />
                </span>
                <span
                  className={`text-[10px] ${
                    isActive
                      ? "font-semibold text-primary"
                      : "font-medium text-ink-muted"
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
