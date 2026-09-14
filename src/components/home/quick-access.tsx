import Link from "next/link";

import { Icon } from "@/components/ui/icon";

/*
  Ana sayfa hızlı erişim ızgarası.

  Alt gezinme beş sekmede sabit (mobilde altıncı sekme dokunma hedeflerini
  parmak genişliğinin altına indiriyordu). Bu dört ekran profil altında
  gömülüydü ve kullanıcı varlıklarını fark etmiyordu.

  D23te Destek yerini Toplulukta bıraktı: sohbet günlük kullanılan bir
  ekran, destek ise yalnızca sorun çıkınca aranıyor. Destek /profil
  üzerinden erişilebilir durumda.
*/
const ITEMS = [
  { href: "/arkadaslar", icon: "users", label: "Arkadaşlar", tone: "text-primary bg-primary/15" },
  { href: "/takim", icon: "shield", label: "Takımım", tone: "text-magenta bg-magenta/15" },
  { href: "/oduller", icon: "gift", label: "Ödüller", tone: "text-coin bg-coin/15" },
  { href: "/topluluk", icon: "megaphone", label: "Topluluk", tone: "text-xp bg-xp/15" },
] as const;

export function QuickAccess() {
  return (
    <nav aria-label="Hızlı erişim" className="mt-4">
      <ul className="grid grid-cols-4 gap-2">
        {ITEMS.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="flex flex-col items-center gap-1.5 rounded-2xl border border-edge bg-card px-1 py-3 transition-colors hover:border-primary/60 active:scale-[0.98]"
            >
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.tone}`}
              >
                <Icon name={item.icon} className="h-5 w-5" />
              </span>
              <span className="text-center text-[11px] font-medium text-ink">
                {item.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
