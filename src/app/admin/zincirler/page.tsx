import { AdminShell } from "@/components/panel/admin-shell";
import {
  ChainEditor,
  type ChainTaskOption,
} from "@/components/panel/chain-editor";
import { NoAccess } from "@/components/panel/panel-shell";
import type { AdminChainRow } from "@/lib/chains/admin";
import { isSuperAdmin } from "@/lib/panel/guard";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Zincirler — GençLİG Admin" };

export default async function AdminChainsPage() {
  if (!(await isSuperAdmin())) {
    return <NoAccess message="Bu alan yalnızca süper adminlere açıktır." />;
  }

  const supabase = await createClient();

  /*
    Zincirler ve adımları AYRI okunuyor, gömülü ilişkiyle değil.

    PostgREST gömmesi gerçek bir FK istiyor ve chain_steps -> tasks
    üzerinden iki seviye gömmek sorguyu tek bir hataya bağlıyor (D24 ve
    D29'da ölçüldü: FK'siz gömme sorgunun TAMAMINI düşürüyor). İki
    sorgu + istemcide birleştirme, yönetici ekranı için fazlasıyla
    yeterli.
  */
  const [{ data: chainRows }, { data: stepRows }, { data: taskRows }] =
    await Promise.all([
      supabase
        .from("task_chains")
        .select("id,title,description,icon,bonus_xp,bonus_token,status,sort")
        .order("sort")
        .order("created_at"),
      supabase.from("chain_steps").select("chain_id,task_id,sort").order("sort"),
      supabase
        .from("tasks")
        .select("id,title")
        .eq("status", "active")
        .is("municipality_id", null)
        .order("title"),
    ]);

  const steps = new Map<string, string[]>();
  for (const row of (stepRows ?? []) as {
    chain_id: string;
    task_id: string;
  }[]) {
    const list = steps.get(row.chain_id) ?? [];
    list.push(row.task_id);
    steps.set(row.chain_id, list);
  }

  const chains: AdminChainRow[] = (
    (chainRows ?? []) as Omit<AdminChainRow, "step_ids">[]
  ).map((row) => ({ ...row, step_ids: steps.get(row.id) ?? [] }));

  const tasks = (taskRows ?? []) as ChainTaskOption[];

  return (
    <AdminShell subtitle={`${chains.length} zincir · ${tasks.length} aday görev`}>
      <p className="mb-4 rounded-xl border border-edge bg-card px-3.5 py-2.5 text-xs text-ink-muted">
        Zincir, birkaç görevlik bir seridir. Kullanıcı tüm adımları
        tamamladığında bonus <strong className="text-ink">bir kez</strong>{" "}
        yazılır. Adım sırası yalnızca gösterim sırasıdır; kullanıcı adımları
        istediği sırayla yapabilir. Yayından kaldırmak için{" "}
        <strong className="text-ink">Pasif</strong> kullan — silmek, bonusu
        almış kullanıcıların kaydını da siler ve zincir yeniden açılırsa
        herkes ikinci kez ödül alır.
      </p>

      <ChainEditor chains={chains} tasks={tasks} />
    </AdminShell>
  );
}
