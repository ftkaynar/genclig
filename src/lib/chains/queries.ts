import { createClient } from "@/lib/supabase/server";
import {
  isKnownMissing,
  isMissingSchema,
  markMissing,
} from "@/lib/supabase/schema-guard";

/*
  Görev Zincirleri (D33 FAZ Z).

  Zincir = birkaç görevlik bir seri. Hepsi tamamlanınca bonus. Bonusu
  veritabanı yazıyor (check_chain_completion); buradaki iş yalnız
  ilerlemeyi okumak.

  İlerleme sayımı RPC'de: RLS kullanıcıya yalnız kendi teslimlerini
  gösteriyor ama "kaç adım tamamlandı" sorusunun cevabı yine de doğru
  olmalı ve istemcide saymak yanlış sonuç veriyordu.

  Şema geride kalırsa boş liste dönüyor ve bant hiç çizilmiyor — D32'de
  ölçtüğümüz kesintiyi tekrarlamamak için.
*/

const CHAINS_RPC = "my_chains";

export type ChainRow = {
  chain_id: string;
  title: string;
  description: string;
  icon: string | null;
  bonus_xp: number;
  bonus_token: number;
  step_count: number;
  done_count: number;
  awarded: boolean;
};

export type ChainStep = {
  task_id: string;
  title: string;
  icon: string | null;
  xp: number;
  coin: number;
  sort: number;
  done: boolean;
};

/** Aktif zincirler, kullanıcının ilerlemesiyle. */
export async function listMyChains(): Promise<ChainRow[]> {
  if (isKnownMissing(CHAINS_RPC)) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_chains");

  if (error) {
    if (isMissingSchema(error)) markMissing(CHAINS_RPC);
    return [];
  }

  /*
    Adımsız zincir gizleniyor: yönetici zinciri açıp adımlarını henüz
    eklemediyse kart "0/0" gösterirdi ve tıklanınca boş bir detay
    açardı. Yarım bir zincir, hiç olmayandan kötü.
  */
  return ((data ?? []) as ChainRow[]).filter((row) => row.step_count > 0);
}

/** Tek zincirin adımları. */
export async function listChainSteps(chainId: string): Promise<ChainStep[]> {
  if (isKnownMissing(CHAINS_RPC)) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("chain_steps_of", {
    p_chain: chainId,
  });

  if (error) {
    if (isMissingSchema(error)) markMissing(CHAINS_RPC);
    return [];
  }

  return (data ?? []) as ChainStep[];
}

/** Tek zincirin özeti; bulunamazsa null. */
export async function getChain(chainId: string): Promise<ChainRow | null> {
  const chains = await listMyChains();
  return chains.find((row) => row.chain_id === chainId) ?? null;
}

/** İlerleme yüzdesi — çubuk genişliği için. */
export function chainPercent(row: {
  step_count: number;
  done_count: number;
}): number {
  if (row.step_count <= 0) return 0;
  return Math.min(100, Math.round((row.done_count / row.step_count) * 100));
}
