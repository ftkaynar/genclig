"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { setAvatarUrlAction } from "@/lib/profile/actions";
import { createClient } from "@/lib/supabase/client";
import { compressImage, formatBytes } from "@/lib/upload";

const MAX_AVATAR_BYTES = 8 * 1024 * 1024;

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

    if (file.size > MAX_AVATAR_BYTES) {
      setError("Görsel 8 MB'tan küçük olmalı.");
      return;
    }

    try {
      setStep("Görsel hazırlanıyor...");
      const prepared = await compressImage(file, 512, 0.8);
      setSizeNote(
        `${formatBytes(file.size)} → ${formatBytes(prepared.size)} olarak küçültüldü.`,
      );

      setStep("Yükleniyor...");
      const supabase = createClient();
      // Yol düzeni <user_id>/...: storage politikası ilk klasör adının
      // kullanıcının kimliğiyle eşleşmesine bakıyor.
      const path = `${userId}/avatar-${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, prepared, { upsert: true });

      if (uploadError) {
        setError("Görsel yüklenemedi. Tekrar dene.");
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
            className="w-full rounded-xl border border-edge bg-surface px-3 py-2 text-xs text-ink file:mr-2 file:rounded-full file:border-0 file:bg-primary file:px-2.5 file:py-1 file:text-[11px] file:font-semibold file:text-brand"
          />
        </label>

        {step ? (
          <p className="mt-1.5 text-xs text-ink-muted">{step}</p>
        ) : sizeNote ? (
          <p className="mt-1.5 text-xs text-primary">{sizeNote}</p>
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
