"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useRef, useState } from "react";

import { submitReportAction } from "@/lib/problems/actions";
import { createClient } from "@/lib/supabase/client";
import {
  MAX_UPLOAD_MESSAGE,
  compressToLimit,
  describeUploadError,
} from "@/lib/upload";
import type { ProblemCategory } from "@/lib/problems/queries";

/*
  Ham dosya sinirinin sebebi ayri: 100 KB siniri sikistirmadan SONRAKI
  dosyaya uygulaniyor (bkz. lib/upload.ts). Buradaki sinir yalnizca
  tarayiciyi koruyor — 50 MB'lik bir kareyi cozmek telefonda sekmeyi
  kilitliyor.
*/
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;

const KINDS = [
  { value: "problem", label: "Sorun", hint: "Düzeltilmesi gereken bir durum" },
  { value: "oneri", label: "Öneri", hint: "İyileştirme fikri" },
  { value: "proje", label: "Proje", hint: "Daha kapsamlı bir öneri" },
] as const;

export function ReportForm({
  userId,
  categories,
}: {
  userId: string;
  categories: ProblemCategory[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [kind, setKind] = useState<string>("problem");
  const [categoryId, setCategoryId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [addressText, setAddressText] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [coords, setCoords] = useState<{
    lat: number;
    lng: number;
    accuracy: number;
  } | null>(null);

  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const busy = step !== null;

  function captureLocation() {
    setError(null);

    if (!("geolocation" in navigator)) {
      setError("Bu cihaz konum bilgisi vermiyor. Adresi elle yazabilirsin.");
      return;
    }

    setStep("Konum alınıyor...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: Math.round(position.coords.accuracy),
        });
        setStep(null);
      },
      (positionError) => {
        setStep(null);
        setError(
          positionError.code === positionError.PERMISSION_DENIED
            ? "Konum izni verilmedi. Adresi elle yazabilirsin."
            : "Konum alınamadı. Adresi elle yazabilirsin.",
        );
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }

  async function handleSubmit() {
    setError(null);
    setSuccess(null);

    if (!categoryId) {
      setError("Kategori seçmelisin.");
      return;
    }

    let photoPath: string | null = null;

    try {
      if (file) {
        if (file.size > MAX_SOURCE_BYTES) {
          setError("Fotoğraf 8 MB'tan küçük olmalı.");
          return;
        }

        setStep("Fotoğraf hazırlanıyor...");
        const { file: prepared, withinLimit } = await compressToLimit(file);

        if (!withinLimit) {
          setError(MAX_UPLOAD_MESSAGE);
          return;
        }

        setStep("Fotoğraf yükleniyor...");
        // Yol düzeni <user_id>/...: storage politikası ilk klasör adına bakıyor.
        const path = `${userId}/rapor-${Date.now()}.jpg`;
        const { error: uploadError } = await createClient()
          .storage.from("problem-photos")
          .upload(path, prepared, { upsert: false });

        if (uploadError) {
          setError(describeUploadError(uploadError));
          return;
        }
        photoPath = path;
      }

      setStep("Gönderiliyor...");
      const result = await submitReportAction({
        kind,
        categoryId: Number(categoryId),
        title,
        description,
        photoPath,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        addressText: addressText.trim() || null,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      setSuccess(`Bildirimin alındı 🎉  +${result.xp} XP • +${result.coin} Coin`);
      setTitle("");
      setDescription("");
      setAddressText("");
      setFile(null);
      setCoords(null);
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } finally {
      setStep(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-status-danger/40 bg-status-danger/10 px-3.5 py-2.5 text-sm text-status-danger"
        >
          {error}
        </p>
      ) : null}

      {success ? (
        <p
          role="status"
          className="rounded-xl border border-primary/40 bg-primary/10 px-3.5 py-2.5 text-sm font-medium text-primary-ink"
        >
          {success}
        </p>
      ) : null}

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-ink">Tür</legend>
        <div className="grid grid-cols-3 gap-2">
          {KINDS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setKind(item.value)}
              className={
                kind === item.value
                  ? "rounded-xl border border-primary bg-primary/10 px-2 py-2.5 text-center"
                  : "rounded-xl border border-edge bg-surface px-2 py-2.5 text-center"
              }
            >
              <span className="block text-sm font-semibold text-ink">
                {item.label}
              </span>
              <span className="mt-0.5 block text-[10px] leading-tight text-ink-muted">
                {item.hint}
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink">Kategori</span>
        <select
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          className="w-full rounded-xl border border-edge bg-surface px-3.5 py-2.5 text-base text-ink"
        >
          <option value="">Kategori seç</option>
          {categories.map((category) => (
            <option key={category.id} value={String(category.id)}>
              {category.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink">Başlık</span>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Kısa bir başlık"
          className="w-full rounded-xl border border-edge bg-surface px-3.5 py-2.5 text-base text-ink placeholder:text-ink-muted"
        />
        <span className="mt-1.5 block text-xs text-ink-muted">
          En az 5 karakter.
        </span>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink">Açıklama</span>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={4}
          placeholder="Ne olduğunu anlat"
          className="w-full rounded-xl border border-edge bg-surface px-3.5 py-2.5 text-base text-ink placeholder:text-ink-muted"
        />
        <span className="mt-1.5 block text-xs text-ink-muted">
          En az 15 karakter.
        </span>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink">
          Fotoğraf (isteğe bağlı)
        </span>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="w-full rounded-xl border border-edge bg-surface px-3.5 py-2.5 text-sm text-ink file:mr-3 file:rounded-full file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
        />
      </label>

      <div className="rounded-xl border border-edge bg-surface p-3.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-ink">Konum</span>
          <Button variant="secondary" size="sm" type="button" onClick={captureLocation} disabled={busy}>
            Konumumu kullan
          </Button>
        </div>

        {coords ? (
          <p className="mt-2 text-xs text-primary-ink">
            {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)} · ±{coords.accuracy} m
          </p>
        ) : (
          <p className="mt-2 text-xs text-ink-muted">
            Konum eklemek zorunlu değil; adresi yazarak da bildirebilirsin.
          </p>
        )}

        <input
          value={addressText}
          onChange={(event) => setAddressText(event.target.value)}
          placeholder="Adres veya tarif (isteğe bağlı)"
          className="mt-2.5 w-full rounded-xl border border-edge bg-card px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted"
        />
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={busy}
        className="w-full rounded-full btn-chunky bg-cta px-6 py-3 text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {step ?? "Gönder"}
      </button>
    </div>
  );
}
