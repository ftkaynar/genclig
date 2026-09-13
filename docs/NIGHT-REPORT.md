# Gece Vardiyası Raporu

Başlangıç: 2026-09-14 · Dönüş noktası: `git tag gece-basi` (commit 4be8b4e)

Bu rapor gece boyunca faz faz güncellenir. Her fazın durumu, kanıt özeti,
spec'ten sapmalar ve blokajlar burada toplanır.

---

## FAZ 0 — Hazırlık

**Durum: TAMAM**

- Repo temiz (`git status` boş), HEAD `4be8b4e`
- `git tag gece-basi` oluşturuldu — geri dönüş noktası
- `pnpm db:reset` M1–M8 sıfırdan temiz uyguladı (exit 0)
- `pnpm check:all` yeşil (exit 0)
- Yerel Supabase yığını ayakta (11 container; `supabase_vector` restart döngüsünde — D01'den beri bilinen, yalnızca log toplayıcı, işlevi etkilemiyor)

---

## FAZ 1 — Bildirim altyapısı + teslim inceleme motoru (M9)

**Durum: TAMAM**

Migration `20260915000000_notifications_review.sql`:
- `notifications` tablosu (6 tür), RLS: kullanıcı yalnızca kendi satırlarını okur
- `notify()` — client'a execute yetkisi VERİLMEDİ (sahte bildirim üretilemesin)
- `mark_notification_read(id)` / `mark_all_notifications_read()` — rpc, yalnızca kendi satırı
- `review_submission(id, action, reason)` — yetki kontrolü fonksiyon içinde

**Tasarım kararı:** Okundu işaretleme UPDATE politikası yerine rpc ile. Politika
hangi sütunun değiştiğini göremiyor; kullanıcı kendi bildiriminin başlığını da
düzenleyebilirdi.

**Kanıtlar:**
- Foto teslimi `pending` açıldı, ödül yazılmadı (0 satır) — doğru
- Rolsüz kullanıcı inceleme denemesi → "Bu teslimi inceleme yetkin yok."
- Başka belediyenin personeli → aynı hata
- Belediye personeli onayladı → `approved`, 120 XP + 60 Coin, bildirim:
  "Kadıköy sahilini temizle onaylandı / +120 XP • +60 Coin kazandın."
- İkinci onay → "Bu teslim zaten sonuçlanmış.", XP satırı hâlâ 1 (katlanmadı)
- Red akışı → `rejected` + sebep + bildirim
- Başkasının bildirimi görünmüyor (0), `mark_all` sonrası okunmamış 0
- `notify` doğrudan çağrısı → `permission denied for function notify`

**UI:** Header'a çan + okunmamış sayacı (`UserHeader` ortak bileşeni),
`/bildirimler` sayfası (liste, tümünü okundu işaretle, boş durum).

**SAPMA:** Yetkisiz kullanıcı testinde ilk denemede "Teslim bulunamadı." geldi —
teslim id'si RLS yüzünden subquery'de görünmediği için. Yetki kontrolü id açıkça
verilerek ayrıca doğrulandı. Fonksiyonun bu davranışı aslında doğru: yetkisiz
kişiye teslimin varlığını bile sızdırmıyor.

## FAZ 2 — Rozet motoru (M10)

**Durum: TAMAM**

Migration `20260915010000_badges.sql`:
- `badges` (kriter `jsonb`, `xp_bonus`/`coin_bonus`), `user_badges`
- `xp_transactions` / `coin_transactions` tablolarına `badge_id` + kısmi tekil
  indeks `(user_id, badge_id) where reason='badge'` → bonus tek sefer
- `check_and_award_badges(user)` — tüm aktif rozetleri değerlendirir
- `award_task_points` sonuna rozet değerlendirmesi eklendi

**Tasarım kararı:** Her çağrıda tüm aktif rozetler yeniden değerlendiriliyor.
Yalnızca tetikleyen olaya bağlı rozetlere bakmak elendi: kriter tipleri tabloda
değişebiliyor, hangi olayın hangi rozeti etkilediğini kodda tutmak kriter
düzenlendiğinde sessizce yanlış olurdu.

**İleriye hazırlık:** `problem_reports` kriteri FAZ 4 öncesinde tablo yokken de
çalışsın diye `to_regclass` ile korunuyor; tablo yoksa sayı 0.

**Seed:** first-step, green-hero, culture-explorer, social-starter,
knowledge-seeker, city-voice, city-maker (7 rozet).

**Kanıtlar:**
- İlk görev onayında `first-step` düştü; diğer 6 rozet kazanılmadı (kriter dolmadı)
- Bonus işlemi `badge` 20 XP, `badge_id` dolu
- `badge_earned` bildirimi üretildi
- İkinci çağrı: XP satırı 2 → 2, rozet 1, bildirim 1 (katlanmadı)
- Client `user_badges` insert → `permission denied for table`
- Client `check_and_award_badges` çağrısı → `permission denied for function`

## FAZ 3 — Foto sıkıştırma + profil + ayarlar (M11)

**Durum: TAMAM**

- `src/lib/upload.ts` — `compressImage(file, maxDim, quality)` canvas ile JPEG'e
  küçültüyor. Görev foto yükleme akışı buna bağlandı (**BORÇ #7 kapandı**).
  Sıkıştırma başarısız olursa özgün dosya döner: akışı kırmaktansa büyük dosya.
  Sonuç özgünden büyükse (zaten sıkıştırılmış küçük PNG) özgün korunur.
- Migration `20260915020000_avatars.sql` — `avatars` bucket'ı (public read),
  yazma/silme/güncelleme yalnızca `<user_id>/` klasöründe.
- `/profil` — avatar, kullanıcı adı, seviye ilerleme çubuğu, XP/Coin/görev
  sayısı, rozet ızgarası (kazanılan renkli, kazanılmayan soluk + kriter metni),
  kategori dağılımı, son 10 XP hareketi.
- `/ayarlar` — avatar yükleme (sıkıştırmalı, önce/sonra boyut gösterir),
  görünen ad, il/ilçe/mahalle, tema anahtarı, çıkış.
- Alt gezinmede Profil artık gerçek sayfaya gidiyor.

**Not:** Avatar bucket'ı bilerek public. Avatarlar profil ve sıralama
ekranlarında başkalarına da görünüyor; her görüntü için imzalı URL üretmek
gereksiz tur demek olurdu.
