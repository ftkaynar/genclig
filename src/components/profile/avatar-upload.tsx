"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { setAvatarUrlAction } from "@/lib/profile/actions";
import { createClient } from "@/lib/supabase/client";
import {
  MAX_UPLOAD_MESSAGE,
  compressToLimit,
  describeUploadError,
  formatBytes,
} from "@/lib/upload";

/*
  Ham dosya sinirinin sebebi ayri: 100 KB siniri sikistirmadan SONRAKI
  dosyaya uygulaniyor (bkz. lib/upload.ts). Buradaki sinir yalnizca
  tarayiciyi koruyor — 50 MB'lik bir kareyi cozmek telefonda sekmeyi
  kilitliyor.
*/
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;

export function AvatarUpload({
  userId,
  currentUrl,
}: {
  userId: string;
  currentUrl: string | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<string | null>(currentUrl);
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sizeNote, setSizeNote] = useState<string | null>(null);

  async function handleChange(file: File) {
    setError(null);
    setSizeNote(null);

    if (file.size > MAX_SOURCE_BYTES) {
      setError("Görsel 8 MB'tan küçük olmalı.");
      return;
    }

    try {
      setStep("Görsel hazırlanıyor...");
      // 512px avatar için fazlasıyla yeterli; sınıra inene kadar önce
      // kalite, sonra çözünürlük düşüyor.
      const { file: prepared, withinLimit } = await compressToLimit(file, 512);

      if (!withinLimit) {
        setError(MAX_UPLOAD_MESSAGE);
        return;
      }

      setSizeNote(
        `${formatBytes(file.size)} → ${formatBytes(prepared.size)} olarak küçültüldü.`,
      );

      setStep("Yükleniyor...");
      const supabase = createClient();
      // Yol düzeni <user_id>/...: storage politikası ilk klasör adının
      // kullanıcının kimliğiyle eşleşmesine bakıyor.
      const path = `${userId}/avatar-${Date.now()}.jpg`;

      /*
        upsert kapalı: yol zaten zaman damgalı, üzerine yazılacak bir satır
        yok. Açıkken storage isteği `on conflict do update` olarak
        çalışıyor ve çakışan satırı okumak için SELECT politikası arıyordu;
        avatars bucket'ında o politika yoktu ve yükleme RLS'e takılıyordu.
        Politika M28a'da eklendi, bayrak da kaldırıldı — iki taraflı düzeltme.
      */
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, prepared, { upsert: false });

      if (uploadError) {
        setError(describeUploadError(uploadError));
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(path);

      await setAvatarUrlAction(publicUrl);
      setPreview(publicUrl);
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } finally {
      setStep(null);
    }
  }

  return (
    <div className="flex items-center gap-3.5">
      {preview ? (
        <Image
          src={preview}
          alt=""
          width={64}
          height={64}
          className="h-16 w-16 rounded-full object-cover"
          unoptimized
        />
      ) : (
        <span
          aria-hidden
          className="brand-gradient flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold text-white"
        >
          ?
        </span>
      )}

      <div className="min-w-0 flex-1">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink">
            Profil görseli
          </span>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            disabled={step !== null}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleChange(file);
            }}
            className="w-full rounded-xl border border-edge bg-surface px-3 py-2 text-xs text-ink file:mr-2 file:rounded-full file:border-0 file:bg-primary file:px-2.5 file:py-1 file:text-[11px] file:font-semibold file:text-white"
          />
        </label>

        {step ? (
          <p className="mt-1.5 text-xs text-ink-muted">{step}</p>
        ) : sizeNote ? (
          <p className="mt-1.5 text-xs text-primary-ink">{sizeNote}</p>
        ) : null}

        {error ? (
          <p role="alert" className="mt-1.5 text-xs text-status-danger">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
