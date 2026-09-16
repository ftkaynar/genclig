/** Belediye panelinin gezinme bağlantıları. */
export const PANEL_NAV = [
  { href: "/panel", label: "Özet" },
  { href: "/panel/incelemeler", label: "İncelemeler" },
  { href: "/panel/sorunlar", label: "Bildirimler" },
  { href: "/panel/duyurular", label: "Duyurular" },
  { href: "/panel/moderasyon", label: "Moderasyon" },
  { href: "/panel/gorevler", label: "Görevler" },
  { href: "/panel/oduller", label: "Ödüller" },
  { href: "/panel/kupon", label: "Kupon" },
];

export type AdminNavItem = {
  href: string;
  label: string;
  icon: string;
  /** Üst şeritteki bekleyen iş rozetinin hangi sayacı okuyacağı. */
  badge?: "reviews" | "support" | "moderation" | "problems";
};

export type AdminNavGroup = {
  title: string;
  items: AdminNavItem[];
};

/*
  Süper admin gezinmesi — gruplu.

  ÖNCEKİ SORUN: on üç bağlantı tek bir düz şeritte yan yana duruyordu.
  Sıralama keyfiydi (günlük iş ile yılda bir açılan ayar ekranı aynı
  hizada) ve kullanıcı aradığını göz gezdirerek buluyordu.

  Gruplama işin ritmine göre: her gün açılan Operasyon ortada, içerik
  tanımları üstte, nadiren dokunulan Yönetim altta. Bekleyen iş sayıları
  yalnızca Operasyon'da — rozet her yerde olsaydı hiçbir yerde
  olmayacaktı.
*/
export const ADMIN_NAV: AdminNavGroup[] = [
  {
    title: "Genel Bakış",
    items: [{ href: "/admin", label: "Özet", icon: "trending-up" }],
  },
  {
    title: "Operasyon",
    items: [
      {
        href: "/admin/incelemeler",
        label: "İncelemeler",
        icon: "check",
        badge: "reviews",
      },
      {
        href: "/admin/sorunlar",
        label: "Bildirimler",
        icon: "megaphone",
        badge: "problems",
      },
      {
        href: "/admin/moderasyon",
        label: "Moderasyon",
        icon: "shield",
        badge: "moderation",
      },
      {
        href: "/admin/destek",
        label: "Destek",
        icon: "hand-heart",
        badge: "support",
      },
      { href: "/admin/duyurular", label: "Duyurular", icon: "bell" },
    ],
  },
  {
    title: "İçerik",
    items: [
      { href: "/admin/gorevler", label: "Görevler", icon: "list-checks" },
      {
        href: "/admin/gunun-gorevi",
        label: "Günün Görevi",
        icon: "star",
      },
      { href: "/admin/oduller", label: "Ödüller", icon: "gift" },
      { href: "/admin/rozetler", label: "Rozetler", icon: "award" },
      { href: "/admin/kategoriler", label: "Kategoriler", icon: "palette" },
      { href: "/admin/seviyeler", label: "Seviyeler", icon: "star" },
      {
        href: "/admin/siralama-odulleri",
        label: "Sıralama Ödülleri",
        icon: "trophy",
      },
    ],
  },
  {
    title: "Yönetim",
    items: [
      { href: "/admin/belediyeler", label: "Belediyeler", icon: "building-2" },
      { href: "/admin/kullanicilar", label: "Kullanıcılar", icon: "users" },
      { href: "/admin/denetim", label: "Denetim", icon: "search" },
    ],
  },
];

/** Düz liste — başlık çözümü ve eski düz gezinme için. */
export const ADMIN_NAV_FLAT: AdminNavItem[] = ADMIN_NAV.flatMap(
  (group) => group.items,
);

/**
 * Yol adresinden sayfa başlığı.
 *
 * En uzun eşleşme kazanıyor: `/admin/gorevler/yeni` için hem `/admin` hem
 * `/admin/gorevler` eşleşiyor, doğru olan ikincisi.
 */
export function adminTitleFor(pathname: string): string {
  let best: AdminNavItem | null = null;
  for (const item of ADMIN_NAV_FLAT) {
    if (pathname === item.href || pathname.startsWith(item.href + "/")) {
      if (!best || item.href.length > best.href.length) {
        best = item;
      }
    }
  }
  return best?.label ?? "Süper Admin";
}
