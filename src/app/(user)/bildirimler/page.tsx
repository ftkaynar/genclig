import Link from "next/link";
import { redirect } from "next/navigation";

import { MarkReadOnOpen } from "@/components/notifications/mark-read-on-open";
import { listNotifications, relativeTime } from "@/lib/notifications/queries";
import {
  notificationHref,
  notificationMeta,
} from "@/lib/notifications/labels";
import { UserBottomNav } from "@/components/user-bottom-nav";
import { UserHeader } from "@/components/user-header";
import { Icon } from "@/components/ui/icon";
import { EmptyState } from "@/components/ui/pills";
import { getViewerUser } from "@/lib/auth/viewer";

export const metadata = {
  title: "Bildirimler — GençLİG",
};

export default async function NotificationsPage() {
  const user = await getViewerUser();

  if (!user) {
    redirect("/giris?next=/bildirimler");
  }

  const notifications = await listNotifications();
  const unreadCount = notifications.filter((item) => !item.is_read).length;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface">
      <UserHeader title="Bildirimler" signedIn />

      {/*
        Sayfa açılınca okundu. Düğme kaldırıldı: listeyi görmek zaten
        okumaktır ve ayrıca bir düğmeye basmak gerekmesi sayacı
        anlamsızlaştırıyordu.
      */}
      <MarkReadOnOpen unread={unreadCount} />

      <main className="flex-1 px-4 py-4 has-bottom-nav">
        {notifications.length === 0 ? (
          <EmptyState
            icon="bell"
            title="Henüz bildirimin yok"
            description="Görevlerin onaylandığında ve rozet kazandığında burada göreceksin."
          />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {notifications.map((item, i) => {
              const meta = notificationMeta(item.type);
              return (
                <li
                  key={item.id}
                  className="anim-stagger"
                  style={{ "--i": i } as React.CSSProperties}
                >
                  {/*
                    Her bildirim bir yere götürüyor. Tıklanıp hiçbir şey
                    olmayan bildirim, kullanıcıya "bu bozuk" dedirtiyordu.
                  */}
                  <Link
                    href={notificationHref(item.type, item.ref_id)}
                    className={`press-soft block rounded-2xl border p-3.5 ${
                      item.is_read
                        ? "border-edge bg-card"
                        : "border-primary/50 bg-card"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.tone}`}
                      >
                        <Icon name={meta.icon} className="h-3 w-3" />
                        {meta.label}
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-ink-muted">
                        {!item.is_read ? (
                          <span
                            aria-label="Okunmadı"
                            className="h-1.5 w-1.5 rounded-full bg-primary"
                          />
                        ) : null}
                        {relativeTime(item.created_at)}
                      </span>
                    </div>

                    <p className="mt-1.5 text-sm font-semibold text-ink">
                      {item.title}
                    </p>
                    {item.body ? (
                      <p className="mt-0.5 text-sm text-ink-muted">
                        {item.body}
                      </p>
                    ) : null}

                    <span className="mt-1.5 inline-flex items-center gap-0.5 text-[11px] font-medium text-primary">
                      Aç
                      <Icon name="chevron-right" className="h-3 w-3" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      <UserBottomNav active="home" />
    </div>
  );
}
