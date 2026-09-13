"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { submitTaskAction } from "@/lib/tasks/actions";
import { createClient } from "@/lib/supabase/client";

/** Kanıt fotoğrafı üst sınırı. Telefon kamerası tek karede bunu aşmıyor. */
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

const NEEDS_PHOTO = ["photo", "photo_gps"];
const NEEDS_LOCATION = ["gps", "photo_gps"];

/** Tarayıcı konum hatasını anlaşılır Türkçeye çevirir. */
function locationErrorMessage(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "Konum izni verilmedi. Bu görev için tarayıcı ayarlarından konum iznini açman gerekiyor.";
    case error.POSITION_UNAVAILABLE:
      return "Konumun alınamadı. Açık alana çıkıp tekrar dene.";
    case error.TIMEOUT:
      return "Konum alınırken zaman aşımı oldu. Tekrar dene.";
    default:
      return "Konum alınamadı. Tekrar dene.";
  }
}

function readLocation(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Bu cihaz konum bilgisi vermiyor."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15_000,
      maximumAge: 0,
    });
  });
}

export function SubmitTask({
  taskId,
  userId,
  verification,
}: {
  taskId: string;
  userId: string;
  verification: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [step, setStep] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const needsPhoto = NEEDS_PHOTO.includes(verification);
  const needsLocation = NEEDS_LOCATION.includes(verification);
  const busy = pending || step !== null;

  async function handleSubmit() {
    setError(null);
    setSuccess(null);

    let photoPath: string | null = null;
    let lat: number | null = null;
    let lng: number | null = null;

    try {
      if (needsPhoto) {
        if (!file) {
          setError("Önce bir fotoğraf seç.");
          return;
        }
        if (file.size > MAX_PHOTO_BYTES) {
          setError("Fotoğraf 8 MB'tan küçük olmalı.");
          return;
        }

        setStep("Fotoğraf yükleniyor...");
        // Yol düzeni <user_id>/... olmak zorunda: storage politikası ilk
        // klasör adının kullanıcının kimliğiyle eşleşmesine bakıyor.
        const extension = file.name.split(".").pop() || "jpg";
        const path = `${userId}/${taskId}-${Date.now()}.${extension}`;

        const { error: uploadError } = await createClient()
          .storage.from("task-proofs")
          .upload(path, file, { upsert: false });

        if (uploadError) {
          setError("Fotoğraf yüklenemedi. Bağlantını kontrol edip tekrar dene.");
          return;
        }
        photoPath = path;
      }

      if (needsLocation) {
        setStep("Konum alınıyor...");
        try {
          const position = await readLocation();
          lat = position.coords.latitude;
          lng = position.coords.longitude;
        } catch (locationError) {
          setError(
            locationError instanceof GeolocationPositionError
              ? locationErrorMessage(locationError)
              : "Konum alınamadı. Tekrar dene.",
          );
          return;
        }
      }

      setStep("Gönderiliyor...");
      const result = await submitTaskAction(taskId, lat, lng, photoPath);

      if (result.error) {
        setError(result.error);
        return;
      }

      setSuccess(
        result.status === "approved"
          ? "Görev tamamlandı 🎉"
          : "Görevin incelemeye alındı.",
      );
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";

      // Durum rozeti ve katılım sayacı sunucuda hesaplanıyor; sayfanın
      // yeniden çekilmesi gerekiyor.
      startTransition(() => router.refresh());
    } finally {
      setStep(null);
    }
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

      {success ? (
        <p
          role="status"
          className="rounded-xl border border-primary/40 bg-primary/10 px-3.5 py-2.5 text-sm font-medium text-primary"
        >
          {success}
        </p>
      ) : null}

      {needsPhoto ? (
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink">
            Kanıt fotoğrafı
          </span>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(event) => {
              setError(null);
              setFile(event.target.files?.[0] ?? null);
            }}
            className="w-full rounded-xl border border-edge bg-surface px-3.5 py-2.5 text-sm text-ink file:mr-3 file:rounded-full file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-brand"
          />
          <span className="mt-1.5 block text-xs text-ink-muted">
            En fazla 8 MB.
          </span>
        </label>
      ) : null}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={busy}
        className="w-full rounded-full bg-cta px-6 py-3 text-base font-semibold text-brand transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {step ?? (verification === "gps" ? "Konumumu doğrula" : "Görevi tamamla")}
      </button>
    </div>
  );
}
