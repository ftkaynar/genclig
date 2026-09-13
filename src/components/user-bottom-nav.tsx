import Link from "next/link";

/*
  Kullanıcı PWA'sının alt gezinmesi.

  Yalnızca Görevler bu dilimde gerçek bir sayfaya gidiyor; diğerleri henüz
  yok. Var olmayan yollara Link koymak 404 üretirdi, o yüzden href'i olmayan
  girişler span olarak çiziliyor ve tıklanamıyor.
*/
const ITEMS = [
  { key: "home", label: "Ana Sayfa", href: "/" },
  { key: "tasks", label: "Görevler", href: "/gorevler" },
  { key: "discover", label: "Keşfet", href: null },
  { key: "ranking", label: "Sıralama", href: null },
  { key: "profile", label: "Profil", href: null },
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
          const className = isActive
            ? "block rounded-lg px-1 py-2 text-center text-[11px] font-semibold text-primary"
            : "block rounded-lg px-1 py-2 text-center text-[11px] font-medium text-ink-muted";

          return (
            <li key={item.key} className="flex-1">
              {item.href ? (
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={className}
                >
                  {item.label}
                </Link>
              ) : (
                <span aria-disabled className={`${className} opacity-60`}>
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
