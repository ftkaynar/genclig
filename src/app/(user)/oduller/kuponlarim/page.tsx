import Link from "next/link";
import { redirect } from "next/navigation";

import { UserBottomNav } from "@/components/user-bottom-nav";
import { UserHud } from "@/components/user-hud";
import { EmptyState } from "@/components/ui/pills";
import { relativeTime } from "@/lib/notifications/queries";
import {
  REDEMPTION_STATUS_LABEL,
  listMyRedemptions,
} from "@/lib/rewards/queries";
import { getViewerUser } from "@/lib/auth/viewer";

export const metadata = {
  title: "Kuponlarım — GençLİG",
};

export default async function MyCouponsPage() {
  const user = await getViewerUser();

  if (!user) {
    redirect("/giris?next=/oduller/kuponlarim");
  }

  const redemptions = await listMyRedemptions();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface">
      <UserHud title="Kuponlarım" />

      <main className="flex-1 px-4 py-4 has-bottom-nav">
        {redemptions.length === 0 ? (
          <EmptyState
            icon="gift"
            title="Henüz kuponun yok"
            description="Token biriktir, ödül havuzundan kupon al."
            action={
              <Link
                href="/oduller"
                className="inline-block rounded-full btn-chunky bg-cta px-5 py-2.5 text-sm font-semibold text-white"
              >
                Ödül havuzuna git
              </Link>
            }
          />
        ) : (
          <ul className="flex flex-col gap-4">
            {redemptions.map((item) => {
              const active = item.status === "active";

              return (
                <li
                  key={item.id}
                  /*
                    Bilet görünümü: kesikli ayırıcı ve iki yandaki zımba
                    delikleri saf CSS (.ticket). Kupon fiziksel bir bilet
                    gibi dursun diye — listedeki diğer kartlardan ayrışması
                    kullanıcının "bu benim kuponum" demesini kolaylaştırıyor.
                  */
                  className={`ticket overflow-hidden rounded-2xl border-2 bg-card ${
                    active ? "border-primary/60" : "border-edge opacity-70"
                  }`}
                >
                  {/* Durum şeridi */}
                  <div
                    className={`px-4 py-2 ${
                      active
                        ? "brand-gradient text-white"
                        : "bg-surface text-ink-muted"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-bold">
                        {item.rewards?.title ?? "Ödül"}
                      </span>
                      <span className="shrink-0 rounded-full bg-black/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                        {REDEMPTION_STATUS_LABEL[item.status] ?? item.status}
                      </span>
                    </div>
                  </div>

                  <div className="ticket-dash" />

                  <div className="px-4 py-3.5 text-center">
                    <p className="text-[10px] uppercase tracking-wide text-ink-muted">
                      Kupon kodu
                    </p>
                    <p className="mt-1 font-mono text-xl font-bold tracking-[0.25em] text-ink">
                      {item.code}
                    </p>
                    <p className="mt-2 text-[11px] text-ink-muted">
                      {relativeTime(item.created_at)} alındı
                      {item.used_at
                        ? ` · ${relativeTime(item.used_at)} kullanıldı`
                        : null}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      <UserBottomNav active="profile" />
    </div>
  );
}
