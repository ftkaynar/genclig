import { redirect } from "next/navigation";

import { ChainCard } from "@/components/chains/chain-card";
import { RewardFab } from "@/components/rewards/reward-fab";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/pills";
import { UserBottomNav } from "@/components/user-bottom-nav";
import { UserHud } from "@/components/user-hud";
import { getViewerUser } from "@/lib/auth/viewer";
import { listMyChains } from "@/lib/chains/queries";

/*
  /zincirler — zincir listesi (D36 FAZ ZR).

  ÖLÇÜLEN BORÇ: bu route HİÇ VAR OLMAMIŞTI. Yalnız /zincirler/[id]
  vardı, yani zincire ancak /gorevler üstündeki yatay şeritten
  girilebiliyordu ve şerit üçten fazla zinciri göstermiyordu. D35
  kapanışında canlı curl /zincirler için 404 döndürdü.

  Sıralama: önce DEVAM EDENLER (ilerleme var ama bitmemiş), sonra
  başlanmamışlar, en sonda tamamlananlar. Kullanıcının yarım bıraktığı
  iş listenin başında olmalı; alfabetik sıra denendi ve elendi —
  bitirdiği zincir başa geliyordu.
*/
export const metadata = { title: "Zincirler — GençLİG" };

export default async function ChainsPage() {
  const user = await getViewerUser();
  if (!user) {
    redirect("/giris?next=/zincirler");
  }

  const chains = await listMyChains();

  /** 0 = devam eden, 1 = başlanmamış, 2 = tamamlanmış. */
  function order(chain: (typeof chains)[number]): number {
    if (chain.awarded) return 2;
    return chain.done_count > 0 ? 0 : 1;
  }

  const sorted = [...chains].sort(
    (a, b) => order(a) - order(b) || a.title.localeCompare(b.title, "tr"),
  );

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface">
      <UserHud title="Zincirler" />

      <main className="has-bottom-nav flex-1 px-4 pb-8 pt-4">
        <p className="mb-3 text-xs text-ink-muted">
          Bir zincirin bütün adımlarını tamamla, bonus XP ve Token kazan.
        </p>

        {sorted.length === 0 ? (
          <EmptyState
            icon="list-checks"
            title="Henüz zincir yok"
            description="Zincirler birkaç görevlik seriler. Açıldığında burada listelenecek."
            action={
              <ButtonLink href="/gorevler" variant="primary" icon="list-checks">
                Görevlere git
              </ButtonLink>
            }
          />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {sorted.map((chain) => (
              <li key={chain.chain_id}>
                <ChainCard chain={chain} withDescription />
              </li>
            ))}
          </ul>
        )}
      </main>

      <RewardFab />
      <UserBottomNav active="tasks" />
    </div>
  );
}
