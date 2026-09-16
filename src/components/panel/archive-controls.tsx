"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useState } from "react";

import {
  archiveRewardAction,
  setBadgeStatusAction,
} from "@/lib/panel/task-actions";

/**
 * Ödül kaldırma.
 *
 * Kupon verilmiş ödül silinmiyor, arşivleniyor: kuponların bağlı olduğu satırı
 * yok etmek kullanıcıların kupon geçmişini okunamaz hale getirirdi. Hiç
 * kullanılmamış ödül gerçekten siliniyor. Hangisinin olacağına sunucu karar
 * veriyor, burada tek buton var.
 */
export function RewardArchiveButton({ rewardId }: { rewardId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function run() {
    setPending(true);
    try {
      const result = await archiveRewardAction(rewardId);
      setMessage(result.error ?? result.notice ?? null);
      if (!result.error) {
        setConfirming(false);
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  if (message) {
    return <span className="text-[11px] text-ink-muted">{message}</span>;
  }

  if (!confirming) {
    return (
      <Button variant="danger" size="sm" type="button" onClick={() => setConfirming(true)}>
        Kaldır
      </Button>
    );
  }

  return (
    <span className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="rounded-full bg-status-danger px-3 py-1 text-[11px] font-semibold text-white disabled:opacity-60"
      >
        {pending ? "..." : "Onayla"}
      </button>
      <Button variant="secondary" size="sm" type="button" onClick={() => setConfirming(false)}>
        Vazgeç
      </Button>
    </span>
  );
}

/**
 * Rozet aktif/pasif anahtarı.
 * Rozet hiç silinmiyor: kazanılmış rozetlerin kaydı duruyor, pasif rozet
 * yalnızca yeni kazanımlara kapanıyor.
 */
export function BadgeStatusButton({
  badgeId,
  status,
}: {
  badgeId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const next = status === "active" ? "passive" : "active";

  async function run() {
    setPending(true);
    try {
      const result = await setBadgeStatusAction(badgeId, next);
      if (!result.error) router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={pending}
      className="rounded-full border border-edge px-3 py-1 text-[11px] font-medium text-ink-muted hover:text-ink disabled:opacity-60"
    >
      {pending ? "..." : next === "passive" ? "Pasife al" : "Aktif et"}
    </button>
  );
}
