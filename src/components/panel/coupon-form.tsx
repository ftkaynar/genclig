"use client";

import { useState } from "react";

import { markCouponUsedAction } from "@/lib/panel/actions";

export function CouponForm() {
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    setNotice(null);
    setPending(true);
    try {
      const result = await markCouponUsedAction(code.trim().toUpperCase());
      if (result.error) {
        setError(result.error);
        return;
      }
      setNotice(result.notice ?? "Kupon kullanıldı.");
      setCode("");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <p role="alert" className="rounded-xl border border-status-danger/40 bg-status-danger/10 px-3.5 py-2.5 text-sm text-status-danger">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="rounded-xl border border-primary/40 bg-primary/10 px-3.5 py-2.5 text-sm font-medium text-primary-ink">
          {notice}
        </p>
      ) : null}

      <input
        value={code}
        onChange={(event) => setCode(event.target.value.toUpperCase())}
        placeholder="ABCD1234"
        maxLength={8}
        className="w-full rounded-xl border border-edge bg-surface px-3.5 py-2.5 text-center font-mono text-lg tracking-widest text-ink placeholder:text-ink-muted"
      />

      <button
        type="button"
        onClick={handleSubmit}
        disabled={pending || code.trim().length < 4}
        className="w-full rounded-full btn-chunky bg-cta px-6 py-3 text-base font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Kontrol ediliyor..." : "Kodu kullan"}
      </button>
    </div>
  );
}
