import type { PostgrestError } from "@supabase/supabase-js";

/*
  Sorgu hatasını YUTMAYAN sarmalayıcı.

  ÖLÇÜLEN HATA (D29 FAZ T): `/admin/incelemeler` ve `/panel/incelemeler`
  bekleyen teslimleri hiç göstermiyordu. Sorgu PostgREST'te tamamen
  patlıyordu ("Could not find a relationship between 'task_submissions'
  and 'profiles' in the schema cache") ama çağıran taraf

      const { data } = await query;
      return (data ?? []) as Row[];

  yazdığı için hata düşüyor, `data` null geliyor ve ekran BOŞ KUYRUK
  gösteriyordu. Boş kuyruk "iş yok" gibi okunuyor; kırık bir ekran gibi
  değil. Bu yüzden hata aylarca görünmedi.

  Aynı sınıf hata D28'de avatar yüklemede de çıkmıştı (storage hatası
  yutuluyordu). Kural: bir sorgu hatası ya kullanıcıya ya da log'a
  ULAŞMALI; sessizce boş listeye dönüşmemeli.

  Neden `throw`: bunlar operasyon ekranları. Kırık bir sayfa görmek,
  "bekleyen iş yok" yalanını görmekten iyidir. Denenen ve elenen
  alternatif: boş liste + kenarda uyarı — uyarı da gözden kaçıyordu,
  çünkü ekranın geri kalanı normal görünüyordu.
*/
export function unwrap<T>(
  result: { data: T | null; error: PostgrestError | null },
  context: string,
): T {
  if (result.error) {
    console.error(`[sorgu] ${context} başarısız:`, result.error);
    throw new Error(`${context} okunamadı: ${result.error.message}`);
  }
  return (result.data ?? []) as T;
}
