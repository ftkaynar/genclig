import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ChainCelebration } from "@/components/chains/chain-celebration";
import { RewardFab } from "@/components/rewards/reward-fab";
import { Icon } from "@/components/ui/icon";
import { EmptyState } from "@/components/ui/pills";
import { UserBottomNav } from "@/components/user-bottom-nav";
import { UserHud } from "@/components/user-hud";
import { getViewerUser } from "@/lib/auth/viewer";
import {
  chainPercent,
  getChain,
  listChainSteps,
} from "@/lib/chains/queries";

export const metadata = { title: "Zincir — GençLİG" };

export default async function ChainDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await getViewerUser();
  if (!user) {
    redirect(`/giris?next=/zincirler/${id}`);
  }

  const [chain, steps] = await Promise.all([
    getChain(id),
    listChainSteps(id),
  ]);

  // Pasif ya da olmayan zincir: RPC boş dönüyor, sayfa da 404.
  if (!chain) {
    notFound();
  }

  const percent = chainPercent(chain);

  /*
    Sıradaki adım: tamamlanmamış ilk adım.

    Zincir SIRALI DEĞİL (kullanıcı istediği adımı yapabiliyor) ama
    arayüzün bir "şimdi bunu yap" önerisi olmalı — yoksa üç eşit kart
    arasında karar vermek kullanıcıya kalıyor ve kimse karar vermiyor.
  */
  const nextStep = steps.find((step) => !step.done) ?? null;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface">
      <UserHud title="Zincir" />

      {/* Tamamlanmışsa kutlama: bir kez, kullanıcı başına (localStorage). */}
      {chain.awarded ? (
        <ChainCelebration
          chainId={chain.chain_id}
          title={chain.title}
          bonusXp={chain.bonus_xp}
          bonusToken={chain.bonus_token}
        />
      ) : null}

      <main className="flex-1 px-4 py-4 has-bottom-nav">
        <Link
          href="/gorevler"
          className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
        >
          <Icon name="chevron-right" className="h-4 w-4 rotate-180" />
          Görevler
        </Link>

        {/* ------------------------------------------------------- başlık */}
        <section
          className={`rounded-3xl border p-4 ${
            chain.awarded
              ? "border-status-success/60 bg-status-success/5"
              : "border-edge bg-card"
          }`}
        >
          <div className="flex items-start gap-3">
            <span
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                chain.awarded
                  ? "bg-status-success/15 text-status-success"
                  : "bg-indigo/15 text-indigo"
              }`}
            >
              <Icon
                name={chain.awarded ? "check" : (chain.icon ?? "list-checks")}
                className="h-6 w-6"
              />
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-bold leading-snug text-ink">
                {chain.title}
              </h1>
              {chain.description ? (
                <p className="mt-1 text-sm text-ink-muted">
                  {chain.description}
                </p>
              ) : null}
            </div>
          </div>

          {/* İlerleme çubuğu: sayı + yüzde + çubuk birlikte. */}
          <p className="mt-4 flex items-center justify-between text-xs font-semibold">
            <span className="text-ink">
              {chain.done_count} / {chain.step_count} adım
            </span>
            <span className={chain.awarded ? "text-status-success" : "text-indigo"}>
              %{percent}
            </span>
          </p>
          <span className="mt-1.5 block h-2.5 w-full overflow-hidden rounded-full bg-surface">
            <span
              className={`block h-full rounded-full transition-all ${
                chain.awarded
                  ? "bg-status-success"
                  : "bg-gradient-to-r from-indigo to-primary"
              }`}
              style={{ width: `${percent}%` }}
            />
          </span>

          {/* Bonus vurgusu: zincirin var oluş sebebi. */}
          <div
            className={`mt-4 flex flex-wrap items-center gap-2 rounded-2xl px-3.5 py-2.5 ${
              chain.awarded
                ? "bg-status-success/10"
                : "bg-gradient-to-r from-indigo/10 to-primary/10"
            }`}
          >
            <span className="flex items-center gap-1.5 text-xs font-bold text-ink">
              <Icon name="gift" className="h-4 w-4 text-coin" />
              {chain.awarded ? "Zincir bonusu kazanıldı" : "Zincir bonusu"}
            </span>
            <span className="reward-pill inline-flex items-center gap-0.5 rounded-full bg-xp px-2 py-0.5 text-[11px] font-extrabold text-[#06283a]">
              <Icon name="zap" className="h-3 w-3" />+{chain.bonus_xp}
            </span>
            <span className="reward-pill inline-flex items-center gap-0.5 rounded-full bg-coin px-2 py-0.5 text-[11px] font-extrabold text-[#3a2a00]">
              <Icon name="coins" className="h-3 w-3" />+{chain.bonus_token}
            </span>
          </div>
        </section>

        {/* -------------------------------------------------------- adımlar */}
        <h2 className="mb-2 mt-5 text-sm font-semibold text-ink">Adımlar</h2>

        {steps.length === 0 ? (
          <EmptyState
            icon="list-checks"
            title="Bu zincirin adımları hazırlanıyor"
            description="Görevler eklendiğinde burada görünecek."
          />
        ) : (
          <ol className="flex flex-col gap-2">
            {steps.map((step, index) => {
              const isNext = step.task_id === nextStep?.task_id;
              return (
                <li key={step.task_id}>
                  <Link
                    href={`/gorevler/${step.task_id}`}
                    className={`press-soft flex items-center gap-3 rounded-2xl border bg-card p-3 ${
                      step.done
                        ? "border-status-success/50"
                        : isNext
                          ? "border-indigo bg-indigo/5"
                          : "border-edge"
                    }`}
                  >
                    {/*
                      Durum işareti: tik / sıradaki / kilit.

                      Kilit GÖRSEL, kısıt değil — adım sırası zorunlu
                      olmadığı için kilitli görünen adım da açılabiliyor.
                      Kapalı asma kilit denendi ve elendi: "yapamazsın"
                      diye okunuyordu. Numara + soluk renk aynı sırayı
                      anlatıyor ama yolu kapatmıyor.
                    */}
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
                        step.done
                          ? "bg-status-success text-white"
                          : isNext
                            ? "bg-indigo text-white"
                            : "bg-surface text-ink-muted"
                      }`}
                    >
                      {step.done ? (
                        <Icon name="check" className="h-5 w-5" strokeWidth={2.8} />
                      ) : (
                        index + 1
                      )}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        {step.icon ? (
                          <Icon
                            name={step.icon}
                            className="h-3.5 w-3.5 shrink-0 text-ink-muted"
                          />
                        ) : null}
                        <span
                          className={`line-clamp-2 text-[13px] font-semibold leading-snug ${
                            step.done ? "text-ink-muted" : "text-ink"
                          }`}
                        >
                          {step.title}
                        </span>
                      </span>

                      <span className="mt-1 flex items-center gap-1">
                        <span className="reward-pill inline-flex items-center gap-0.5 rounded-full bg-xp px-1.5 py-0.5 text-[10px] font-extrabold text-[#06283a]">
                          <Icon name="zap" className="h-3 w-3" />+{step.xp}
                        </span>
                        <span className="reward-pill inline-flex items-center gap-0.5 rounded-full bg-coin px-1.5 py-0.5 text-[10px] font-extrabold text-[#3a2a00]">
                          <Icon name="coins" className="h-3 w-3" />+{step.coin}
                        </span>
                        {isNext ? (
                          <span className="ml-1 rounded-full bg-indigo px-2 py-0.5 text-[10px] font-bold text-white">
                            Sıradaki
                          </span>
                        ) : null}
                      </span>
                    </span>

                    <Icon
                      name="chevron-right"
                      className="h-4 w-4 shrink-0 text-ink-muted"
                    />
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </main>

      <RewardFab />
      <UserBottomNav active="tasks" />
    </div>
  );
}
