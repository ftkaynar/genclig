import Link from "next/link";
import { redirect } from "next/navigation";

import { UserBottomNav } from "@/components/user-bottom-nav";
import { UserHeader } from "@/components/user-header";
import { relativeTime } from "@/lib/notifications/queries";
import {
  REDEMPTION_STATUS_LABEL,
  listMyRedemptions,
} from "@/lib/rewards/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Kuponlarım — GençLİG",
};

export default async function MyCouponsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/giris?next=/oduller/kuponlarim");
  }

  const redemptions = await listMyRedemptions();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface">
      <UserHeader title="Kuponlarım" signedIn />

      <main className="flex-1 px-4 py-4">
        {redemptions.length === 0 ? (
          <div className="rounded-2xl border border-edge bg-card px-4 py-8 text-center">
            <p className="text-sm text-ink-muted">Henüz kuponun yok.</p>
            <Link
              href="/oduller"
              className="mt-3 inline-block rounded-full bg-cta px-5 py-2.5 text-sm font-semibold text-brand"
            >
              Ödül havuzuna git
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {redemptions.map((item) => (
              <li
                key={item.id}
                className="rounded-2xl border border-edge bg-card p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-ink">
                    {item.rewards?.title ?? "Ödül"}
                  </span>
                  <span
                    className={
                      item.status === "active"
                        ? "rounded-full bg-primary/15 px-2.5 py-1 text-[11px] font-semibold text-primary"
                        : "rounded-full bg-surface px-2.5 py-1 text-[11px] font-semibold text-ink-muted"
                    }
                  >
                    {REDEMPTION_STATUS_LABEL[item.status] ?? item.status}
                  </span>
                </div>

                <p className="mt-2 rounded-xl bg-surface px-3 py-2.5 text-center font-mono text-lg font-bold tracking-widest text-ink">
                  {item.code}
                </p>

                <p className="mt-2 text-[11px] text-ink-muted">
                  {relativeTime(item.created_at)} alındı
                  {item.used_at
                    ? ` · ${relativeTime(item.used_at)} kullanıldı`
                    : null}
                </p>
              </li>
            ))}
          </ul>
        )}
      </main>

      <UserBottomNav active="profile" />
    </div>
  );
}
