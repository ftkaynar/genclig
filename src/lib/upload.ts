"use client";

/*
  Görsel yükleme yardımcıları.

  Telefon kamerası 4-8 MB'lık kareler üretiyor; bunları olduğu gibi yüklemek
  hem mobil veriyi yiyor hem de yükleme süresini kullanıcının vazgeçeceği
  kadar uzatıyordu.

  Denenen ve elenen alternatif: sunucu tarafında sıkıştırma. Elendi, çünkü
  büyük dosya yine de ağdan geçmek zorunda kalırdı; kazanç asıl yükleme
  adımında.
*/

/**
 * Yüklenecek dosyanın üst sınırı.
 *
 * Kullanıcının SEÇTİĞİ dosyaya değil, sıkıştırmadan SONRA yüklenecek
 * dosyaya uygulanıyor: aksi hâlde kamerayla çekilen hiçbir fotoğraf
 * yüklenemezdi. Sıkıştırma bu sınırın altına inene kadar önce kaliteyi,
 * sonra çözünürlüğü düşürüyor; yine inemezse kullanıcı reddediliyor.
 */
export const MAX_UPLOAD_BYTES = 100 * 1024;

/** Sınır aşıldığında gösterilen ortak mesaj. */
export const MAX_UPLOAD_MESSAGE = "Görsel en fazla 100 KB olabilir.";

/*
  Sıkıştırma merdiveni.

  Önce kalite düşüyor (görüntü boyutu korunuyor, en az bozulma), kalite
  tabana dayandığında çözünürlük yarılanıyor. Denenen ve elenen alternatif:
  tek geçişte agresif kalite (0.4). Elendi — küçük ve zaten optimize bir
  görselde gereksiz bozulma yapıyordu; merdiven ilk sığan adımda duruyor.
*/
const QUALITY_STEPS = [0.82, 0.72, 0.62, 0.5, 0.4, 0.3];
const DIMENSION_FACTORS = [1, 0.75, 0.5];

type CompressResult = {
  /** Yüklenecek dosya. Sınıra inilemediyse en küçük deneme dönüyor. */
  file: File;
  /** Sınırın altına inildi mi? */
  withinLimit: boolean;
};

async function encode(
  bitmap: ImageBitmap,
  maxDim: number,
  quality: number,
): Promise<Blob | null> {
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  context.drawImage(bitmap, 0, 0, width, height);

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", quality);
  });
}

/**
 * Görseli sınırın altına inecek şekilde sıkıştırır.
 *
 * Sıkıştırma hiç çalışmazsa (tarayıcı desteği, bozuk dosya) özgün dosya
 * dönüyor ve `withinLimit` özgün boyuta göre hesaplanıyor: akışı kırmaktansa
 * çağıranın karar vermesi doğru.
 */
export async function compressToLimit(
  file: File,
  maxDim = 1600,
  limitBytes = MAX_UPLOAD_BYTES,
): Promise<CompressResult> {
  if (!file.type.startsWith("image/")) {
    return { file, withinLimit: file.size <= limitBytes };
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return { file, withinLimit: file.size <= limitBytes };
  }

  let best: Blob | null = null;

  try {
    for (const factor of DIMENSION_FACTORS) {
      for (const quality of QUALITY_STEPS) {
        const blob = await encode(bitmap, Math.round(maxDim * factor), quality);
        if (!blob) {
          continue;
        }
        if (!best || blob.size < best.size) {
          best = blob;
        }
        if (blob.size <= limitBytes) {
          best = blob;
          // İlk sığan adımda duruluyor: daha fazla bozmanın kazancı yok.
          return { file: toJpeg(file, blob), withinLimit: true };
        }
      }
    }
  } finally {
    bitmap.close();
  }

  if (!best) {
    return { file, withinLimit: file.size <= limitBytes };
  }

  // Sıkıştırma bazen büyütüyor (zaten optimize küçük PNG gibi).
  if (best.size >= file.size) {
    return { file, withinLimit: file.size <= limitBytes };
  }

  return { file: toJpeg(file, best), withinLimit: best.size <= limitBytes };
}

function toJpeg(original: File, blob: Blob): File {
  const name = original.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg" });
}

/** Bayt sayısını okunur biçime çevirir. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/*
  Yükleme hatasını kullanıcı diline çevirir.

  ÖNCEKİ SORUN: her hata "Görsel yüklenemedi. Tekrar dene." oluyordu.
  Gerçek sebep (RLS reddi) ne kullanıcıya ne de geliştiriciye ulaşıyordu;
  avatar hatası bu yüzden uzun süre teşhis edilemedi. Artık ham hata
  konsola yazılıyor, kullanıcıya ise sebebe uygun bir yönlendirme veriliyor.
*/
export function describeUploadError(error: unknown): string {
  // Ham hata her zaman konsolda: teşhis bir daha kaybolmasın.
  console.error("[yukleme] storage hatasi:", error);

  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message: unknown }).message)
      : "";

  if (/row-level security|AccessDenied|Unauthorized|jwt/i.test(message)) {
    return "Yükleme izni alınamadı. Çıkış yapıp tekrar giriş yapmayı dene.";
  }
  if (/payload too large|exceeded the maximum/i.test(message)) {
    return MAX_UPLOAD_MESSAGE;
  }
  if (/fetch|network|timeout/i.test(message)) {
    return "Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.";
  }
  return "Görsel yüklenemedi. Tekrar dene.";
}
