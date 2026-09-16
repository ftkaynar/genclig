import Link from "next/link";

import { Icon } from "@/components/ui/icon";
import { ACCENT_CHIP, ACCENT_EDGE, accentFor } from "@/lib/ui/accents";

/*
  Ana sayfa hızlı erişim ızgarası.

  Alt gezinme beş sekmede sabit (mobilde altıncı sekme dokunma hedeflerini
  parmak genişliğinin altına indiriyordu). Bu dört ekran profil altında
  gömülüydü ve kullanıcı varlıklarını fark etmiyordu.

  D23te Destek yerini Toplulukta, D24te Ödüller yerini Görevlerime
  bıraktı. Gerekçe ikisinde de aynı: ızgara dört slot ve günlük
  kullanılan ekranlar öncelikli. Destek /profil üzerinden, Ödüller ise
  HUD üstündeki coin hapından ve /profil üzerinden erişilebiliyor.
*/
/*
  Renkler artık BURADA seçilmiyor (D32 FAZ B2): her hedefin rengi
  lib/ui/accents.ts'te tanımlı ve profil ızgarasıyla aynı.

  ÖNCEKİ DURUM: Takımım burada magenta, profilde mor gradyandı;
  Görevlerim burada altın, ödüllerin rengiyle çakışıyordu. Renk
  hiçbir şey söylemiyordu.
*/
const ITEMS = [
  { href: "/arkadaslar", icon: "users", label: "Arkadaşlar" },
  { href: "/takim", icon: "shield", label: "Takımım" },
  { href: "/gorevlerim", icon: "list-checks", label: "Görevlerim" },
  { href: "/topluluk", icon: "megaphone", label: "Topluluk" },
] as const;

export function QuickAccess() {
  return (
    <nav aria-label="Hızlı erişim" className="mt-4">
      <ul className="grid grid-cols-4 gap-2">
        {ITEMS.map((item) => {
          const accent = accentFor(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`press-soft flex flex-col items-center gap-1.5 rounded-2xl border border-edge bg-card px-1 py-3 ${ACCENT_EDGE[accent]}`}
              >
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${ACCENT_CHIP[accent]}`}
                >
                  <Icon name={item.icon} className="h-5 w-5" />
                </span>
                <span className="text-center text-[11px] font-medium text-ink">
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
