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
  "art-01": "Gönüllülük · ağaç dikimi",
  "art-02": "Sosyal · dayanışma",
  "art-03": "Spor · koşu",
  "art-04": "Katılım · sahne",
  "art-05": "Eğitim · çalışma",
  "art-06": "Toplanma · buluşma",
  "art-07": "Temizlik · atık toplama",
  "art-08": "Yardım · dayanışma",
  "art-09": "Park · yeşil alan",
  "art-10": "Müzik · konser",
  "art-11": "Oyun · basketbol",
  "art-12": "Çevre · fide",
  "art-13": "Ziyaret · şehir turu",
  "art-14": "Kültür · müze",
  "art-15": "Kariyer · çalışma masası",
  "art-16": "Teknoloji · dijital",
  "art-17": "Sanat · duvar resmi",
  "art-18": "Tarih · miras",
  "art-19": "Lezzet · kahvaltı",
  "art-20": "Doğa · yürüyüş",
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
  /*
    Uzantı KODDA sabit, manifest'ten okunmuyor: manifest çalışma anında
    okunacaktı ve her kart listesinde bir dosya okuması demekti.

    D38 FAZ GK'de SVG yer tutucular gerçek fotoğraflarla değişti;
    uzantı .svg yerine .webp oldu ama ANAHTARLAR AYNI KALDI, yani
    veritabanındaki hiçbir art_key satırına dokunulmadı.
  */
  return `${TASK_ART_DIR}/${key}.webp`;
}

/**
 * Detay sayfasının VARSAYILAN kapağı (D38 FAZ GK).
 *
 * Görevin kendi `image_url`'i yoksa bu kullanılıyor. Önceden kapak
 * alanı boşsa yalnız kategori gradyanı çiziliyordu; detay sayfasının
 * en üstü, yani ekranın ilk gördüğü yer, düz renkli bir bloktu.
 *
 * `art_key` ile KARIŞTIRILMAMALI: art_key kart kapağı (3:4), bu ise
 * detay sayfasının geniş şeridi. İkisi farklı oranlar, farklı kırpma
 * davranışı; tek görseli iki yerde kullanmak birinde özneyi kesiyordu.
 */
export const DEFAULT_TASK_COVER = `${TASK_ART_DIR}/detay-kapak.webp`;
