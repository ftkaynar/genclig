import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import Image from "next/image";

import { BellRefresher } from "@/components/notifications/bell-refresher";
import { NotificationBell } from "@/components/notifications/bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { TokenAmount, TokenIcon } from "@/components/ui/token";
import { getViewerProfile, getViewerUser } from "@/lib/auth/viewer";
import { formatPoints, getUserPoints } from "@/lib/points/queries";

/*
  Kalıcı HUD üst barı.

  Oyun arayüzü mantığı: kullanıcı nerede olursa olsun seviyesini, bir
  sonraki seviyeye kalan XP'yi ve coin bakiyesini görmeli. Önceki üst bar
  yalnızca başlık ve çan taşıyordu; bakiyeyi görmek için ana sayfaya ya da
  profile dönmek gerekiyordu.

  Veri okuması istek başına önbellekli fonksiyonlardan geliyor
  (`getViewerUser`, `getViewerProfile`); sayfa zaten bunları çağırdığı için
  HUD ek ağ turu açmıyor. Tek ek okuma `getUserPoints`.
*/

/** Kompakt seviye halkası: HUD'a sığacak kadar küçük, SVG. */
function MiniRing({
  level,
  progress,
  avatarUrl,
  name,
}: {
  level: number;
  progress: number;
  avatarUrl: string | null;
  name: string;
}) {
  const size = 38;
  const stroke = 3;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = circumference * Math.min(Math.max(progress, 0), 1);

  return (
    <span className="relative flex shrink-0 items-center justify-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`Seviye ${level}`}
        className="rotate-[-90deg]"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-edge"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference - filled}`}
          className="stroke-primary"
        />
      </svg>

      <span className="absolute inset-[5px] overflow-hidden rounded-full">
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt=""
            width={28}
            height={28}
            className="h-full w-full object-cover"
            unoptimized
          />
        ) : (
          <span className="brand-gradient flex h-full w-full items-center justify-center text-[11px] font-bold text-white">
            {name.charAt(0).toUpperCase()}
          </span>
        )}
      </span>

      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-primary px-1.5 text-[9px] font-bold leading-[14px] text-white">
        {level}
      </span>
    </span>
  );
}

export async function UserHud({ title }: { title?: string }) {
  const user = await getViewerUser();

  if (!user) {
    return (
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-edge bg-surface/95 px-4 py-2.5 backdrop-blur">
        {title ? (
          <h1 className="text-lg font-bold tracking-tight text-ink">{title}</h1>
        ) : (
          <span className="text-lg font-bold tracking-tight text-ink">
            GençLİG
          </span>
        )}
        <span className="flex items-center gap-2">
          <ButtonLink href="/giris" size="sm">
            Giriş yap
          </ButtonLink>
          <ThemeToggle />
        </span>
      </header>
    );
  }

  const [profile, points] = await Promise.all([
    getViewerProfile(),
    getUserPoints(user.id),
  ]);

  const name = profile?.display_name ?? profile?.username ?? "?";

  // Son seviyede üst sınır yok; çubuk dolu gösteriliyor.
  const toNext =
    points.nextLevelXp === null ? null : points.nextLevelXp - points.xp;

  return (
    <header className="sticky top-0 z-20 border-b border-edge bg-surface/95 px-3 py-2 backdrop-blur">
      <div className="flex items-center gap-2.5">
        <Link href="/profil" aria-label="Profilim" className="shrink-0">
          <MiniRing
            level={points.level}
            progress={points.progress}
            avatarUrl={profile?.avatar_url ?? null}
            name={name}
          />
        </Link>

        {/* Orta: ince XP çubuğu. Sayı değil oran öncelikli — kullanıcı
            "ne kadar kaldı"yı bir bakışta görmeli. */}
        <Link href="/profil" className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[11px] font-semibold text-ink">
              {name}
            </span>
            <span className="shrink-0 text-[10px] font-medium text-ink-muted">
              {toNext === null
                ? "En üst seviye"
                : `${formatPoints(toNext)} XP kaldı`}
            </span>
          </span>
          <span className="xp-track mt-1 block h-1.5 w-full">
            <span
              className="xp-fill block"
              data-empty={points.progress <= 0}
              style={{ width: `${Math.round(points.progress * 100)}%` }}
            />
          </span>
        </Link>

        <span className="flex shrink-0 items-center gap-1.5">
          <Link
            href="/oduller"
            aria-label={`${points.coin} Token, Ödüller'e git`}
            className="token-pill press-soft inline-flex min-h-[40px] items-center gap-1 rounded-full px-2.5 text-xs font-bold"
          >
            <TokenIcon className="h-4 w-4" id="hud" />
            <TokenAmount value={formatPoints(points.coin)} />
            <span className="token-amount">Token</span>
          </Link>
          <BellRefresher />
          <NotificationBell />
          <ThemeToggle />
        </span>
      </div>

      {title ? (
        <h1 className="mt-1.5 text-lg font-bold tracking-tight text-ink">
          {title}
        </h1>
      ) : null}
    </header>
  );
}

/**
 * HUD'un iskelet karşılığı.
 *
 * `loading.tsx` içinde gerçek HUD kullanılamıyor: veri bekleyen async bir
 * sunucu bileşeni, yükleme ekranının kendisini bekletirdi. Bu sürüm aynı
 * yüksekliği kaplıyor, böylece veri gelince üst bar zıplamıyor.
 */
export function UserHudSkeleton({ title }: { title?: string }) {
  return (
    <header className="sticky top-0 z-20 border-b border-edge bg-surface/95 px-3 py-2 backdrop-blur">
      <div className="flex items-center gap-2.5">
        <span aria-hidden className="skeleton block h-[38px] w-[38px] shrink-0 rounded-full" />
        <span className="min-w-0 flex-1">
          <span aria-hidden className="skeleton block h-3 w-24 rounded-full" />
          <span aria-hidden className="skeleton mt-1.5 block h-1.5 w-full rounded-full" />
        </span>
        <span aria-hidden className="skeleton block h-6 w-14 shrink-0 rounded-full" />
        <span aria-hidden className="skeleton block h-9 w-9 shrink-0 rounded-full" />
      </div>
      {title ? (
        <h1 className="mt-1.5 text-lg font-bold tracking-tight text-ink">
          {title}
        </h1>
      ) : null}
    </header>
  );
}
