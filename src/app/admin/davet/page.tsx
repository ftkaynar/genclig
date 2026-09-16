import { AdminShell } from "@/components/panel/admin-shell";
import { NoAccess } from "@/components/panel/panel-shell";
import {
  ReferralSettings,
  type ReferralSettingsRow,
} from "@/components/panel/referral-settings";
import { Icon } from "@/components/ui/icon";
import { isSuperAdmin } from "@/lib/panel/guard";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Davet — GençLİG Admin" };

function when(value: string): string {
  return new Date(value).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminReferralPage() {
  if (!(await isSuperAdmin())) {
    return <NoAccess message="Bu alan yalnızca süper adminlere açıktır." />;
  }

  const supabase = await createClient();

  /*
    Ödül geçmişi: kullanıcı adları AYRI sorguda.

    referral_awards -> profiles gömmesi iki farklı sütundan (inviter_id
    ve invited_user_id) aynı tabloya gidiyor; PostgREST bunu ayrıştırmak
    için FK adı istiyor ve ad değişince sorgu sessizce kırılıyor (D29'da
    ölçüldü). İki sorgu + haritayla birleştirme dayanıklı.
  */
  const [{ data: settingsRow }, { data: awardRows }] = await Promise.all([
    supabase
      .from("referral_settings")
      .select("inviter_xp,inviter_token,invited_xp,invited_token,active")
      .eq("id", 1)
      .maybeSingle(),
    supabase
      .from("referral_awards")
      .select("invited_user_id,inviter_id,awarded_at")
      .order("awarded_at", { ascending: false })
      .limit(50),
  ]);

  const awards = (awardRows ?? []) as {
    invited_user_id: string;
    inviter_id: string;
    awarded_at: string;
  }[];

  const ids = [
    ...new Set(awards.flatMap((a) => [a.invited_user_id, a.inviter_id])),
  ];

  const names = new Map<string, string>();
  if (ids.length > 0) {
    const { data: profileRows } = await supabase
      .from("profiles")
      .select("id,username")
      .in("id", ids);

    for (const row of (profileRows ?? []) as {
      id: string;
      username: string | null;
    }[]) {
      names.set(row.id, row.username ?? "—");
    }
  }

  const settings: ReferralSettingsRow = settingsRow ?? {
    inviter_xp: 100,
    inviter_token: 100,
    invited_xp: 50,
    invited_token: 50,
    active: true,
  };

  return (
    <AdminShell subtitle={`${awards.length} ödül dağıtımı`}>
      <p className="mb-4 rounded-xl border border-edge bg-card px-3.5 py-2.5 text-xs text-ink-muted">
        Ödül, davet edilen kullanıcının{" "}
        <strong className="text-ink">ilk onaylı görevinde</strong> bir kez
        yazılır — kayıt anında değil. Kayıt bedava, onaylı görev değil; ödülü
        ilk gerçek katkıya bağlamak sahte hesapla kod toplamanın önündeki
        temel frendir. Cihaz/IP kontrolü{" "}
        <strong className="text-ink">yok</strong>.
      </p>

      <section>
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Icon name="gift" className="h-4 w-4 text-coin" />
          Ödül ayarları
        </h2>
        <ReferralSettings row={settings} />
      </section>

      <section className="mt-6">
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Icon name="users" className="h-4 w-4 text-cyan" />
          Son dağıtımlar
        </h2>

        {awards.length === 0 ? (
          <p className="rounded-2xl border border-edge bg-card px-4 py-6 text-center text-sm text-ink-muted">
            Henüz davet ödülü dağıtılmadı.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {awards.map((award) => (
              <li
                key={award.invited_user_id}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-edge bg-card px-3.5 py-2 text-sm"
              >
                <span className="font-semibold text-ink">
                  {names.get(award.inviter_id) ?? "—"}
                </span>
                <Icon
                  name="chevron-right"
                  className="h-3.5 w-3.5 text-ink-muted"
                />
                <span className="text-ink">
                  {names.get(award.invited_user_id) ?? "—"}
                </span>
                <span className="ml-auto text-xs text-ink-muted">
                  {when(award.awarded_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AdminShell>
  );
}
