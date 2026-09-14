import { redirect } from "next/navigation";

import { markAllNotificationsReadAction } from "@/lib/notifications/actions";
import {
  NOTIFICATION_ICON,
  NOTIFICATION_LABEL,
  listNotifications,
  relativeTime,
} from "@/lib/notifications/queries";
import { UserBottomNav } from "@/components/user-bottom-nav";
import { UserHeader } from "@/components/user-header";
import { Icon } from "@/components/ui/icon";
import { EmptyState } from "@/components/ui/pills";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Bildirimler — GençLİG",
};

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/giris?next=/bildirimler");
  }

  const notifications = await listNotifications();
  const unreadCount = notifications.filter((item) => !item.is_read).length;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface">
      <UserHeader title="Bildirimler" signedIn />

      {unreadCount > 0 ? (
        <div className="px-4 pt-3">
          <form action={markAllNotificationsReadAction}>
            <button
              type="submit"
              className="rounded-full border border-edge bg-card px-3.5 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:text-ink"
            >
              Tümünü okundu işaretle ({unreadCount})
            </button>
          </form>
        </div>
      ) : null}

      <main className="flex-1 px-4 py-4">
        {notifications.length === 0 ? (
          <EmptyState
            icon="bell"
            title="Henüz bildirimin yok"
            description="Görevlerin onaylandığında ve rozet kazandığında burada göreceksin."
          />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {notifications.map((item) => (
              <li
                key={item.id}
                className={
                  item.is_read
                    ? "rounded-2xl border border-edge bg-card p-3.5"
                    : "rounded-2xl border border-primary/50 bg-card p-3.5"
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-[11px] font-medium text-ink-muted">
                    <Icon
                      name={NOTIFICATION_ICON[item.type] ?? "bell"}
                      className="h-3.5 w-3.5"
                    />
                    {NOTIFICATION_LABEL[item.type] ?? item.type}
                  </span>
                  <span className="text-[11px] text-ink-muted">
                    {relativeTime(item.created_at)}
                  </span>
                </div>
                <p className="mt-1 text-sm font-semibold text-ink">
                  {item.title}
                </p>
                {item.body ? (
                  <p className="mt-0.5 text-sm text-ink-muted">{item.body}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </main>

      <UserBottomNav active="home" />
    </div>
  );
}
