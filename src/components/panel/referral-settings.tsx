"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { saveReferralSettingsAction } from "@/lib/referrals/admin";

export type ReferralSettingsRow = {
  inviter_xp: number;
  inviter_token: number;
  invited_xp: number;
  invited_token: number;
  active: boolean;
};

const inputClass =
  "min-h-[40px] w-full rounded-xl border border-edge bg-surface px-3 text-sm text-ink outline-none focus:border-primary";

/*
  Davet ödülü ayarları (D33 FAZ DV).

  Miktarlar tabloda tutuluyor, kodda değil: her değişiklik migration
  gerektirmesin ve yönetici kampanya sırasında da ayarlayabilsin.

  Değişiklik GERİYE DÖNÜK DEĞİL: daha önce verilmiş ödüller
  referral_awards kapısıyla kilitli, yalnız bundan sonraki davetler
  yeni miktarı alıyor. Ekran bunu açıkça söylüyor — "100'ü 200 yaparsam
  eskiler de artar mı" sorusu sorulmasın diye.
*/
export function ReferralSettings({ row }: { row: ReferralSettingsRow }) {
  const router = useRouter();
  const [draft, setDraft] = useState(row);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  function set<K extends keyof ReferralSettingsRow>(
    key: K,
    value: ReferralSettingsRow[K],
  ) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setPending(true);
    setNotice(null);
    try {
      const result = await saveReferralSettingsAction({
        inviterXp: String(draft.inviter_xp),
        inviterToken: String(draft.inviter_token),
        invitedXp: String(draft.invited_xp),
        invitedToken: String(draft.invited_token),
        active: draft.active,
      });
      setNotice(result.error ?? result.notice ?? null);
      if (!result.error) router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-2xl border border-edge bg-card p-4">
      {notice ? (
        <p
          role="status"
          className="mb-3 rounded-xl border border-edge bg-surface px-3.5 py-2 text-sm text-ink"
        >
          {notice}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className="mb-1 block text-xs font-medium text-ink">
            Davet edene XP
          </span>
          <input
            type="number"
            min={0}
            value={draft.inviter_xp}
            onChange={(e) => set("inviter_xp", Number(e.target.value))}
            className={inputClass}
          />
        </label>

        <label>
          <span className="mb-1 block text-xs font-medium text-ink">
            Davet edene Token
          </span>
          <input
            type="number"
            min={0}
            value={draft.inviter_token}
            onChange={(e) => set("inviter_token", Number(e.target.value))}
            className={inputClass}
          />
        </label>

        <label>
          <span className="mb-1 block text-xs font-medium text-ink">
            Davet edilene XP
          </span>
          <input
            type="number"
            min={0}
            value={draft.invited_xp}
            onChange={(e) => set("invited_xp", Number(e.target.value))}
            className={inputClass}
          />
        </label>

        <label>
          <span className="mb-1 block text-xs font-medium text-ink">
            Davet edilene Token
          </span>
          <input
            type="number"
            min={0}
            value={draft.invited_token}
            onChange={(e) => set("invited_token", Number(e.target.value))}
            className={inputClass}
          />
        </label>
      </div>

      <label className="mt-3 flex items-center gap-2">
        <input
          type="checkbox"
          checked={draft.active}
          onChange={(e) => set("active", e.target.checked)}
          className="h-4 w-4 accent-[var(--color-primary)]"
        />
        <span className="text-sm text-ink">Davet ödülleri açık</span>
      </label>

      <p className="mt-2 text-[11px] text-ink-muted">
        Kapatıldığında kodlar çalışmaya devam eder (bağ kurulur) ama ödül
        yazılmaz. Değişiklik geriye dönük değildir.
      </p>

      <div className="mt-4">
        <Button
          variant="primary"
          size="sm"
          type="button"
          disabled={pending}
          onClick={save}
        >
          Kaydet
        </Button>
      </div>
    </section>
  );
}
