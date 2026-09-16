/*
  Şema geride kaldığında uygulama ÇÖKMEMELİ (D32 düzeltme).

  ÖLÇÜLEN SORUN: D32'de eklenen kod, henüz uygulanmamış iki migration'a
  (M30, M31) sıkı bağımlıydı. Migration bulutta koşmadığı için üretimde:

    - tasks.art_key sütunu yok -> PostgREST 42703 -> listFeedTasks
      throw ediyor -> ANA SAYFA ve /gorevler 500 veriyordu
    - channel_info RPC'si yok  -> PGRST202 -> getChannelInfo null
      -> /topluluk kendine redirect ediyordu (sonsuz döngü)
    - panel görev kaydı art_key yazıyordu -> hiçbir görev kaydedilemiyordu

  KÖK SEBEP KOD DEĞİL SIRA: dağıtım, koşmamış bir migration'a sıkı
  bağımlı olmamalı. Vercel'e kod migration'dan ÖNCE gidebiliyor (ya da
  bu örnekte migration hiç gitmedi) ve arada kalan her istek hata alıyor.

  ÇÖZÜM: yeni şemayı ÖNCE dene, "yok" hatasında eski yola düş ve sonucu
  önbelleğe al. Şema güncelse hiçbir ek maliyet yok (ilk deneme zaten
  başarılı); güncel değilse istek başına tek bir fazladan çağrı, o da
  yalnız ilk seferde.

  Denenen ve elenen alternatif: açılışta tek seferlik "yetenek yoklaması"
  (probe). Şema güncelken bile her sunucu örneğinde üç fazladan gidiş
  dönüş demekti ve asıl sorunu (sıkı bağımlılık) çözmüyordu.
*/

/** PostgREST: sütun yok. */
const MISSING_COLUMN = "42703";

/** PostgREST: fonksiyon şema önbelleğinde yok. */
const MISSING_FUNCTION = "PGRST202";

type PostgrestErrorLike = {
  code?: string | null;
  message?: string | null;
} | null;

/**
 * Hata "bu nesne veritabanında yok" mu diyor?
 *
 * Yalnızca bu iki koda bakılıyor: başka her hata (izin, kısıt, ağ)
 * GERÇEK hata ve yutulmamalı — sessizce eski yola düşmek, asıl arızayı
 * gizlerdi.
 */
export function isMissingSchema(error: PostgrestErrorLike): boolean {
  if (!error) return false;
  return error.code === MISSING_COLUMN || error.code === MISSING_FUNCTION;
}

/**
 * Bir kez "yok" görülen nesneyi hatırlar.
 *
 * Süreç ömrü boyunca geçerli: migration koşunca yeni sunucu örneği
 * ayağa kalkıyor ve bayrak sıfırlanıyor. Kalıcı bir yerde tutmak,
 * migration'dan sonra elle temizlik gerektirirdi.
 */
const missing = new Set<string>();

export function markMissing(key: string): void {
  if (!missing.has(key)) {
    missing.add(key);
    // Tek seferlik uyarı: sessizce eski yola düşmek, eksik migration'ı
    // günlerce görünmez kılardı.
    console.warn(
      `[şema] "${key}" veritabanında yok; eski yola düşülüyor. ` +
        `Bekleyen migration'ları uygula (supabase db push).`,
    );
  }
}

export function isKnownMissing(key: string): boolean {
  return missing.has(key);
}
