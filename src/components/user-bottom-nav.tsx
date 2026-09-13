import Link from "next/link";

/*
  Kullanıcı PWA'sının alt gezinmesi.

  Beş sekmenin hepsinin sayfası var. Önceki sürümde henüz yazılmamış sayfalar
  için tıklanamaz bir span dalı vardı; hepsi bağlandıktan sonra o dal ölü koda
  dönüştü ve kaldırıldı.
*/
const ITEMS = [
  { key: "home", label: "Ana Sayfa", href: "/" },
  { key: "tasks", label: "Görevler", href: "/gorevler" },
  { key: "discover", label: "Keşfet", href: "/kesfet" },
  { key: "ranking", label: "Sıralama", href: "/siralama" },
  { key: "profile", label: "Profil", href: "/profil" },
] as const;

export type BottomNavKey = (typeof ITEMS)[number]["key"];

export function UserBottomNav({ active }: { active: BottomNavKey }) {
  return (
    <nav
      aria-label="Ana gezinme"
      className="sticky bottom-0 border-t border-edge bg-card"
    >
      <ul className="flex items-stretch justify-between px-2 py-2">
        {ITEMS.map((item) => {
          const isActive = item.key === active;

          return (
            <li key={item.key} className="flex-1">
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={
                  isActive
                    ? "block rounded-lg px-1 py-2 text-center text-[11px] font-semibold text-primary"
                    : "block rounded-lg px-1 py-2 text-center text-[11px] font-medium text-ink-muted"
                }
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
