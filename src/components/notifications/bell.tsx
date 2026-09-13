import Link from "next/link";

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
      className="relative rounded-full border border-edge bg-card px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:text-ink"
    >
      <span aria-hidden>🔔</span>
      {unread > 0 ? (
        <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-status-danger px-1 text-center text-[10px] font-bold leading-[18px] text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
    </Link>
  );
}
