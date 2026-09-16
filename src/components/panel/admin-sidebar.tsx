"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import { Icon } from "@/components/ui/icon";
import { ADMIN_NAV, adminTitleFor } from "@/lib/panel/nav";

export type AdminBadges = {
  reviews: number;
  problems: number;
  moderation: number;
  support: number;
};

const COLLAPSE_KEY = "genclig-admin-nav-collapsed";

/*
  Daraltma tercihi bir DIŞ DEPO olarak okunuyor (useSyncExternalStore),
  effect içinde setState ile değil.

  Neden: sunucu HTML'i tercihi bilmiyor, yani ilk render her zaman
  "açık". Tercihi effect içinde setState ile uygulamak `react-hooks/
  set-state-in-effect` kuralını ihlal ediyor ve fazladan bir render
  turu açıyordu (aynı kurala D22'de duyuru şeridinde takılmıştık).
  useSyncExternalStore sunucu anlık görüntüsünü ayrı veriyor, bu yüzden
  hydration uyuşmazlığı da çıkmıyor.
*/
const collapseListeners = new Set<() => void>();

function subscribeCollapse(onChange: () => void) {
  collapseListeners.add(onChange);
  // Başka sekmede değişirse burası da güncellensin.
  window.addEventListener("storage", onChange);
  return () => {
    collapseListeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readCollapse(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    // Gizli sekme / site verisi engelli: varsayılan açık.
    return false;
  }
}

function writeCollapse(next: boolean) {
  try {
    localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
  } catch {
    // Kaydedilemezse de arayüz çalışmaya devam ediyor.
  }
  for (const listener of collapseListeners) listener();
}

/*
  Süper admin sol sütunu.

  Client bileşen olmasının sebebi `usePathname`: aktif vurgu ve üst şerit
  başlığı yoldan türüyor. Böylece on dört admin sayfasının hiçbiri kendi
  başlığını ayrıca yazmıyor — biri unutulsa "GençLİG Süper Admin" yazan
  bir sayfa kalırdı.

  Sütun ile üst şeritteki menü düğmesi AYNI çekmece durumunu paylaşmak
  zorunda ve ikisi ağacın farklı yerlerinde duruyor; bu yüzden küçük bir
  context var. Denenen ve elenen alternatif: bileşeni iki kez render
  etmek — masaüstü sütunu ve çekmece de ikişer kez basılıyordu.
*/
const NavContext = createContext<{
  drawer: boolean;
  setDrawer: (open: boolean) => void;
} | null>(null);

export function AdminNavProvider({ children }: { children: React.ReactNode }) {
  const [drawer, setDrawer] = useState(false);

  const value = useMemo(() => ({ drawer, setDrawer }), [drawer]);
  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

function useNav() {
  const ctx = useContext(NavContext);
  if (!ctx) {
    throw new Error("AdminNavProvider eksik");
  }
  return ctx;
}

function NavList({
  badges,
  collapsed,
  onNavigate,
}: {
  badges: AdminBadges;
  collapsed: boolean;
  /*
    Çekmece bağlantıya dokununca kapanıyor. Önceki sürüm bunu pathname
    değişimini izleyen bir effect ile yapıyordu; effect içinde setState
    lint kuralına takılıyor ve gereksiz bir render turu açıyordu. Olay
    işleyicisi hem kuralı çiğnemiyor hem de niyeti daha açık söylüyor.
  */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Yönetim gezinmesi" className="flex flex-col gap-4 p-3">
      {ADMIN_NAV.map((group) => (
        <div key={group.title}>
          {!collapsed ? (
            <p className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-muted/70">
              {group.title}
            </p>
          ) : (
            <span aria-hidden className="mx-auto mb-1.5 block h-px w-6 bg-edge" />
          )}

          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/admin" &&
                  pathname.startsWith(item.href + "/"));
              const count = item.badge ? badges[item.badge] : 0;

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    title={collapsed ? item.label : undefined}
                    className={`group relative flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-medium transition-colors ${
                      active
                        ? "bg-primary/15 text-primary"
                        : "text-ink-muted hover:bg-surface hover:text-ink"
                    } ${collapsed ? "justify-center" : ""}`}
                  >
                    {/* Aktif sekmenin sol kenar şeridi: renk tek başına
                        yeterli değil, konum da sinyal veriyor. */}
                    {active ? (
                      <span
                        aria-hidden
                        className="brand-gradient absolute bottom-1.5 left-0 top-1.5 w-1 rounded-r-full"
                      />
                    ) : null}

                    <span className="relative flex shrink-0 items-center">
                      <Icon name={item.icon} className="h-4 w-4" />
                      {collapsed && count > 0 ? (
                        <span
                          aria-hidden
                          className="absolute -right-1.5 -top-1.5 h-2 w-2 rounded-full bg-status-danger"
                        />
                      ) : null}
                    </span>

                    {!collapsed ? (
                      <>
                        <span className="truncate">{item.label}</span>
                        {count > 0 ? (
                          <span className="ml-auto rounded-full bg-status-danger px-1.5 text-[10px] font-bold leading-[16px] text-white">
                            {count > 99 ? "99+" : count}
                          </span>
                        ) : null}
                      </>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function AdminSidebar({ badges }: { badges: AdminBadges }) {
  const { drawer, setDrawer } = useNav();
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(
    subscribeCollapse,
    readCollapse,
    // Sunucu anlık görüntüsü: menü her zaman açık render ediliyor.
    () => false,
  );

  function toggleCollapse() {
    writeCollapse(!collapsed);
  }

  return (
    <>
      <aside
        className={`hidden shrink-0 border-r border-edge bg-card transition-[width] duration-200 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col ${
          collapsed ? "lg:w-[68px]" : "lg:w-[228px]"
        }`}
      >
        <div
          className={`flex h-[52px] shrink-0 items-center gap-2 border-b border-edge px-3 ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <span className="brand-gradient flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-black text-white">
            G
          </span>
          {!collapsed ? (
            <span className="truncate text-sm font-bold text-ink">GençLİG</span>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <NavList badges={badges} collapsed={collapsed} />
        </div>

        <button
          type="button"
          onClick={toggleCollapse}
          aria-label={collapsed ? "Menüyü genişlet" : "Menüyü daralt"}
          className="flex h-10 shrink-0 items-center justify-center gap-1.5 border-t border-edge text-[11px] font-medium text-ink-muted transition-colors hover:text-ink"
        >
          <Icon
            name="chevron-right"
            className={`h-4 w-4 transition-transform ${
              collapsed ? "" : "rotate-180"
            }`}
          />
          {!collapsed ? "Daralt" : null}
        </button>
      </aside>

      {drawer ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            role="dialog"
            aria-label="Yönetim gezinmesi"
            className="anim-rise w-[250px] max-w-[78%] overflow-y-auto border-r border-edge bg-card"
          >
            <div className="flex h-[52px] items-center justify-between border-b border-edge px-3">
              <span className="truncate text-sm font-bold text-ink">
                {adminTitleFor(pathname)}
              </span>
              <button
                type="button"
                onClick={() => setDrawer(false)}
                aria-label="Menüyü kapat"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted"
              >
                <Icon name="x" className="h-4 w-4" />
              </button>
            </div>
            <NavList
              badges={badges}
              collapsed={false}
              onNavigate={() => setDrawer(false)}
            />
          </div>

          <button
            type="button"
            aria-label="Menüyü kapat"
            onClick={() => setDrawer(false)}
            className="flex-1 bg-brand/60 backdrop-blur-sm"
          />
        </div>
      ) : null}
    </>
  );
}

/** Üst şeritteki mobil menü düğmesi. */
export function AdminMenuButton() {
  const { setDrawer } = useNav();
  return (
    <button
      type="button"
      onClick={() => setDrawer(true)}
      aria-label="Menüyü aç"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-edge bg-card text-ink-muted lg:hidden"
    >
      <Icon name="list-checks" className="h-4 w-4" />
    </button>
  );
}

/** Üst şeritteki sayfa başlığı — yoldan türüyor. */
export function AdminTitle() {
  const pathname = usePathname();
  return (
    <h1 className="truncate text-base font-bold tracking-tight text-ink">
      {adminTitleFor(pathname)}
    </h1>
  );
}
