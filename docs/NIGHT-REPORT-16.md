# Gece Raporu 16 — DİLİM 35

**Giriş ekranları baştan + kategorili görev feed'i + kurum/konum + sezon
dönemi + 24 görev + FAB v2**

Commit'ler: `f7d3b75` (A), `b2d6b6f` (G), `e861a6d` (K / M34a),
`897cd52` (S / M34b), `c30605a` (SZ / M34c), `2592976` (F), bu rapor (Z).

38 dosya, +2983 / −238 satır. Üç migration (M34a, M34b, M34c) buluta
gitti.

Dilimin ortak derdi: **uygulama, kullanıcıyı ilk karşıladığı yerde ve
en çok baktığı yerde kendini anlatmıyordu.** Giriş ekranı kullanıcı
arayüzünün kalıntılarını taşıyordu, görev listesi 36 kartlık tek bir
yığındı, sıralama hapı ekranın üstündeki sezon etiketiyle çelişiyordu.

---

## 1. FAZ A — giriş ekranları: kök sebep

**Ölçülen sorun:** `/giris`, `/kayit` ve `/onboarding` `(user)` route
grubunun içindeydi. App Router'da route grubu URL'i değiştirmiyor ama
**layout'u miras bırakıyor**. Sonuç: henüz oturum açmamış kullanıcı
giriş ekranında alt gezinmeyi, HUD çubuğunu ve ödül FAB'ını görüyordu —
hiçbiri tıklanabilir bir yere gitmiyordu. Üstüne `(user)/loading.tsx`
grup kökünde olduğu için **her** alt segmentin yükleme iskeleti
oradan geliyordu: giriş ekranı bir an için ana sayfa iskeletini
çiziyordu.

**Kök sebep tek satırda:** yanlış route grubu. Düzeltme de tek işlem:
`git mv` ile yeni bir `(auth)` grubu.

```
src/app/(auth)/
  giris/page.tsx
  kayit/page.tsx
  kayit/dogrulama/page.tsx
  onboarding/page.tsx
  karsilama/page.tsx   (yeni)
```

**Karşılama ekranı:** oturumsuz kullanıcı `/` isteğinde `/karsilama`'ya
**rewrite** ediliyor, redirect değil — adres çubuğunda `/` kalıyor ve
"uygulamanın kökü" hissi bozulmuyor.

`middleware.ts` içinde rewrite yaparken yenilenen oturum çerezlerini
elle taşımak gerekti:

```ts
const rewritten = NextResponse.rewrite(rewriteUrl, { request });
for (const cookie of response.cookies.getAll()) rewritten.cookies.set(cookie);
```

Bu satır olmadan Supabase'in tazelediği çerez kayboluyor ve kullanıcı
bir sonraki istekte yine oturumsuz görünüyordu.

**Yol boyunca düzeltilen iki şey:**

- **Fotoğraf görünmüyordu.** `AuthBackground` sarmalayıcısı `-z-10`
  taşıyordu; ebeveyn `relative` ama **stacking context açmıyordu**, bu
  yüzden negatif z-index'li çocuk ebeveynin kendi `bg-brand` zemininin
  ARKASINA düşüyordu. `-z-10` kaldırıldı, içerik `relative z-10` aldı.
- **Form etiketleri görünmezdi.** Kart artık her temada koyu; `text-ink`
  açık temada beyaza yakın olduğu için etiketler kayboluyordu.
  `TextField`/`SelectField` `text-white/90` ve `.auth-field` kullanıyor.

**"İçerik sağa kaymış" bulgusu yanlış alarmdı.** Headless Chrome'da
390px istememe rağmen `clientWidth` 500 ölçtüm: bu makinede headless
Chrome 500px'in altına inmiyor. Gerçek 390px düzeni iframe koşum
takımıyla doğrulandı, ortalama doğruydu. Geçici ölçüm route'u silindi.

---

## 2. FAZ G — /gorevler kategorili satır düzeni

**Ölçülen sorun:** `/gorevler` 36 kartı tek ızgarada gösteriyordu.
Kullanıcı "spor görevi var mı" sorusuna ancak kaydırarak yanıt
bulabiliyordu.

`src/components/tasks/category-rows.tsx`

| parça | ne yapıyor |
| --- | --- |
| `groupByCategory` | görevleri kategori nesnesine göre grupluyor |
| `CategoryRows` | kategori başlığı + yatay şerit |

**"Tümünü gör" koşullu:** yalnızca gruptaki görev sayısı 3'ten fazlaysa
çıkıyor; değilse sayı etiketi. Her satıra koşulsuz bir "tümünü gör"
koymak denendi ve elendi — iki görevlik bir kategoride bağlantı aynı
iki görevi gösteriyordu, yani hiçbir şey yapmıyordu.

Bağlantı `?kategori=<slug>` (varsa `&kapsam=`) taşıyor; sayfa o
parametreyle ızgara dalına giriyor ve geri dönüş çipi çiziyor.

**Ölçüm:** `/gorevler` altı kategori bağlantısı üretiyor
(`environment, sports, culture, social, education, civic`);
`?kategori=environment` satır düzenini bırakıp ızgaraya geçiyor
("Tümünü gör" kayboluyor), tanınmayan bir slug varsayılan satır
düzenine düşüyor.

---

## 3. FAZ K — görev kurumu, konum etiketi, sürekli rozeti (M34a)

**Ölçülen sorun:** görev kartı görevi kimin açtığını söylemiyordu.
Belediye görevi, dernek görevi ve platform görevi tamamen aynı
görünüyordu.

**M34a** iki serbest metin alanı ekledi: `issuer_name` (2–60) ve
`location_label` (2–80).

**Neden serbest metin, neden koordinat değil:** kurum çoğu zaman
belediye tablosunda olmayan bir dernek, okul ya da kulüp. Konum ise
kullanıcıya "nerede" demeyi amaçlıyor, haritada nokta koymayı değil —
koordinat alanları (`lat`/`lng`/`radius_m`) zaten var ve doğrulama
için kullanılıyor. Gerekçe sütun yorumlarına yazıldı.

**Kademe kuralı** `taskIssuer(task)` içinde: `issuer_name` →
belediye adı → `GençLİG`. Boş dize null'a çevriliyor, yoksa `""` dolu
sayılıp belediye adına hiç düşülmüyordu.

**Sürekli rozeti v2:** `ContinuousBadge` + özel `LoopIcon` (iki dairesel
ok, dolu uçlu). 160px'lik döşemeler için `compact` varyantı var.

**Şema koruması genişletildi.** `lib/tasks/queries.ts` artık ÜÇ
katmanlı alan listesi kullanıyor: temel + `art_key` + `issuer_name,
location_label, municipalities(name)`. Hepsini tek bayrağa bağlamak,
issuer eksikken `art_key`'i de gereksiz düşürmek demekti.

**Yol boyunca düzeltilen hata:** kurumları atayan üç psql UPDATE
birbirini eziyordu — alt sorgular değişen tabloyu yeniden okuduğu için
`offset` kayıyordu. Kimlikler önce bir CTE'de sabitlendi
(`with hedef as (select id, row_number() …)`).

---

## 4. FAZ S — 24 görev tohumu (M34b)

Her kategoriye **dört** görev: 6 × 4 = 24.

| kategori | tohumlanan | toplam (yerel) |
| --- | --- | --- |
| environment (Çevre) | 4 | 11 |
| social (Sosyal) | 4 | 5 |
| sports (Spor) | 4 | 5 |
| culture (Kültür) | 4 | 7 |
| education (Eğitim) | 4 | 4 |
| civic (Şehir Katılımı) | 4 | 4 |

Üç quiz görevi için soru satırları da tohumlandı.

**İdempotens:** her satır `where not exists (… t.title = v.title)` ile
korunuyor; migration yeniden koşarsa hiçbir şey eklenmiyor.

**Yol boyunca düzeltilen hata:** `column municipality_id is of type
uuid but expression is of type text`. Bir `VALUES` listesindeki
tipsiz `null` **text** olarak çıkarsanıyor. 24 yere `null::uuid`,
13 yere `null::integer` eklendi.

---

## 5. FAZ SZ — "Bu Yıl" yerine "Bu Sezon" (M34c)

**Ölçülen sorun:** D33'te sezonlar geldi (seasons tablosu, FUT kart
etiketi, sıralama başlığındaki ibare) ama sıralama **dönemi** hâlâ
takvim yılıydı. Kullanıcı ekranın üstünde "Sezon 1" yazısını görüp
hemen altındaki hapta "Bu Yıl" seçiyordu: iki farklı zaman kavramı yan
yana duruyor ve hangisinin listeyi belirlediği anlaşılmıyordu.

### Sezon penceresi

`period_start('season')` aktif sezonun `starts_at`'ini döndürüyor
(D33'ten var olan `active_season()` üzerinden, security definer olduğu
için RLS takılmıyor).

**Aktif sezon yoksa `'infinity'`** — yani hiçbir işlem pencereye
girmiyor ve liste boş kalıyor. `'-infinity'` (her şey dahil) denendi ve
elendi: sezon yokken tüm zamanların sıralamasını "Bu Sezon" diye
göstermek yanlış bilgi olurdu. Arayüz bu durumda **"Aktif sezon yok"**
boş durumunu çiziyor ve "Bu ayın sıralaması" bağlantısı veriyor.

### 'year' kaldırıldı

`leaderboard_top`, `leaderboard_teams` ve `leaderboard_my_rank` artık
`week | month | season | all` kabul ediyor. Eski `?donem=year`
bağlantıları `normalizePeriod()` ile season'a çevriliyor.

**my_rank'ta eksik bir beyaz liste vardı.** Bu fonksiyonda hiç dönem
kontrolü yoktu, doğrudan `period_start()` çağırıyordu: bilinmeyen bir
dönem sessizce `-infinity`ye (tüm zamanlar) düşüyor, `leaderboard_top`
ise aynı istekte `'Geçersiz dönem.'` raise ediyordu. Liste ile "benim
sıram" farklı pencerelerden beslenebiliyordu. Üç fonksiyon artık aynı
listeyi kabul ediyor.

### Sezon ödülleri

`leaderboard_reward_settings` period check'i `week | month | season`.
Altı yeni satır (idempotent tohum):

| kapsam | sıra | XP | Token |
| --- | --- | --- | --- |
| Türkiye | 1 | 3000 | 1500 |
| Türkiye | 2 | 1800 | 900 |
| Türkiye | 3 | 900 | 450 |
| Takım | 1 | 1500 | 750 |
| Takım | 2 | 900 | 450 |
| Takım | 3 | 450 | 220 |

**Neden aylıktan belirgin şekilde büyük:** sezon aylardan oluşuyor;
aylık ödülle aynı olsa bir sezon boyunca birinci kalmak bir ay birinci
olmakla aynı değerde görünürdü. **Neden takım bireyselin yarısı:**
takımda her üyeye sabit miktar yazılıyor, bölüştürülmüyor (M29b
kuralı); on kişilik bir takımda bireysel değerin tamamını vermek
ekonomiyi şişirirdi.

`award_leaderboard_rewards` `'season'` dağıtıyor. `period_key =
'sezon-<id>'`. Tarih tabanlı bir anahtar (yıl-çeyrek) denendi ve
elendi: sezon tarihleri yönetici tarafından serbestçe ayarlanıyor ve
iki sezon aynı çeyreğe düşebiliyor. Sezon kimliği tekil ve değişmez —
aynı biçim sezon rozetinin slug'ında da kullanılıyor, yani iki yerde
tek kural var.

**Dağıtım yeri:** `settle_season_badges`, yani sezon rozetiyle **aynı
günlük cron** (`genclig-season-settle`, 20 21 * * *). İkinci bir cron
işi aynı soruyu iki kez sormak olurdu. **Sıra önemli:** ödül çağrısı
`badge_awarded` bayrağı kalkmadan önce — bayrak sezonu "işlendi"
sayıyor, ödül sonra denenseydi bir daha hiç çalışmazdı.

### Ödül şeridi seçili kombinasyonu gösteriyor

**Ölçülen sorun:** şerit `scope` ile besleniyordu ve `scope` D34'ten
beri yalnız coğrafi eksen. Takım sekmesi açıkken bile "turkiye"
satırları, yani **bireysel** miktarlar gösteriliyordu. Ölçüm:

| seçim | şerit |
| --- | --- |
| Bu sezon / Bireysel | 1. +3000 XP +1500 Token |
| Bu sezon / Takım | 1. +1500 XP +750 Token |
| Bu hafta / Bireysel | 1. +500 XP +250 Token |
| Bu hafta / Takım | 1. +250 XP +125 Token |
| Bu ay / İl | şerit yok (il/ilçe/mahallede ödül yok) |

### Yönetim matrisi

`/admin/siralama-odulleri` artık 18 satır: Hafta/Ay/Sezon ×
Bireysel/Takım × 1./2./3. Sıralama kodda (`PERIOD_ORDER`), sorguda
değil — `order by period` alfabetik olduğu için "Aylık" satırları
"Haftalık"tan önce geliyordu. Dönem blokları arasında kalın ayırıcı
(ölçümde 6 blok → 5 ayırıcı).

---

## 6. FAZ F — ödül FAB v2

**Ölçülen sorun:** FAB sağ altta sabitti ve orada duran her şeyin
üstünü kapatıyordu: görev kartının ödül şeridi, sohbetin son mesajı,
sıralamada "benim sıram" bandının sağ ucu.

Kapatılabilir bir düğme denendi ve elendi: kapatılan FAB bir daha
açılamıyor ve mağazaya giden tek kısa yol kayboluyordu. **Taşınabilir**
düğme hem engeli kaldırıyor hem kısayolu koruyor.

**Neden yalnız sol/sağ kenar:** serbest bırakılan bir düğme ekranın
ortasında kalırsa içeriğin tam üstünde durur ve durumu kötüleştirir.
Yatayda iki kararlı nokta, dikeyde serbest.

Sunucu bileşeni (`reward-fab.tsx`) uygunluğu hesaplıyor, istemci
bileşeni (`reward-fab-button.tsx`) sürüklemeyi yürütüyor. İşaret
hesabı `lib/rewards/fab.ts`'te — `Date.now()` bileşen içinde
`react-hooks/purity` kuralına takıldı (haklı: aynı render iki kez
koşsa iki farklı sonuç verebilir).

**Görsel:** dönen parıltı halkası (koni gradyanı + radial maske; halka
düğmenin arkasında, altın gradyanı soluklaştırmasın), 6 saniyede bir
900ms süren eğik ışık süpürmesi, `YENİ` kampanya rozeti ya da sade
nabız, oturum başına bir kez "Ödül Mağazası" ipucu.

**`YENİ` koşulu:** alınabilir **ve** son 7 günde eklenmiş bir ödül.
Yeni ama parası yetmeyen bir ödül için rozet göstermek denendi ve
elendi — kullanıcı basıyor, hiçbir şey alamıyor, rozet yalancı çıkıyor.

**Sürükleme:** pointer olayları, 8px dokunma/sürükleme eşiği,
bırakma hızının 140ms izdüşümüyle en yakın kenara yapışma,
localStorage'da `{side, topPct}`.

**Neden yüzde, neden piksel değil:** telefon yatay çevrildiğinde ya da
klavye açıldığında sabit piksel değeri ekranın dışına düşüyordu.
Sınırlar CSS `clamp` ile uygulanıyor
(`clamp(72px, calc(var(--fab-top) * 100%), calc(100% - 164px))`) —
resize dinleyicisi denendi ve elendi, her ekranda ayrı bir dinleyici ve
bir state turu demekti.

**Gerçek fizik döngüsü denendi ve elendi:** 56px'lik bir düğme için
görülebilir fark yaratmıyor, karşılığında bir animasyon döngüsü ve
iptal mantığı geliyordu. Tek adımlık izdüşüm + CSS geçişi yeterli.

### Ölçüm sırasında bulunan iki gerçek hata

1. **İpucu hiç görünmüyordu.** İlk sürüm `useSyncExternalStore` ile
   sessionStorage'dan okuyup "görüldü" işaretini kendi effect'inde
   yazıyordu. İki effect yarışıyordu: deponun hydration sonrası
   kontrolü yeniden render planlıyor, arkasından benim effect'im
   işareti yazıyor, planlanan render `getSnapshot`'ı tekrar çağırıp
   artık "görüldü" okuyordu. Artık ipucu her zaman DOM'da, CSS ile
   gizli, animasyonu açan sınıfı effect ekliyor.
2. **`@keyframes` yalnız `opacity`'yi değiştiriyordu**, taban kural
   `visibility: hidden` olduğu için ipucu opaklık 1'de de görünmezdi.
   Her karede `visibility` açıkça yazılıyor.

Ayrıca hedef bırakılan yerle aynıysa geçiş hiç tetiklenmiyor ve durum
"settle"de takılı kalıyordu; o durumda doğrudan idle'a geçiliyor.

---

## 7. Test sonuçları

`supabase/tests/*.sql` (11 dosya, sıralı HATA listesi diff'lendi):

```
--- SIRALI HATA LISTESI ---
(boş)
--- SAYILAR ---
HATA: 0
GECTI: 64
ERROR: 63
```

63 `ERROR` satırının hepsi testlerin **kasten** tetiklediği redler
(RLS politikası, `permission denied`, `Geçersiz dönem.`) ve bunları
izleyen "transaction is aborted" zincirleri. Sayıya değil listeye
bakıldı.

`leaderboard_rewards.sql` üç yeni senaryo kazandı:

| senaryo | ne kanıtlıyor | sonuç |
| --- | --- | --- |
| 7 | `period_start('season')` = aktif sezonun `starts_at`'i; 6 sezon ayarı; `'year'` reddediliyor | GEÇTİ |
| 8 | sezon penceresi sınırı: başlangıçtan 1sn önceki 4000 XP dışarıda, 1sn sonraki 7 XP içeride (sezon 7 / tüm zamanlar 4007) | GEÇTİ |
| 9 | üç tetikleme (award ×2 + `settle_season_badges`) → 3 kayıt, `badge_awarded` kalktı | GEÇTİ |

Mevcut iki senaryo güncellendi: ayar sayısı 12 → 18.

**Aktif sezon yoksa** ayrıca ölçüldü (işlem içinde, geri alındı):
`period_start('season') = infinity`, `active_season()` 0 satır,
`leaderboard_top('turkiye','season',50)` **0 satır, hata yok**.

`pnpm check:all` (types + lint + build): temiz.

---

## 8. Bulut push — M34a, M34b, M34c

`supabase migration list` öncesinde bulut `20260930000000`'a kadar
güncel, üç migration bekliyordu. Dry-run:

```
Would push these migrations:
 • 20261001000000_task_issuer_location.sql
 • 20261001010000_task_seed_24.sql
 • 20261001020000_season_period.sql
```

Push başarılı, üçü de uygulandı.

`db diff --linked` çıktısında yalnız **pg_cron eklentisi ve üç cron
işi** görünüyor — yerel gölge veritabanında pg_cron kurulu olmadığı
için beklenen fark. Tablo/fonksiyon sapması yok.

Bulut doğrulaması (IPv4 pooler üzerinden; doğrudan IPv6 host'a Docker
konteynerinden erişilemiyor, bu D33'te de böyleydi):

```
leaderboard_reward_settings period='season'  -> 6 satır (3000/1800/900, 1500/900/450)
period_start('season')                       -> 2026-06-30 21:00:00+00
tasks                                        -> 33 satır, 14'ünde issuer_name
cron.job                                     -> genclig-daily-spotlight    5 21 * * *
                                                genclig-leaderboard-settle 10 21 * * *
                                                genclig-season-settle      20 21 * * *
```

---

## 9. Canlı kontroller

`https://genclig.vercel.app` (commit `2592976`):

| yol | durum |
| --- | --- |
| `/` | 200 (karşılama'ya rewrite) |
| `/karsilama` | 200 |
| `/giris` | 200 |
| `/kayit` | 200 |
| `/onboarding` | 307 (oturumsuz) |
| `/siralama` | 200 |
| `/gorevler` | 200 |
| `/oduller` | 200 |
| `/zincirler` | **404** — aşağıya bakın |

Kimlik ekranlarında `bottom-nav` ve `reward-fab` **hiç yok** (üç
ekranda da 0 eşleşme), `giris.png` var, kökte "Hemen Başla" +
"Giriş Yap" + `auth-enter` var.

**`/zincirler` 404 ve bu bir D35 gerilemesi değil.** Böyle bir index
route hiç var olmadı: yalnız `/zincirler/[id]` var, arayüzde de sadece
`/zincirler/<id>` bağlantısı veriliyor (`chain-strip.tsx`), yani kırık
bağlantı yok. **D33 kapanışında "/zincirler 200" dediysem yanlış
söylemişim** — yerelde de 404 dönüyor, ölçüm bunu gösteriyor.

**Oturumlu canlı ekranlar doğrulanmadı.** Bulut anon anahtarı anonim
olarak indirilebilen paketlerde bulunamadı, bu yüzden üretimde test
oturumu açamadım. Bunun yerine aynı commit'in oturumlu ekranları
yerelde ölçüldü (aşağıdaki tablo) ve bulut veritabanı doğrudan
sorgulandı. Bu bir boşluk; sabah turunda elle bakılmalı.

Yerel oturumlu ölçüm (aynı commit):

| faz | ölçüm |
| --- | --- |
| G | `/gorevler` altı kategori bağlantısı; `?kategori=environment` ızgaraya geçiyor |
| K | `GençLİG`, `loop-badge`, `Sürekli` işaretleri var |
| SZ | hap "Bu Sezon", "Bu Yıl" hiç yok; `?donem=year` → Bu Sezon seçili |
| F | `reward-fab-ring`, `reward-fab-sweep`, `reward-fab-tip` var |

FAB davranışı headless Chrome + CDP ile **gerçek fare sürüklemesiyle**
ölçüldü (500×805):

| senaryo | sonuç |
| --- | --- |
| sol yarıya sürükle | x=16 (sol kenar), kayıt `{"side":"left",…}` |
| başka sayfa | konum korunuyor |
| sağ yarıya sürükle | x=413 (sağ kenar) |
| alt sınır | y=641, alt boşluk 108px (gezinme 100px) |
| üst sınır | y=72 |
| eşik altı dokunma | `/gorevler` → `/oduller` |
| sürükleme | `/gorevler` → `/gorevler` (açmıyor) |
| bozuk localStorage | varsayılan sağ alta düşüyor |
| ipucu | ilk sayfada görünür, ikincisinde değil |

Rozet durumları (tohum ödüllerinin tarihi ölçüm süresince geriye
alındı — ilk ölçüm bu yüzden kirliydi ve "eski" durumda YENİ
gösteriyordu; kod hatası değildi):

| durum | rozet |
| --- | --- |
| alınabilir ödül yok | işaret yok |
| alınabilir + eski | sade nokta |
| alınabilir + yeni | YENİ |
| yeni ama parası yetmiyor | işaret yok |

---

## 10. Ölçüm yöntemine dair iki not

**Yanlış negatif:** FAB ölçümünün ilk sürümünde "eşik altı dokunma bağı
açmıyor" çıktı. Sebep üründe değil ölçümdeydi: CDP `mousePressed`
öncesinde `mouseMoved` göndermiyordum ve Chrome `click` sentezlemiyordu.
İlk hareket eklendikten sonra dokunma `/oduller`'i açtı. Bir ölçüm
başarısızlığını ürün hatası sanmak, tersinden en az onun kadar
tehlikeli.

**Kirli veri:** rozet ölçümünde "alınabilir ama eski" durumu YENİ
gösterdi. Sebep tohum ödüllerinin 3 gün önce oluşturulmuş olması, yani
YENİ penceresinin içinde bulunmasıydı. Veriyi izole etmeden yapılan
ölçüm, doğru kodu hatalı gösterebiliyor.

---

## 11. Sabah turu — neye bakmalı

1. **Oturumsuz `/`**: fotoğraflı karşılama; alt gezinme, HUD ve FAB
   olmamalı. "Hemen Başla" → `/kayit`, "Giriş Yap" → `/giris`.
2. **`/giris`, `/kayit`**: fotoğraf arkada, iki scrim (üstte logo,
   altta düğmeler), form etiketleri okunur.
3. **`/gorevler`**: kategori satırları; 3'ten fazla görevi olan
   kategoride "Tümünü gör", azında sayı etiketi. Bir kategoriye
   tıklayıp geri çipiyle dönün.
4. **Görev kartı**: kurum adı (dernek/belediye/GençLİG) ve konum
   etiketi. Sürekli görevlerde döngü rozeti.
5. **`/siralama`**: hapta **"Bu Sezon"**, "Bu Yıl" olmamalı. Sezon
   seçiliyken şerit "Bu sezon ilk 3'e…". Takım sekmesine geçince şerit
   **takım** miktarlarını göstermeli (3000 değil 1500).
6. **`/admin/siralama-odulleri`**: 18 satır, Haftalık → Aylık → Sezon
   sırasında, Türkiye bloğu sonra Takım bloğu. Bir sezon satırını
   değiştirip kaydedin, `/siralama` şeridinde görünmeli.
7. **FAB**: basılı tutup sola sürükleyin, bırakınca sol kenara
   yapışmalı. Sayfa değiştirin, orada kalmalı. Kısa dokunuş
   `/oduller`'i açmalı.
8. **Bir sezonu elle bitirin** (`/admin/sezonlar`, "Dağıt" düğmesi) ve
   `/admin/siralama-odulleri` geçmiş dağıtımlarda `sezon-<id>` satırını
   görün. İkinci kez dağıtmayı denediğinizde yeni satır çıkmamalı.

---

## 12. Borçlar

**Acil:**

- **Veritabanı şifresi git geçmişinde.** `docs/NIGHT-REPORT-2.md:398`
  şifreyi iki kez düz metin taşıyordu; çalışma kopyasında maskelendi
  ama **geçmişte duruyor**. Rotasyon hâlâ gerekiyor: Supabase
  Dashboard → Project Settings → Database → Reset database password.
  Bu, kural 9'un ihlaliydi ve raporu yazarken ben yaptım.

**Bu dilimden:**

- Oturumlu canlı ekranlar üretimde doğrulanmadı (bkz. bölüm 9).
- Sezon ödüllerinin **tembel yolu yok**. Hafta/ay ödülleri
  `/siralama` ziyaretinde emniyet ağı olarak da dağıtılıyor
  (`settle_leaderboard_rewards`); sezon yalnız cron'a ve yönetim
  düğmesine bağlı. Cron sessizce düşerse sezon ödülü gecikir.
- M33 migration'ındaki bir yorum `settle_season_badges`'in "`/siralama`
  sezon başlığını okurken de çağrılabildiğini" söylüyor; grep tek
  çağıranın `settleSeasonsAction` (yönetim düğmesi) olduğunu gösteriyor.
  Yorum yanıltıcı: bir imkânı kurulmuş bir yol gibi anlatıyor.
  Uygulanmış bir migration'ı düzenlemek istemediğim için dokunulmadı.
- FAB konumu ilk boyamada varsayılan sağ altta çiziliyor, hydration'dan
  sonra kayıtlı yere geçiyor (çerez kullanılmadığı için). Taşınan FAB
  her tam sayfa yüklemesinde bir an sağ altta görünüyor.

**Devam edenler:**

- Ölü `TaskCard` / `task-card-compact.tsx`.
- `ReportCta` ödül metni koda gömülü.
- Davet kötüye kullanım önlemi yok (cihaz/IP kontrolü).
- Belediye zincirleri yok.
- 52 ham `<button>` `Button` bileşenine geçmedi.
- Rozet kutlamasında rozet adı görünmüyor.
- SQL kaynaklı yazımlardan push bildirimi gitmiyor.
- `redeem_reward` DB mesajı hâlâ "coin" diyor.
- Yönetim arama kutusu devre dışı.
- `rls_isolation.sql` yerel veritabanında satır bırakıyor.
- `(user)/loading.tsx` hâlâ ana sayfa şeklinde bir iskeleti `/bildir`,
  `/bildirimler`, `/ayarlar`, `/gorevlerim`, `/kesfet`, `/topluluk`,
  `/zincirler` segmentlerine servis ediyor.

**Yerel veritabanında bırakılan ölçüm kalıntıları** (buluta gitmedi,
migration'da yok): `d35check@example.com` kullanıcısının parolası
bilinen bir değere çekildi, `super_admin` rolü verildi ve 123 XP
yazıldı. Yerel veritabanı sıfırlanınca kaybolur.
