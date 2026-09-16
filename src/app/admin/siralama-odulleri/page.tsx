import { AdminShell } from "@/components/panel/admin-shell";
import { NoAccess } from "@/components/panel/panel-shell";
import { RewardSettingsTable } from "@/components/panel/reward-settings-table";
import { Icon } from "@/components/ui/icon";
import { isSuperAdmin } from "@/lib/panel/guard";
import {
  listAllRewardSettings,
  listRewardAwards,
} from "@/lib/leaderboard/rewards";

export const metadata = { title: "Sıralama Ödülleri — GençLİG" };

function when(value: string): string {
  return new Date(value).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function LeaderboardRewardsPage() {
  if (!(await isSuperAdmin())) {
    return <NoAccess message="Bu alan yalnızca süper adminlere açıktır." />;
  }

  const [settings, awards] = await Promise.all([
    listAllRewardSettings(),
    listRewardAwards(100),
  ]);

  return (
    <AdminShell subtitle={`${settings.length} ayar · ${awards.length} dağıtım`}>
      <section>
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Icon name="trophy" className="h-4 w-4 text-coin" />
          Ödül ayarları
        </h2>
        {/*
          Miktarlar tabloda tutuluyor, kodda değil: her değişiklik
          migration gerektirmesin ve yönetici dönem ortasında da
          ayarlayabilsin. Değişiklik ANINDA geçerli olmuyor — dağıtım
          dönem bitince çalışıyor.
        */}
        <RewardSettingsTable rows={settings} />
      </section>

      <section className="mt-6">
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Icon name="list-checks" className="h-4 w-4 text-primary" />
          Geçmiş dağıtımlar
        </h2>

        {awards.length === 0 ? (
          <p className="rounded-2xl border border-edge bg-card px-4 py-6 text-center text-sm text-ink-muted">
            Henüz dağıtım yapılmadı. İlk dönem bittiğinde burada
            listelenecek.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-edge bg-card">
            <table className="w-full min-w-[620px] text-left text-[13px]">
              <thead className="border-b border-edge bg-surface text-[11px] uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="px-3.5 py-2.5 font-semibold">Zaman</th>
                  <th className="px-3.5 py-2.5 font-semibold">Dönem</th>
                  <th className="px-3.5 py-2.5 font-semibold">Kapsam</th>
                  <th className="px-3.5 py-2.5 font-semibold">Sıra</th>
                  <th className="px-3.5 py-2.5 font-semibold">Ödül</th>
                  <th className="px-3.5 py-2.5 font-semibold">Alan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge">
                {awards.map((row) => (
                  <tr
                    key={row.id}
                    className="transition-colors hover:bg-surface"
                  >
                    <td className="whitespace-nowrap px-3.5 py-2.5 tabular-nums text-ink-muted">
                      {when(row.created_at)}
                    </td>
                    <td className="px-3.5 py-2.5 font-mono text-[11px] text-ink">
                      {row.period_key}
                    </td>
                    <td className="px-3.5 py-2.5 text-ink-muted">
                      {row.scope === "takimlar" ? "Takım" : "Türkiye"}
                    </td>
                    <td className="px-3.5 py-2.5">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-coin/20 text-[11px] font-bold text-coin">
                        {row.rank}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 tabular-nums text-ink">
                      +{row.xp} XP · +{row.token} Token
                    </td>
                    <td className="px-3.5 py-2.5 font-mono text-[10px] text-ink-muted">
                      {/*
                        Kimlik kısaltılmış gösteriliyor: bu tablo "kime
                        gitti" değil "dağıtıldı mı" sorusunu yanıtlıyor.
                        Kullanıcı adı için ikinci bir sorgu açmak, tablo
                        yüz satıra çıktığında gereksiz maliyetti.
                      */}
                      {(row.user_id ?? row.team_id ?? "—").slice(0, 8)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AdminShell>
  );
}
