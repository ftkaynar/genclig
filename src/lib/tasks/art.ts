/**
 * Görev kapak görselleri (D32 FAZ G3).
 *
 * DB'de YOL değil ANAHTAR saklanıyor (`tasks.art_key` = "art-01"). Dosya
 * düzeni değişirse — klasör adı, uzantı, boyut varyantları — tek yerden
 * çözülüyor ve DB'deki yüzlerce satırı güncellemek gerekmiyor.
 *
 * Liste kodda sabit, manifest.json'dan okunmuyor: manifest derleme
 * anında değil çalışma anında okunacaktı ve her kart listesinde bir
 * dosya okuması demekti. manifest.json yine duruyor — görselleri
 * üreten/yerine koyan taraf için kaynak belge o.
 */

export const TASK_ART_DIR = "/task-art";

/** Geçerli anahtarlar: art-01 .. art-20. */
export const TASK_ART_KEYS = Array.from(
  { length: 20 },
  (_, i) => `art-${String(i + 1).padStart(2, "0")}`,
);

/**
 * Anahtarın kısa açıklaması — yönetim panelindeki seçici ızgarasında
 * görselin altında görünüyor. Sırası TASK_ART_KEYS ile aynı.
 */
export const TASK_ART_HINTS: Record<string, string> = {
  "art-01": "Çevre · ağaç dikimi",
  "art-02": "Toplum · dayanışma",
  "art-03": "Spor · koşu",
  "art-04": "Kültür · sahne",
  "art-05": "Eğitim · kitap",
  "art-06": "Yurttaşlık · meydan",
  "art-07": "Geri dönüşüm",
  "art-08": "Bağış",
  "art-09": "Su ve tasarruf",
  "art-10": "Müzik",
  "art-11": "Bisiklet",
  "art-12": "Tarım · fide",
  "art-13": "Sahil temizliği",
  "art-14": "Tiyatro",
  "art-15": "Kütüphane",
  "art-16": "Kodlama",
  "art-17": "Hayvan barınağı",
  "art-18": "Yaşlı ziyareti",
  "art-19": "Festival",
  "art-20": "Doğa yürüyüşü",
};

/**
 * Anahtardan görsel yolu. Tanınmayan anahtar için null —
 * kart kategori gradyanına düşüyor.
 *
 * Uzantı burada tek yerde: gerçek görseller WEBP olarak geldiğinde
 * yalnız bu satır değişecek.
 */
export function taskArtUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  if (!TASK_ART_KEYS.includes(key)) return null;
  return `${TASK_ART_DIR}/${key}.svg`;
}
