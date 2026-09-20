/**
 * Görev kapak görselleri (D32 FAZ G3, D40'ta yeniden kuruldu).
 *
 * DB'de YOL değil ANAHTAR saklanıyor (`tasks.art_key` = "art-01"). Dosya
 * düzeni değişirse — klasör adı, uzantı, boyut varyantları — tek yerden
 * çözülüyor ve DB'deki yüzlerce satırı güncellemek gerekmiyor.
 *
 * D40: her anahtarın İKİ dosyası var.
 *
 *   art-NN.webp    kart kapağı   — yatay sahne (oran 1.49-2.07)
 *   cover-NN.webp  detay kapağı  — geniş şerit (oran 3.42-4.51)
 *
 * İkisi aynı kaynak hücreden çıkıyor ve aynı konuyu anlatıyor, yani
 * yönetici TEK seçim yapıyor; kart ve detay kendiliğinden eşleşiyor.
 * Önceden detay kapağı tek ve ortak bir görseldi (detay-kapak.webp) —
 * hangi görev açılırsa açılsın aynı manzara çıkıyordu.
 *
 * Liste kodda sabit, manifest.json'dan okunmuyor: manifest derleme
 * anında değil çalışma anında okunacaktı ve her kart listesinde bir
 * dosya okuması demekti. manifest.json yine duruyor — görselleri
 * üreten/yerine koyan taraf için kaynak belge o.
 */

export const TASK_ART_DIR = "/task-art";

/** Geçerli anahtarlar: art-01 .. art-40. */
export const TASK_ART_KEYS = Array.from(
  { length: 40 },
  (_, i) => `art-${String(i + 1).padStart(2, "0")}`,
);

/**
 * Anahtarın kısa açıklaması — yönetim panelindeki seçici ızgarasında
 * görselin altında görünüyor ve aramada bu metin taranıyor.
 * scripts/slice-task-art.mjs içindeki liste ile aynı; kaynak orası.
 */
export const TASK_ART_HINTS: Record<string, string> = {
  "art-01": "Ziyaret · Galata ve şehir",
  "art-02": "Park · çimende grup",
  "art-03": "Sosyal · çimende sohbet",
  "art-04": "Müzik · konser sahnesi",
  "art-05": "Spor · basketbol",
  "art-06": "Çevre · fidan dikimi",
  "art-07": "Temizlik · sahilde atık",
  "art-08": "Yardım · bağış kutusu",
  "art-09": "Spor · sahilde koşu",
  "art-10": "Kültür · müzede heykel",
  "art-11": "Kariyer · pencere önünde çalışma",
  "art-12": "Sosyal · gün batımında grup",
  "art-13": "Sanat · duvar resmi",
  "art-14": "Teknoloji · drone ve tablet",
  "art-15": "Teknoloji · kulaklıkla kodlama",
  "art-16": "Tarih · antik sütunlar",
  "art-17": "Lezzet · kafede buluşma",
  "art-18": "Müzik · festival kalabalığı",
  "art-19": "Hayvan · parkta köpek",
  "art-20": "Doğa · dağ manzarası",
  "art-21": "Yürüyüş · sahil yolu",
  "art-22": "Fotoğraf · Galata çekimi",
  "art-23": "Sosyal · grup sohbeti",
  "art-24": "Takım · el ele dayanışma",
  "art-25": "Duyuru · broşür dağıtımı",
  "art-26": "Esnaf · dükkân ziyareti",
  "art-27": "Eğitim · atölye sunumu",
  "art-28": "Paylaşım · sosyal medya",
  "art-29": "Hayvan · köpek dostluğu",
  "art-30": "Temizlik · parkta atık",
  "art-31": "Spor · sahilde koşu",
  "art-32": "Kültür · müze salonu",
  "art-33": "Yardım · kutu teslimi",
  "art-34": "Çevre · fidan dikimi",
  "art-35": "Festival · pazar tezgâhları",
  "art-36": "Geri dönüşüm · kutular",
  "art-37": "Müzik · sahne ve kalabalık",
  "art-38": "Fotoğraf · gün batımı",
  "art-39": "Eğitim · şehirde okuma",
  "art-40": "Teknoloji · laptopta çalışma",
};

/** Anahtar tanınıyor mu. */
export function isTaskArtKey(key: string | null | undefined): key is string {
  return Boolean(key) && TASK_ART_KEYS.includes(key as string);
}

/**
 * Anahtardan KART kapağı yolu. Tanınmayan anahtar için null —
 * kart kategori gradyanına düşüyor.
 *
 * Uzantı KODDA sabit, manifest'ten okunmuyor: manifest çalışma anında
 * okunacaktı ve her kart listesinde bir dosya okuması demekti.
 */
export function taskArtUrl(key: string | null | undefined): string | null {
  if (!isTaskArtKey(key)) return null;
  return `${TASK_ART_DIR}/${key}.webp`;
}

/**
 * Anahtardan DETAY kapağı yolu (aynı hücrenin geniş şeridi).
 *
 * Anahtar "art-07" ise dosya "cover-07.webp". İki ayrı anahtar alanı
 * tutulmadı: çift zaten kaynakta birlikte çiziliyor ve yöneticiye iki
 * ayrı seçim yaptırmak, eşleşmeyen kart/kapak çiftleri üretme riskini
 * karşılıksız açıyordu.
 */
export function taskCoverUrl(key: string | null | undefined): string | null {
  if (!isTaskArtKey(key)) return null;
  return `${TASK_ART_DIR}/${key.replace("art-", "cover-")}.webp`;
}

/**
 * Detay sayfasının SON ÇARE kapağı.
 *
 * Görevin kendi `image_url`'i ve `art_key`'i yoksa bu kullanılıyor.
 * Önceden kapak alanı boşsa yalnız kategori gradyanı çiziliyordu;
 * detay sayfasının en üstü, yani ekranın ilk gördüğü yer, düz renkli
 * bir bloktu. cover-01 seçildi: Galata ve şehir silüeti, konusu
 * olmayan bir görev için en nötr kare.
 */
export const DEFAULT_TASK_COVER = `${TASK_ART_DIR}/cover-01.webp`;
