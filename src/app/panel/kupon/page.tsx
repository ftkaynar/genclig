import { NoAccess, PanelShell } from "@/components/panel/panel-shell";
import { CouponForm } from "@/components/panel/coupon-form";
import { PANEL_NAV } from "@/lib/panel/nav";
import { getPanelContext } from "@/lib/panel/guard";

export const metadata = { title: "Kupon — GençLİG Panel" };

export default async function PanelCouponPage() {
  const context = await getPanelContext();
  if (!context) {
    return <NoAccess message="Bu sayfa belediye personeline açıktır." />;
  }

  return (
    <PanelShell
      title="GençLİG Belediye Paneli"
      subtitle={context.municipalityName}
      nav={PANEL_NAV}
    >
      <section className="max-w-md rounded-2xl border border-edge bg-card p-5">
        <h2 className="text-sm font-semibold text-ink">Kupon kodu kullan</h2>
        <p className="mt-1 text-xs text-ink-muted">
          Kullanıcının gösterdiği 8 haneli kodu gir.
        </p>
        <div className="mt-4">
          <CouponForm />
        </div>
      </section>
    </PanelShell>
  );
}
