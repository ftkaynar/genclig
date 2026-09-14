"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { reviewSubmissionAction } from "@/lib/panel/actions";

export type ReviewItem = {
  id: string;
  taskTitle: string;
  username: string | null;
  createdAt: string;
  photoUrl: string | null;
  photoPath: string | null;
  distanceM: number | null;
};

/**
 * İnceleme kuyruğu.
 *
 * Fotoğraf imzalı URL ile gösteriliyor; bucket private ve personelin okuma
 * politikası teslim satırı üzerinden kuruluyor. İmzalı URL üretilemezse
 * (politika ya da süre sorunu) dosya yolu metin olarak gösteriliyor: incelemeyi
 * tamamen bloke etmektense yolu görüp Studio'dan bakmak yeğ.
 */
export function ReviewQueue({ items }: { items: ReviewItem[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function run(
    id: string,
    action: "approve" | "reject",
    rejectReason?: string,
  ) {
    setError(null);
    setPendingId(id);
    try {
      const result = await reviewSubmissionAction(id, action, rejectReason);
      if (result.error) {
        setError(result.error);
        return;
      }
      setRejecting(null);
      setReason("");
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-edge bg-card px-4 py-8 text-center text-sm text-ink-muted">
        Bekleyen inceleme yok.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-status-danger/40 bg-status-danger/10 px-3.5 py-2.5 text-sm text-status-danger"
        >
          {error}
        </p>
      ) : null}

      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="rounded-2xl border border-edge bg-card p-4"
          >
            <p className="text-sm font-semibold text-ink">{item.taskTitle}</p>
            <p className="mt-0.5 text-xs text-ink-muted">
              {item.username ?? "kullanıcı"} ·{" "}
              {new Date(item.createdAt).toLocaleString("tr-TR")}
            </p>
            {item.distanceM !== null ? (
              <p className="mt-0.5 text-xs text-ink-muted">
                Hedefe uzaklık: {Math.round(item.distanceM)} m
              </p>
            ) : null}

            {item.photoUrl ? (
              // Kanıt fotoğrafı; imzalı URL kısa ömürlü olduğu için
              // optimizasyondan geçirilmiyor.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.photoUrl}
                alt="Görev kanıtı"
                className="mt-3 w-full rounded-xl border border-edge object-cover"
              />
            ) : item.photoPath ? (
              <p className="mt-3 break-all rounded-xl bg-surface px-3 py-2 text-[11px] text-ink-muted">
                Fotoğraf önizlemesi üretilemedi. Dosya yolu: {item.photoPath}
              </p>
            ) : null}

            {rejecting === item.id ? (
              <div className="mt-3">
                <input
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Red sebebi"
                  className="w-full rounded-xl border border-edge bg-surface px-3 py-2 text-sm text-ink"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => run(item.id, "reject", reason)}
                    disabled={pendingId === item.id}
                    className="flex-1 rounded-full bg-status-danger px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    Reddet
                  </button>
                  <button
                    type="button"
                    onClick={() => setRejecting(null)}
                    className="flex-1 rounded-full border border-edge px-4 py-2 text-sm font-medium text-ink-muted"
                  >
                    Vazgeç
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => run(item.id, "approve")}
                  disabled={pendingId === item.id}
                  className="flex-1 rounded-full bg-cta px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {pendingId === item.id ? "..." : "Onayla"}
                </button>
                <button
                  type="button"
                  onClick={() => setRejecting(item.id)}
                  disabled={pendingId === item.id}
                  className="flex-1 rounded-full border border-status-danger/50 px-4 py-2 text-sm font-medium text-status-danger disabled:opacity-60"
                >
                  Reddet
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
