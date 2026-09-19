import Link from "next/link";

import { Icon } from "@/components/ui/icon";
import { TokenReward, XpReward } from "@/components/ui/task-reward";
import { chainPercent, type ChainRow } from "@/lib/chains/queries";

/*
  Zincir kartı — TEK KAYNAK (D36 FAZ ZR).

  Bu işaretleme chain-strip.tsx içinde gömülüydü. /zincirler index
  sayfası eklenince aynı kartın ikinci bir kopyası gerekiyordu; iki
  kopya tutmak, birinin unutulması demek (aynı sınıf hata D24 ve
  D30'da ölçüldü, D35'te labels.ts ile çözülmüştü).

  Kartın taşıdığı üç şey: ne olduğu (ikon + ad), nerede kalındığı
  (1/3 + çubuk) ve ne kazandıracağı (bonus rozeti). Dördüncü bir bilgi
  (açıklama) şerit kartına sığmıyor — index sayfasında yer var, bu
  yüzden `withDescription` ile açılıyor.

  Tamamlanmış zincir listede KALIYOR ama yeşil tikle: kullanıcının
  bitirdiği şeyi listeden silmek emeğini görünmez kılıyordu.
*/
export function ChainCard({
  chain,
  withDescription = false,
}: {
  chain: ChainRow;
  /** index sayfasında açıklama da görünüyor; dar şeritte görünmüyor. */
  withDescription?: boolean;
}) {
  const percent = chainPercent(chain);

  return (
    <Link
      href={`/zincirler/${chain.chain_id}`}
      className={`press-soft flex h-full flex-col gap-2 rounded-2xl border bg-card p-3 ${
        chain.awarded
          ? "border-status-success/60"
          : "border-edge hover:border-indigo/60"
      }`}
    >
      <span className="flex items-center gap-2">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
            chain.awarded
              ? "bg-status-success/15 text-status-success"
              : "bg-indigo/15 text-indigo"
          }`}
        >
          <Icon
            name={chain.awarded ? "check" : (chain.icon ?? "list-checks")}
            className="h-4 w-4"
          />
        </span>
        <span className="line-clamp-2 min-w-0 flex-1 text-[13px] font-bold leading-snug text-ink">
          {chain.title}
        </span>
      </span>

      {withDescription && chain.description ? (
        <span className="line-clamp-2 text-[11px] leading-snug text-ink-muted">
          {chain.description}
        </span>
      ) : null}

      {/* İlerleme: sayı + çubuk. Sayı kesin, çubuk hızlı okunur. */}
      <span className="flex items-center justify-between text-[11px] font-semibold">
        <span className="text-ink-muted">
          {chain.done_count} / {chain.step_count} adım
        </span>
        <span className={chain.awarded ? "text-status-success" : "text-indigo"}>
          %{percent}
        </span>
      </span>

      <span className="block h-1.5 w-full overflow-hidden rounded-full bg-surface">
        <span
          className={`block h-full rounded-full transition-all ${
            chain.awarded
              ? "bg-status-success"
              : "bg-gradient-to-r from-indigo to-primary"
          }`}
          style={{ width: `${percent}%` }}
        />
      </span>

      <span className="mt-auto flex flex-wrap items-center gap-1">
        {chain.awarded ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-status-success/15 px-2 py-0.5 text-[10px] font-bold text-status-success">
            <Icon name="check" className="h-3 w-3" />
            Tamamlandı
          </span>
        ) : (
          <>
            <XpReward value={chain.bonus_xp} size="sm" className="reward-pill" />
            <TokenReward
              value={chain.bonus_token}
              size="sm"
              className="reward-pill"
              iconId={`chain-${chain.chain_id}`}
            />
          </>
        )}
      </span>
    </Link>
  );
}
