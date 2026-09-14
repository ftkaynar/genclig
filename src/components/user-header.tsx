import { BellRefresher } from "@/components/notifications/bell-refresher";
import { NotificationBell } from "@/components/notifications/bell";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Kullanıcı yüzlerinin ortak üst satırı.
 * Çan yalnızca oturum açıkken anlamlı; oturumsuzda gizleniyor çünkü
 * bildirim listesi zaten boş döner ve gereksiz bir bağlantı olurdu.
 */
export function UserHeader({
  title,
  signedIn,
}: {
  title?: string;
  signedIn: boolean;
}) {
  return (
    <header className="flex items-center justify-between gap-3 px-4 pt-4">
      {title ? (
        <h1 className="text-xl font-bold tracking-tight text-ink">{title}</h1>
      ) : (
        <span />
      )}
      <div className="flex items-center gap-2">
        {signedIn ? (
          <>
            <BellRefresher />
            <NotificationBell />
          </>
        ) : null}
        <ThemeToggle />
      </div>
    </header>
  );
}
