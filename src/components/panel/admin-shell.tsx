import Link from "next/link";

import {
  AdminMenuButton,
  AdminNavProvider,
  AdminSidebar,
  AdminTitle,
} from "./admin-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Icon } from "@/components/ui/icon";
import { getAdminBadges } from "@/lib/panel/queries";

/*
  Süper admin çerçevesi v2.

  ÖNCEKİ DURUM: kullanıcı uygulamasıyla aynı dar (max-w-5xl) tek sütun ve
  on üç bağlantılık düz bir çip şeridi. Yönetim işi tablo işi; dar sütun
  tabloları sıkıştırıyor, düz şerit de nereye gideceğini aramaya
  zorluyordu.

  v2: solda sabit gruplu sütun (daraltılabilir), üstte şerit (başlık,
  arama, bekleyen iş rozeti, tema, uygulamaya dönüş). Mobilde sütun
  çekmeceye katlanıyor.

  Belediye paneli (/panel) bilerek DOKUNULMADI: orada sekiz sayfa var ve
  düz şerit hâlâ doğru araç. İki ayrı ölçek, iki ayrı çözüm.
*/
export async function AdminShell({
  subtitle,
  action,
  children,
}: {
  subtitle?: string;
  /** Sayfaya özel birincil eylem (ör. "Yeni görev"). */
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const badges = await getAdminBadges();
  const pending =
    badges.reviews + badges.problems + badges.moderation + badges.support;

  return (
    <AdminNavProvider>
      <div className="flex min-h-dvh bg-surface">
        <AdminSidebar badges={badges} />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-[52px] shrink-0 items-center gap-2.5 border-b border-edge bg-card/95 px-3 backdrop-blur">
            <AdminMenuButton />

            <div className="min-w-0 shrink">
              <AdminTitle />
            </div>

            {/*
              Arama kutusu şimdilik yer tutuyor ve DEVRE DIŞI: her tabloda
              ayrı filtreler var, bunları tek bir küresel aramaya bağlamak
              ayrı bir iş. Çalışıyormuş gibi davranan bir kutu,
              çalışmayan bir kutudan kötüdür.
            */}
            <label className="ml-4 hidden min-w-0 flex-1 items-center gap-2 rounded-xl border border-edge bg-surface px-2.5 py-1.5 md:flex md:max-w-xs">
              <Icon
                name="search"
                className="h-3.5 w-3.5 shrink-0 text-ink-muted"
              />
              <input
                type="search"
                disabled
                placeholder="Arama yakında"
                className="min-w-0 flex-1 bg-transparent text-xs text-ink outline-none placeholder:text-ink-muted"
              />
            </label>

            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              {pending > 0 ? (
                <Link
                  href="/admin/incelemeler"
                  title={`${badges.reviews} inceleme · ${badges.problems} bildirim · ${badges.moderation} moderasyon · ${badges.support} destek`}
                  className="press-soft inline-flex min-h-[40px] items-center gap-1 rounded-full bg-status-danger/15 px-3 text-[12px] font-bold text-status-danger"
                >
                  <Icon name="bell" className="h-3.5 w-3.5" />
                  {pending}
                  <span className="hidden sm:inline"> bekleyen</span>
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-status-success/15 px-2.5 py-1 text-[11px] font-semibold text-status-success">
                  <Icon name="check" className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Temiz</span>
                </span>
              )}

              <ThemeToggle />

              <Link
                href="/"
                title="Uygulamaya dön"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-edge bg-card text-ink-muted transition-colors hover:text-ink"
              >
                <Icon name="home" className="h-4 w-4" />
              </Link>
            </div>
          </header>

          <main className="min-w-0 flex-1 px-4 py-5">
            <div className="mx-auto w-full max-w-6xl">
              {subtitle || action ? (
                <div className="anim-rise mb-4 flex flex-wrap items-center justify-between gap-2">
                  {subtitle ? (
                    <p className="text-sm text-ink-muted">{subtitle}</p>
                  ) : (
                    <span />
                  )}
                  {action}
                </div>
              ) : null}

              {children}
            </div>
          </main>
        </div>
      </div>
    </AdminNavProvider>
  );
}
