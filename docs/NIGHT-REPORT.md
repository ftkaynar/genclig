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

## FAZ 4 — Sorun/öneri/proje bildirimi (M12)

**Durum: TAMAM — BORÇ #6 kapandı**

Migration `20260915030000_problem_reports.sql`:
- `problem_categories` (9 kategori seed), `problem_reports`, `problem_status_history`
- `xp_/coin_transactions`'a `problem_id` + `reason` check'ine `problem_report`
  ve `problem_resolved` eklendi; kısmi tekil indeksler ödülü tek sefere bağlıyor
- `problem-photos` private bucket + kendi klasörü / personel okuma politikaları
- `report_problem(...)` — doğrulama, belediye türetme, +25 XP / +10 Coin
- `set_problem_status(...)` — yetki, geçmiş kaydı, `resolved`'a ilk geçişte
  +75 XP / +40 Coin, bildirim

**Tasarım kararı:** Belediye gönderim anında kullanıcının profil ilçesinden
türetilip rapora kopyalanıyor. Kullanıcı taşınıp profilini güncellediğinde eski
raporu yeni belediyenin kuyruğuna düşmemeli. Eşleşen belediye yoksa `null`
kalıyor ve rapor yalnızca süper adminin kuyruğunda görünüyor — bildirimi
reddetmektense kaydetmek tercih edildi.

**SAPMA:** `report_problem`'ın `p_category_id` parametresi önce `smallint`
yazılmıştı; PostgreSQL implicit cast vermediği için hem psql hem PostgREST
çağrıları "function does not exist" hatası verdi. `integer`'a çevrildi,
tabloda sütun `smallint` kaldı.

**Kanıtlar:**
- Bildirim gönderildi → belediyeye düştü, `problem_report` +25 XP, geçmişe `new`
- Kısa başlık → "Başlık en az 5 karakter olmalı."
- Yetkisiz durum değiştirme → "Bu bildirimi yönetme yetkin yok."
- Personel `resolved` yaptı → +75 XP, `resolved_at` doldu, bildirim gitti
- `in_progress` → `resolved` tekrar → `problem_resolved` hâlâ 1 satır (katlanmadı)
- 5 bildirim sonrası `city-voice` rozeti düştü
- Personel 5 raporu görüyor, ilgisiz kullanıcı 0
- Client doğrudan insert → `permission denied for table problem_reports`

**UI:** `/bildir` (tür seçimi, kategori, başlık, açıklama, sıkıştırmalı foto,
"Konumumu kullan" + doğruluk metresi, elle adres), `/bildir/gecmis` (durum
rozetleri, durum geçmişi, OpenStreetMap bağlantısı). Ana sayfaya
"Şehrin için bildir" CTA'sı eklendi.

## FAZ 5 — Ödül havuzu (M13)

**Durum: TAMAM**

Migration `20260915040000_rewards.sql`:
- `rewards` (coin bedeli, min seviye, rozet şartı, stok), `reward_redemptions`
- `coin_transactions`'a `redemption_id` + kısmi tekil indeks
- `generate_redemption_code()` — 8 hane, karışan karakterler (0/O, 1/I/L) çıkarıldı
- `redeem_reward(id)` — stok, seviye, rozet, bakiye kontrolü; negatif harcama satırı
- `use_redemption_code(code)` — personel/süper admin, tek kullanım

**Tasarım kararı:** Coin bakiyesi için tablo check kısıtı yok; korunması gereken
şey satırların toplamı, tek satır değil. Kontrol `redeem_reward` içinde.

**Seed:** Rozet Paketi (200 coin, Lv.2), Kahve Kuponu (500, Lv.3, stok 50),
Etkinlik Kontenjanı (800, Lv.4, first-step rozeti, stok 20).

**Kanıtlar:**
- Seviye yetersiz → "Bu ödül için en az 2. seviyeye ulaşmalısın."
- Şartlar karşılanınca → 8 haneli kod, `active`, bildirim gitti
- Bakiye 300 → 100 düştü (`reward_spend` -200)
- İkinci alım → "Yeterli coin'in yok. Gereken: 200, bakiyen: 100."
- Kod kullanıldı → `used` + `used_at`; ikinci kullanım → "daha önce kullanılmış"
- Bakiye hiç negatife düşmedi (100 kaldı)
- Client doğrudan kupon insert → `permission denied for table`

**SAPMA:** Hata mesajında biçim dizgisi hatası vardı ("en az 2 . seviye"),
düzeltildi.

**UI:** `/oduller` (bakiye başlığı, kart ızgarası, karşılanmayan şartlar kilit
etiketiyle soluk, onay diyalogu, kod ekranı), `/oduller/kuponlarim`. Profile
ödüller ve bildirimlerim kısayolları eklendi.

## FAZ 6 — Sıralama (M14)

**Durum: TAMAM**

Migration `20260915050000_leaderboard.sql`:
- `period_start(period)` — Europe/Istanbul'a göre hafta/ay başı
- `leaderboard_top(scope, period, limit)` — security definer
- `leaderboard_my_rank(scope, period)` — kendi sırası + kapsam büyüklüğü

**Tasarım kararı:** `security definer` zorunlu — RLS kullanıcıya yalnızca kendi
XP satırlarını gösteriyor, sıralama tanımı gereği başkalarını da içeriyor.
Sızdırılan alanlar bilerek dar: kullanıcı adı, seviye, dönem XP'si. E-posta,
konum ve işlem dökümü dönmüyor. Kullanıcı adı olmayan (onboarding'i bitirmemiş)
profiller ve puanı sıfır olanlar listede yok.

**Kanıtlar (3 test kullanıcısı, farklı XP ve konum):**
- Türkiye/tümü → bora 5300 (Lv.10), cem 900, ayse 500
- Türkiye/bu hafta → cem 900, ayse 500, bora 300 (60 gün önceki 5000 sayılmadı)
- İl kapsamı (İstanbul) → yalnızca ayse + bora
- Kendi sıram: Türkiye 2./3, İl 1./2
- Konumu olmayan kullanıcı il kapsamında boş liste
- Sıralamayı gören kullanıcı başkasının ham XP satırını göremiyor (0)
- Geçersiz kapsam → "Geçersiz kapsam."

**UI:** `/siralama` — Türkiye/İl/İlçe/Mahalle sekmeleri (+pasif "Arkadaşlar —
yakında"), Bu Hafta/Bu Ay/Tümü dönem seçici, ilk üç madalyalı, "Benim sıram"
kartı (sıra + üstündeki kullanıcı ile XP farkı), konum eksikse
"Konumunu ayarla" yönlendirmesi. Alt gezinmede Sıralama bağlandı.

## FAZ 7 — Belediye paneli (M14b)

**Durum: TAMAM (çekirdek akışlar) — görev oluşturma/düzenleme formu BORÇ**

Migration `20260915060000_panel_kpis.sql`:
- `panel_kpis(municipality_id)` — yetki kontrolü içeride, yalnızca sayı döndürür
- `my_municipalities()` — panel layout'u hangi belediyeyi göstereceğini buradan öğrenir
- `admin_kpis()` — global sayımlar (FAZ 8 için)
- `profiles`'a `profiles_select_super` politikası (yalnızca SELECT; yazma değişmedi)

**Sayfalar:** `/panel` (KPI kartları), `/panel/incelemeler` (imzalı URL ile foto,
onayla/reddet+sebep), `/panel/sorunlar` (durum+tür filtresi, durum değiştirme,
OpenStreetMap bağlantısı), `/panel/gorevler` (durum değiştirme),
`/panel/oduller` (liste + son kuponlar), `/panel/kupon` (kod kullanma).

**Tasarım kararı:** Yetkisiz kullanıcı yönlendirilmiyor, açıklayıcı bir ekran
görüyor. Sessizce başka yere atmak ne olduğunu anlatmıyordu.

**Kanıtlar (iki belediye, iki personel, bir genç):**
- Kadıköy personeli KPI: 1 aktif görev, 1 bekleyen inceleme, 1 yeni bildirim
- Üsküdar personeli Kadıköy KPI'sini isteyince → "Bu panele erişim yetkin yok."
- Üsküdar personeli Kadıköy teslimini (0) ve raporunu (0) görmüyor
- Kadıköy personeli ikisini de görüyor (1/1), panel bağlamı dolu
- Onay akışı: `approved` + 120 XP task + 20 XP rozet bonusu + 2 bildirim
- Genç kullanıcının panel bağlamı yok (0) → NoAccess ekranı

**BORÇ:** `/panel/gorevler/yeni` ve `/duzenle` formları yazılmadı. Görev durumu
değiştirilebiliyor ama yeni görev tanımlama süper admin/SQL üzerinden.
Sabah listesine alındı.

## FAZ 8 — Süper admin paneli

**Durum: TAMAM (çekirdek akışlar)**

`profiles`'a `profiles_select_super` politikası FAZ 7 migration'ında eklendi
(yalnızca SELECT; kullanıcının kendi satırını düzenleme kuralı değişmedi).

**Sayfalar:** `/admin` (7 KPI), `/admin/incelemeler` (global görevlerin kuyruğu),
`/admin/sorunlar` (tüm bildirimler), `/admin/belediyeler` (liste + ekleme
formu, il→ilçe kademeli), `/admin/kullanicilar` (arama + rol ver/al),
`/admin/seviyeler` (eşik düzenleme, sıralı olma kuralı sunucuda),
`/admin/rozetler` (liste + JSON kriterli ekleme), `/admin/kategoriler`
(görev + bildirim kategorileri), `/admin/gorevler`, `/admin/oduller`.

**Tasarım kararı:** Admin ekleme formları tek bir `InlineEditor` üzerinden alan
tanımlarıyla çalışıyor. Altı ayrı form bileşeni yazmak yerine: hepsi aynı
kalıpta (birkaç alan + kaydet) ve tekrar bakım yükü demekti. Sunucu eylemleri
sarmalayıcı client bileşenlerinden import ediliyor — server component'ten
client'a fonksiyon geçirmek yalnızca server action'lar için çalışıyor ve
sarmalayan closure o ayrıcalığı kaybediyor.

**Kanıtlar:**
- Süper admin KPI: 5 kullanıcı, 2 belediye, 6 görev
- Normal kullanıcı KPI isteyince → "Bu panele erişim yetkin yok."
- Süper admin 5 profil görüyor, normal kullanıcı 1 (kendisi)
- Normal kullanıcının seviye eşiği UPDATE'i 0 satır
- Süper admin Lv.3 eşiğini 300→250 yaptı, 260 XP anında Lv.3 oldu, geri alındı
- Süper admin rozet ve ödül ekledi; normal kullanıcı → RLS reddi

## FAZ 9 — Ana sayfa, Keşfet (harita), navigasyon

**Durum: TAMAM — harita çalışıyor, fallback gerekmedi**

**Yeni bağımlılık:** `leaflet` 1.9.4, `react-leaflet` 5.0.0, `@types/leaflet`
(izin verilen liste dışına çıkılmadı).

- Alt gezinme final: Ana Sayfa / Görevler / Keşfet / Sıralama / Profil —
  beşinin de sayfası var, tıklanamaz span dalı ölü koda dönüştüğü için kaldırıldı.
- Ana sayfa (oturumlu): selamlama + seviye/XP/Coin kartı, "Şehrin için bildir"
  ve "Keşfet" kısayolları, "Bugün için önerilen" 3 görev (önce anlık, sonra en
  yeni; zaten teslim edilenler elenir), "Bu haftaki sıram" kartı, son 3 bildirim.
- `/kesfet`: OpenStreetMap tile, kategori renkli pinler, popup → göreve git,
  "Konumum" butonu, altta mesafe sıralı "Yakınındaki görevler" listesi
  (haversine, istemcide).

**SAPMA / çözülen blokaj:** İlk sürümde `/kesfet` 500 verdi —
`ReferenceError: window is not defined`. Sebep: harita yer tutucusu (`MapSkeleton`)
leaflet'i modül düzeyinde içe aktaran dosyadan import ediliyordu, bu da
`dynamic(ssr:false)` sarmalaması devreye girmeden leaflet'i sunucuda
değerlendiriyordu. Yer tutucu leaflet'siz ayrı dosyaya alındı, sorun kalktı.

**Pin ikonları:** Leaflet'in varsayılan işaretçi görselleri bundler altında
bozuk yol üretiyor. `divIcon` ile kategori rengini taşıyan daireler çizildi —
hem sorun kalktı hem marka renkleri korundu.

**Yerel kanıt (tüm rotalar):**
```
/ 200 · /gorevler 200 · /kesfet 200 · /panel 200 · /admin 200
/panel/incelemeler 200 · /admin/seviyeler 200
/siralama /profil /bildir /oduller /bildirimler → 307 /giris?next=...
/kesfet içeriği: harita yer tutucusu + "Konumum" + 2 konumlu görev
```

## FAZ 10 — Bulut ve kapanış

**Durum: TAMAM**

### Bulut push

Dry-run ve push, yedi migration sırayla:
```
20260915000000_notifications_review.sql
20260915010000_badges.sql
20260915020000_avatars.sql
20260915030000_problem_reports.sql
20260915040000_rewards.sql
20260915050000_leaderboard.sql
20260915060000_panel_kpis.sql
```
Hepsi uygulandı (exit 0). Toplam 12 migration bulutta.

### Bulut doğrulaması (REST, anon)

```
badges 7 · levels 50 · rewards 3 · problem_categories 9
task_categories 6 · provinces 81

anon POST → notifications 401 · problem_reports 401 · reward_redemptions 401
            user_badges 401 · xp_transactions 401

anon rpc → notify / check_and_award_badges / review_submission
           PostgREST şemasında görünmüyor (execute yetkisi yok)
```

### rls_isolation tam koşu

22 senaryo (0–21), psql exit 0. Yeni eklenenler:
- 17: bildirimler yalnızca sahibine; `notify` client'tan çağrılamıyor
- 18: rozetler herkese açık (7), kazanım elle yazılamıyor
- 19: `problem_reports` doğrudan insert reddi; `report_problem` +25 XP yazıyor
- 20: ödüller anon'a açık (3), kupon elle yazılamıyor
- 21: sıralama definer ile çalışıyor, başkasının ham XP satırı görünmüyor

### docs/OPERATIONS.md

İlk süper admin atama SQL'i, belediye + personel atama, SMTP sınırı ve
yönlendirme adresi notu, yerel sıfırlama ve bulut migration akışı yazıldı.

---

# SABAH YAPILACAKLAR

## Önce bunlar (bloke edici)

1. **Bulut Auth yapılandırması** — Studio > Authentication > URL Configuration:
   Site URL `https://genclig.vercel.app`, Redirect URLs `https://genclig.vercel.app/**`.
   Şu an `localhost` yazıyor, canlı kayıt akışı bu yüzden tamamlanamaz.
2. **İlk süper admin** — `docs/OPERATIONS.md` §1'deki SQL. Bu yapılmadan
   `/admin` hiç açılmaz ve rol ataması mümkün değil.
3. **SMTP** — yerleşik gönderim saatlik kotaya takılıyor. Kendi sağlayıcın
   bağlanmadan canlıda kullanıcı testi yapılamıyor.

## Görsel doğrulama listesi (yerelde `pnpm dev`, oturum açarak)

| Sayfa | Bakılacak |
|---|---|
| `/` | selamlama, seviye çubuğu, önerilen 3 görev, sıralama kartı, son bildirimler |
| `/gorevler` | sekmeler, kart rozetleri, geri sayım |
| `/gorevler/<id>` | GPS görevinde "Konumumu doğrula", foto görevinde dosya alanı |
| `/kesfet` | harita pinleri, "Konumum", mesafe listesi |
| `/siralama` | kapsam+dönem sekmeleri, "Benim sıram" |
| `/profil` | avatar, rozet ızgarası (kilitli olanlar kriter metniyle), istatistikler |
| `/ayarlar` | avatar yükleme (önce/sonra boyut yazısı), il/ilçe/mahalle |
| `/bildir` | tür seçimi, "Konumumu kullan", gönderim sonrası puan mesajı |
| `/bildir/gecmis` | durum rozetleri, durum geçmişi |
| `/oduller` | kilitli kartlar, onay diyalogu, kod ekranı |
| `/bildirimler` | okunmamış vurgusu, "tümünü okundu işaretle" |
| `/panel` | personel hesabıyla KPI'lar; yetkisiz hesapta NoAccess |
| `/panel/incelemeler` | foto önizleme, onayla/reddet |
| `/admin` | süper admin hesabıyla KPI'lar |

## Borçlar (sonraki dilimlere)

- **`/panel/gorevler/yeni` ve `/duzenle` formları yok.** Görev durumu
  değiştirilebiliyor, yeni görev tanımlama SQL/süper admin üzerinden.
- **Ödül/rozet düzenleme** yalnızca ekleme var; var olanı düzenleme ve silme yok.
- **Tarayıcı testi yapılmadı.** Tüm doğrulamalar psql, curl ve HTML çıktısı
  üzerinden. Gerçek tıklama akışları (harita etkileşimi, kamera, konum izni
  diyalogları) elle gezilmeli.
- **Kupon "kullan" akışı** panelde var ama kupon üretimi yalnızca kullanıcı
  tarafında; personel kupon iptali (cancelled) arayüzü yok.
- **Bildirim sayacı gerçek zamanlı değil** — sayfa yenilendikçe güncelleniyor.

## Bilinçli kapsam dışı (bu gece yapılmadı, sonraki dilimler)

arkadaşlık/squad · etkinlik domaini · streak · anket · mahalle değerlendirme ·
QR/Health/NFC doğrulama · push notification · e-posta şablonları · i18n
