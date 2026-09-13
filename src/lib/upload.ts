"use client";

/**
 * Yüklemeden önce görseli küçültür.
 *
 * Telefon kamerası 4-8 MB'lık kareler üretiyor; bunları olduğu gibi yüklemek
 * hem mobil veriyi yiyor hem de yükleme süresini kullanıcının vazgeçeceği
 * kadar uzatıyordu. Kanıt fotoğrafı ve avatar için 1600 piksel fazlasıyla
 * yeterli.
 *
 * Denenen ve elenen alternatif: sunucu tarafında sıkıştırma. Elendi, çünkü
 * büyük dosya yine de ağdan geçmek zorunda kalırdı; kazanç asıl yükleme
 * adımında.
 *
 * Sıkıştırma başarısız olursa (tarayıcı desteği, bozuk dosya) özgün dosya
 * döndürülüyor: akışı kırmaktansa büyük dosyayı yüklemek yeğdir.
 */
export async function compressImage(
  file: File,
  maxDim = 1600,
  quality = 0.72,
): Promise<File> {
  if (!file.type.startsWith("image/")) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);

    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return file;
    }

    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", quality);
    });

    if (!blob) {
      return file;
    }

    // Küçültme bazen büyütüyor (zaten sıkıştırılmış küçük PNG gibi).
    // O durumda özgün dosya korunuyor.
    if (blob.size >= file.size) {
      return file;
    }

    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

/** Bayt sayısını okunur biçime çevirir. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
