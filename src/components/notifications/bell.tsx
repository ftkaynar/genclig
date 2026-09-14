import Link from "next/link";

import { Icon } from "@/components/ui/icon";

import { getUnreadNotificationCount } from "@/lib/notifications/queries";

/**
 * Header'daki bildirim çanı.
 * Okunmamış sayısı sunucuda hesaplanıyor; sayfa her yenilendiğinde güncel.
 */
export async function NotificationBell() {
  const unread = await getUnreadNotificationCount();

  return (
    <Link
      href="/bildirimler"
      aria-label={
        unread > 0 ? `Bildirimler, ${unread} okunmamış` : "Bildirimler"
      }
      className="relative flex h-9 w-9 items-center justify-center rounded-full border border-edge bg-card text-ink-muted transition-colors hover:text-ink"
    >
      <Icon name="bell" className="h-4 w-4" />
      {unread > 0 ? (
        <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-status-danger px-1 text-center text-[10px] font-bold leading-[18px] text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
    </Link>
  );
}
