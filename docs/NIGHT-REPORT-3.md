# Gece Vardiyası 3 — DİLİM 22

## FAZ P — Performans

### P1 Ölçüm (önce)

**Canlı TTFB, Türkiye'den, rota başına 3 istek** (`curl -w %{time_starttransfer}`):

Oturumsuz:

```
/          632  529  518   ort 559ms  (200)
/gorevler 1613  664  769   ort 1015ms (200)
/profil    432  476  401   ort  436ms (307 — yönlendirme, DB işi yok)
/siralama  412  403  541   ort  452ms (307)
/oduller   478  423  356   ort  419ms (307)
/panel     529  409  462   ort  466ms (200 — yetkisiz ekranı)
```

Oturumlu (bulutta test kullanıcısı, aşağıda not var) — **asıl tablo bu**:

```
/          2292 2389 2316   ort 2332ms
/gorevler  1677 3716 1674   ort 2355ms
/profil    1875 1782 1636   ort 1764ms
/siralama  1532 1788 1587   ort 1635ms
/oduller   1719 1744 1604   ort 1689ms
/panel     1443 1186 1179   ort 1269ms
```

Oturumsuz 307'ler yanıltıcı: yönlendirme veritabanına hiç gitmiyor. Gerçek
durumu oturumlu tablo gösteriyor — **1.2 ile 2.4 saniye arası**.

### Kök sebep: bölge uyumsuzluğu

- **Supabase bölgesi:** `ap-southeast-2` (Sydney) — `supabase projects list`
- **Vercel fonksiyon bölgesi:** `iad1` (Virginia) — yanıt header'ı
  `X-Vercel-Id: fra1::iad1::…`. İlk alan edge PoP'u (Frankfurt), ikincisi
  fonksiyonun gerçekten koştuğu bölge.

Yani her Supabase sorgusu Virginia ile Sydney arasında gidip geliyor;
tek tur yaklaşık 250 ms.

### Sayfa başına tur sayısı (kod okunarak, kritik yol derinliği)

Sayfalar zaten `Promise.all` kullanıyor; sorun **paralellik değil, sıralı
önek**. Her sayfa `auth.getUser()` ile başlıyor ve içerideki yardımcılar
`getUser()`'ı **yeniden** çağırıyor (`listNotifications`,
`getSubmissionMap`, `rewards`, `problems`, `panel/guard`).

`/` ana sayfa kritik yolu:

```
1. middleware auth.getUser()          (edge fra1 → Sydney)
2. loadViewer auth.getUser()          (iad1 → Sydney)
3. profiles select                    sıralı
4. Promise.all(6) — en derin dal:
   4a. getUserPoints: 2 paralel + level_from_xp   → 2 tur
   4b. listNotifications: getUser + select        → 2 tur
5. getSubmissionMap: getUser + select             → 2 tur
```

Kritik yolda **~6 sıralı tur × 250 ms ≈ 1.5 sn**, üstüne middleware turu ve
derleme/işleme. Ölçülen 2332 ms ile örtüşüyor.

`auth.getUser()` çağrısı kod tabanında **22 ayrı yerde**; bir istekte
aynı kullanıcı için 3–4 kez ağ turu atılıyor.

### Not: buluttaki test kullanıcısı

Oturumlu ölçüm için bulutta `perfd22test@genclig.com` kullanıcısı açıldı,
e-postası doğrulandı ve profili tamamlandı. Mevcut satırlara dokunulmadı.
Ölçümler bitince silinecek (FAZ Z).

### P2–P7 Yapılanlar

- **P2 Bölge hizalama:** `vercel.json` → `"regions": ["syd1"]`. Fonksiyon
  veritabanının yanına taşındı.
- **P3 Sorgu paralelleştirme:** `src/lib/auth/viewer.ts` — React `cache()`
  ile `getViewerUser()` ve `getViewerProfile()`. 22 çağrı yerindeki tekrar
  eden `auth.getUser()` istek başına tek ağ turuna indi. Ana sayfa ve
  sıralama profil okumasını da paylaşıyor.
- **P4 Referans önbelleği:** `src/lib/reference/queries.ts` —
  iller/ilçeler/mahalleler/görev ve sorun kategorileri/seviyeler/rozetler
  `unstable_cache` ile 1 saatlik. Yönetici CRUD'ları `revalidateTag(…, "max")`
  ile anında tazeliyor.
  **Yol boyunca çıkan sorun:** `unstable_cache` içinde `cookies()`
  okunamıyor, `createClient()` ise okuyor. Çözüm: çerezsiz
  `createPublicClient()`. Bu tabloların hepsinin anon'a açık olduğu REST
  ile doğrulandı (8/8 tablo okunabiliyor). Kullanıcıya özel hiçbir sorgu
  bu önbelleğe konmadı — önbellek istekler arası paylaşıldığı için
  kişisel satır sızdırırdı.
- **P5 Algılanan hız:** 8 rotaya `loading.tsx` + gradyan shimmer iskeleti
  (`.skeleton`, `prefers-reduced-motion` altında duruyor). Alt gezinme ve
  üst bar iskelette de gerçek bileşen — veri gelince sayfa zıplamasın.
- **P6 İndeksler:** `20260917000000_indexes.sql`, 12 indeks; yerelde 12/12
  doğrulandı, buluta push edildi.
- **P7 Middleware:** matcher daraltıldı (font/css/js/map/json/robots/sw ve
  `/api/health` eklendi). Daha önemlisi: middleware HER istekte
  `auth.getUser()` çağırıyordu. Artık token'ın bitiş zamanı çerezden
  **yerelde** okunuyor ve ağa yalnızca token dolmuşsa ya da 120 sn içinde
  dolacaksa çıkılıyor.

### P8 Son ölçüm

Oturumlu TTFB, rota başına 3 istek, Türkiye'den:

```
rota        önce     P2 sonrası   hepsi sonrası   değişim
/           2332ms   1174ms       1067ms          -54%
/gorevler   2355ms   1402ms        966ms          -59%
/profil     1764ms   1519ms       1023ms          -42%
/siralama   1635ms   1063ms        733ms          -55%
/oduller    1689ms   1141ms        819ms          -51%
/panel      1269ms   1104ms        802ms          -37%
```

### Hedef tutturuldu mu — dürüst cevap

Hedef "oturumlular < 800 ms" idi. **Kısmen tutturuldu:** `/siralama` 733 ms
ile altında, `/panel` 802 ms ve `/oduller` 819 ms sınırda, `/`, `/gorevler`
ve `/profil` ~1 sn.

Kalanın neredeyse tamamı uygulama değil, fizik. Ölçüldü:

```
statik varlık (edge'den, fonksiyon yok)        ~310 ms
/api/health (dinamik rota, DB'ye hiç gitmiyor) ~590 ms
```

`/api/health` hiçbir veritabanı işi yapmıyor ve yine de 590 ms. Yani
**fonksiyon çağrısının kendi tabanı 590 ms** (Türkiye → Frankfurt edge →
Sydney fonksiyon). Sayfalarımız bu tabanın 150–480 ms üstünde çalışıyor;
optimize edilecek asıl kısım burası ve zaten büyük ölçüde alındı.

**syd1 doğru seçim mi?** Ölçümle evet. Alternatif fra1 (kullanıcıya yakın,
veritabanına uzak) olsaydı: ~310 ms taban + kritik yoldaki ~4 sıralı sorgu
× ~280 ms ≈ 1430 ms. syd1'deki ölçülen 1067 ms bundan iyi.

**< 400 ms'e inmenin tek yolu Supabase projesini Avrupa bölgesine taşımak.**
O zaman fonksiyon fra1'e döner, taban ~310 ms olur ve sorgular yerelleşir.
Bu bir proje taşıma işi (yeni proje + veri aktarımı + anahtar değişimi);
dilim kapsamında olmadığı ve DOKUNMA sınırına yakın olduğu için
yapılmadı — proje sahibinin kararı.

---

## FAZ N — Navigasyon + HUD

**Alt gezinme v2** (`src/components/user-bottom-nav.tsx`): beş sekme,
ortada Görevler yükseltilmiş gradyan daire olarak. Uygulamanın asıl eylemi
görev yapmak ve beş eşit sekme arasında kaybolmuştu. Aktif sekmede
`nav-glow` (iki katmanlı box-shadow) ve hafif büyüme; basınca
`group-active:scale` ile yay hissi.

Aktif/pasif ayrımı ikon kalınlığıyla: aktifte `strokeWidth 2.6`, pasifte
`1.9`. Ayrı bir "dolu ikon" kümesi taşımadan dolu hissi veriyor — lucide'ın
outline setine ikinci bir set eklemek bundle'ı iki katına çıkarırdı.

Altıncı sekme denendi ve elendi: 360 px genişlikte dokunma hedefleri parmak
genişliğinin altına iniyordu.

**Kalıcı HUD** (`src/components/user-hud.tsx`): solda kompakt seviye halkası
+ avatar (rozet olarak seviye sayısı), ortada ad ve ince cyan XP çubuğu
("… XP kaldı"), sağda altın coin hapı + çan + tema düğmesi. Oturumsuzda
"Giriş yap" hapı.

Dokuz ana ekrana bağlandı; alt ekranlar (ayarlar, bildirimler, bildir,
kuponlarım) eski `UserHeader`'da kaldı — HUD her ekranda tekrarlanınca
derinlik hissi kayboluyordu.

`loading.tsx` için ayrı `UserHudSkeleton`: gerçek HUD veri bekleyen async
bir sunucu bileşeni, yükleme ekranının kendisini bekletirdi. İskelet aynı
yüksekliği kaplıyor, veri gelince üst bar zıplamıyor.

**Buton dili** (`.btn-chunky`): 2 px koyu alt kenar, basınca
`translateY(2px)` + kenar sıfırlanıyor — gerçek bir tuş gibi içeri çöküyor.
25 dosyada 36 birincil butona uygulandı. Denenen ve elenen alternatif:
yalnızca `scale` küçültmek — dokunma geri bildirimi veriyordu ama "tuş"
hissi vermiyordu. `prefers-reduced-motion` altında geçiş ve dönüşüm kapalı.

---

## FAZ G — Görev ekranı v2

**Filtreler** (`src/components/tasks/task-filters.tsx`):

- Üstte **Bireysel | Takım** segmentli anahtarı; seçili taraf gradyanlı bir
  gösterge olarak kayıyor (`transition-all`, 300 ms).
  Üçüncü konum ("Hepsi") bilerek yok: iki durumlu anahtarda kayan gösterge
  okunabiliyor, üç durumda anahtar olmaktan çıkıp sıradan bir sekme şeridine
  dönüyordu. "Hepsi"ye dönüş seçili tarafa tekrar dokunarak yapılıyor.
- Altında yatay kaydırmalı **tip çipleri** — Tümü / Sürekli / Anlık, her
  birinde kaç görev olduğunu gösteren sayı rozetiyle. Kullanıcı boş bir
  sekmeye tıklayıp "hiç görev yok" ekranıyla karşılaşmasın diye.
- Anlık çipinde nabız gibi yanıp sönen canlı noktası (`.live-dot`),
  `prefers-reduced-motion` altında duruyor.

Sayılar tek sorgudan hesaplanıyor: her çip için ayrı `count` sorgusu üç ek
veritabanı turu demekti. Sayfalama eklendiğinde yeniden değerlendirilmeli
(kod içinde not düşüldü).

**Kart v2** (`src/components/tasks/task-card.tsx`): zorluk kademesi
2 px çerçeve rengiyle (kolay bronz `#b07b4f`, orta gümüş `#9aa6b8`, zor
altın `#d4a02c`) **ve** sağ üst köşede kademe adını yazan rozetle. Renk tek
başına yeterli değil — renk körlüğünde ayırt edilemiyordu.

Kategori chip ikonu 44 px'e çıktı (`IconBadge size="card"`): 40 px kart
içinde zayıf kalıyordu, 56 px ise başlığı aşağı itiyordu. XP/Coin hapları
sağda dikey sütunda — kartın sağ kenarı bir "fiyat etiketi" sütunu gibi
okunuyor. Anlık görevde geri sayım hapı turuncu→magenta gradyanında.

**Takım bandı:** kartta "Takım · N/M kişi", detayda üye ilerleme çubuğu
(magenta→mor gradyan) ve eşik dolduğunda "Eşik doldu — bonus yazıldı."

**Yeni RPC** `team_task_progress(uuid[])` (`20260917010000_team_progress.sql`):
`security definer` olmak zorunda — RLS kullanıcıya yalnızca kendi
teslimlerini gösteriyor, takım arkadaşlarının teslimleri normal sorguyla
sayılamıyor (aynı sınıf sorun D07'de ölçülmüştü). Fonksiyon yalnızca sayı
döndürüyor, kimin tamamladığını sızdırmıyor.

**Kanıtlar (yerel psql):**
- Teslim yokken ilerleme `0`, doğru görev kimliğiyle
- A teslim → `1`
- B de teslim → **A da B de `2` görüyor** (RLS'e rağmen takım geneli sayım)
- `anon` çalıştırma yetkisi → `false`

---

## FAZ D — Duyuru sistemi (M20)

**Migration:** `20260917020000_announcements.sql`

`announcements` (title, body, audience, municipality_id, target_user_id,
created_by, sent_count) + `notifications.type` check'ine `'announcement'`.

**Hedef tutarlılığı veritabanında:** `announcements_target_matches_audience`
kısıtı — `audience` ne diyorsa o alan dolu, diğerleri boş. Uygulama
katmanında kontrol etmek yetmezdi; tek doğruluk kaynağı veritabanı.

**Yetki kuralı** (`send_announcement`): süper admin `all`/`municipality`/
`user`; personel **yalnızca** `audience='municipality'` ve **yalnızca kendi**
belediyesi. Personelin `all` gönderebilmesi, tek bir belediyenin tüm ülkeye
duyuru atması demekti.

`security definer` olmak zorunda: hedef kullanıcıları bulmak için
`profiles`'ın tamamını okumak gerekiyor, oysa RLS kullanıcıya yalnızca kendi
satırını gösteriyor. Fonksiyon dışarıya yalnızca gönderilen sayıyı veriyor.

**Kullanıcı için `announcements` select politikası bilerek yok:** duyuruyu
çanından bildirim olarak alıyor, gönderim kaydını görmesine gerek yok.

**Kanıtlar (yerel psql, 4 kullanıcı + 2 belediye):**
- Süper admin `all` → **4 gönderildi**, `notifications` 4 satır,
  `sent_count = 4` (kullanıcı sayısına eşit)
- Personel **başka** belediyeye → "Bu belediye için duyuru gönderme yetkin
  yok."
- Personel `all` → "Yalnızca kendi belediyenin kullanıcılarına duyuru
  gönderebilirsin."
- Personel kendi belediyesine → **2 gönderildi**; duy_p ve duy_u aldı,
  duy_s ve duy_v **almadı** (doğru hedefleme)
- Tek kullanıcıya → 1 gönderildi, yalnızca duy_v aldı
- Olmayan kullanıcı → "Kullanıcı bulunamadı."
- Normal kullanıcı gönderemiyor; `announcements` satırı görmüyor (0),
  geçmiş boş (0)
- Personel geçmişi yalnızca kendi belediyesininki (1 satır); süper admin
  hepsini görüyor (3 satır)
- **Çan sayacı:** duy_u okunmamış bildirim **2** (genel + belediye duyurusu)
- Doğrudan insert → `permission denied`; anon gönder/liste/select ve
  authenticated insert → hepsi `false`

**Yol boyunca çıkan iki hata (ikisi de benim):**
1. Migration'da rolü `municipality_staff` yazmıştım; şemadaki ad
   `municipality_operator`. Düzeltildi.
2. Test betiğinde `\gset` değişkenini `:'MUNI'` diye okudum; psql sütun
   takma adını küçük harfe çeviriyor, doğrusu `:'muni'`. İlk koşumda
   senaryoların yarısı sessizce atlanmıştı — düzeltilip yeniden koşuldu.

**UI:** `/admin/duyurular` (hedef seçimi: tümü / belediye / tek kullanıcı),
`/panel/duyurular` (hedef kendi belediyesinde sabit, belediye seçici hiç
gösterilmiyor), ana sayfada gradyan kenarlı kapatılabilir duyuru afişi.

Afişin kapatılma bilgisi `localStorage`da: kişisel ve önemsiz bir tercih
için her kullanıcıya satır açmak ve her ana sayfa yüklemesine bir sorgu
daha eklemek gereksizdi. Okuma `useSyncExternalStore` ile —
`useEffect` + `setState` denendi, lint `set-state-in-effect` ile reddetti
(aynı kurala D05'te de takılmıştık) ve haklıydı: efektle state yazmak
fazladan bir render turu demek.

---

## FAZ S — Açık borç kapandı: takım görevi formu

D21 FAZ D'de bildirilen boşluk: panel ve admin görev formlarında takım
alanları yoktu, takım görevi yalnızca migration seed'iyle gelebiliyordu.

**Form** (`src/components/panel/task-form.tsx`): Zorluk alanının altına
Bireysel | Takım anahtarı. Takım seçildiğinde **koşullu** olarak eşik
(2–10), bonus XP ve bonus coin alanları açılıyor. Bireysel görevde
gösterilmiyor — boş bırakılması gereken alanlar formu gürültülü yapıyordu.

**Ad çakışması (yol boyunca çıktı):** `task-actions.ts` içindeki `Input`
tipinde `scope` alanı zaten vardı ve **farklı** bir anlam taşıyordu
(`"panel" | "admin"` — çağıranın hangi panelden geldiği, `municipality_id`
buna göre belirleniyor). Yeni alan `taskScope` olarak adlandırıldı; aynı
adı kullanmak, görev kapsamının belediye kimliğini belirleyen mantığı
sessizce bozardı.

**Sunucu doğrulaması** (`saveTaskAction`):
- Takım görevinde eşik zorunlu ve 2–10 arasında. Form alanı gizlenebilir ya
  da istek elle yazılabilir; eşik olmadan `award_task_points` varsayılan 2
  ile çalışır ve yönetici hiç istemediği bir eşik almış olurdu.
- Bonus negatif olamaz.
- İkisi de sıfır olan takım görevi reddediliyor — takımca tamamlamanın
  karşılığı bireysel ödülle aynı kalırdı.
- Bireysel görevde bu alanlar sunucuda sıfırlanıyor (`scope: "individual"`,
  `min_team_size: null`, bonuslar 0).

Düzenleme formu da bu alanları yüklüyor (`loadTaskForEdit`).

**Kanıtlar (yerel psql):**
- Kolonlar yerinde: `scope` (not null, default `individual`),
  `min_team_size` (nullable), bonuslar (not null, default 0)
- Geçersiz kapsam (`'takim'`) → `tasks_scope_check` ihlali
- Eşik 99 → `tasks_min_team_size_check` ihlali
- Geçerli takım görevi yazıldı: `team / 3 / 60 / 30`
- Feed sorgusu üç takım görevini de görüyor (ikisi seed, biri yeni)

---

## FAZ R — Ödül mağazası v2

**Vitrin:** üstte büyük afiş kart — "ÖNE ÇIKAN" şeridi, geniş görsel alanı,
kademe çerçevesi.

Seçim kuralı: kullanıcının **şartlarını karşıladığı** ödüller arasından en
pahalısı. "Alabileceğin en iyi ödül" mantığı — erişilemeyen bir ödülü
vitrine koymak motive etmek yerine engeli hatırlatıyordu. Hiçbiri
karşılanmıyorsa vitrin **en ucuz** ödülü gösteriyor, yani bir sonraki hedefi
işaret ediyor.

**Yapışkan bakiye barı:** HUD'un hemen altında (`top-[57px]`). Mağazada
gezerken "param yetiyor mu" sorusu her kartta soruluyor; kullanıcı yukarı
kaydırmak zorunda kalmamalı.

**Maliyet kademesi:** <300 bronz, 300–700 gümüş, >700 altın. Hem 2 px
çerçeve rengi hem köşe şeridi — renk tek başına ayırt edici değil.
Görseli olmayan ödüllerde kademeye göre gradyan zemin + dev hediye ikonu.

**Şart çipleri:** karşılanan yeşil tik, karşılanmayan kırmızımsı kilit
çipi ("Seviye 5", "… rozeti", "120 coin daha"). Önceki sürüm şartları düz
metin listesi olarak yazıyordu; çip hâli hangi şartın tamam olduğunu da
gösteriyor.

**Kod açılış anı:** satın alma onayından sonra kart CSS 3D `rotateY` ile
çevriliyor (`.flip-scene` / `.flip-inner`), arka yüzde gradyan başlık,
kesikli ayırıcı ve kupon kodu. `prefers-reduced-motion` altında dönüş
kapalı ve arka yüz doğrudan gösteriliyor — yoksa kod hiç görünmezdi.

**Kuponlarım bilet görünümü:** `.ticket` — iki yandaki zımba delikleri ve
kesikli ayırıcı saf CSS. Denenen ve elenen alternatif: SVG maske — aynı
görüntüyü veriyordu ama tema değişiminde arka plan rengini takip
etmiyordu, çünkü maske rengi bilmiyor; `radial-gradient` `var()`
okuyabiliyor. Aktif kuponda gradyan durum şeridi, kullanılmışta soluk.

---

## FAZ V — Profil "Seviye Yolu" + rötuşlar

**Seviye Yolu** (`src/components/profile/level-path.tsx`): dikey yol —
mevcut seviye gradyanlı ve parıltılı düğüm, sonraki beş seviye sıralı,
aralarında ilerleme çizgisi. Her düğümde "… XP kaldı".

**Yeni tablo yok:** tamamı `levels` ve `badges` verisinden türetiliyor.
Rozet eşleşmesi yalnızca `xp_total` kriterli rozetlerde yapılıyor; görev
sayısı, kategori ve bildirim kriterli rozetler XP'ye çevrilemiyor ve
uydurma bir eşleştirme kullanıcıya yanlış hedef gösterirdi. Rozet, iki
seviye eşiği arasına düşen XP değerine sahipse o düğümde beliriyor.

**Yol boyunca çıkan hata (benim):** FAZ P'de yazdığım `getLevels()`
sorgusunda `title` kolonunu seçiyordum; `levels` tablosunda öyle bir kolon
yok (yalnızca `level` ve `min_xp`). Seviye Yolu'nu bağlarken yakalandı ve
düzeltildi. FAZ P'de bu sorgu hiçbir yerden çağrılmadığı için sessiz
kalmıştı.

**Podyum kademe renkleri:** 1 altın `#d4a02c`, 2 gümüş `#9aa6b8`,
3 bronz `#b07b4f` — madalya geleneği. Önceki sürümde 3. basamak marka
moruydu ve "üçüncülük" okunmuyordu. Taç ikonu yalnızca birincide; üçünde
de olsa ayırt ediciliği kaybolurdu.

**Eski yeşil/soluk kalıntı taraması:** kod, stil ve yapılandırmada
`#17b890` / `#3ddc97` yok. Tek kalıntı `globals.css` içindeki
`--color-teal` token'ıydı (v2'de indigoya yönlendirilmişti) — artık
hiçbir yerden okunmuyordu, ölü token olarak silindi. Kullanan son yer
podyumun 3. basamağıydı, o da bronza geçti.

---

## FAZ Z — Kapanış

### Bulut push

Bu dilimde dört migration buluta gitti:

```
20260917000000_indexes.sql          (P6 — 12 indeks)
20260917010000_team_progress.sql    (FAZ G — takım ilerleme sayacı)
20260917020000_announcements.sql    (FAZ D — M20)
```

Kapanış kontrolü:

```
db push --dry-run  → {"upToDate":true,"migrations":[]}
db diff --linked   → No schema changes found
```

Yerel ile bulut birebir; bekleyen migration yok.

### `rls_isolation.sql` — SENARYO 25 (duyuru)

Dosya 709 satır. Tam koşumda **17 `ERROR` satırının hepsi beklenen
reddetme**; beklenmeyen hata yok.

Duyuru senaryosunun doğruladıkları:
- Normal kullanıcı duyuru gönderemiyor
- Personel `all` gönderemiyor (yalnızca kendi belediyesi)
- Süper admin `all` → **3 kullanıcı, 3 bildirim, `sent_count = 3`**
  (üçü de birbirine eşit — hedefleme doğru)
- Normal kullanıcı `announcements` satırı görmüyor (0), geçmiş boş (0),
  doğrudan insert → `permission denied`
- Çan sayacı arttı: okunmamış duyuru bildirimi 1
- `provinces` 81, `profiles` 3 — test verisi sızıntısı yok

### `pnpm check:all`

Her fazın sonunda koşuldu, hepsinde çıkış kodu **0**.

### Canlı TTFB — dilim sonu (tüm fazlar yayında)

Deploy sonrası soğuk lambda etkisini geçmek için ısındırma yapıldı, sonra
rota başına **7 örnek** alınıp **medyan** raporlandı:

```
rota          medyan
/api/health    612ms   ← taban: dinamik rota, DB'ye hiç gitmiyor
/gorevler      738ms
/profil        773ms
/              834ms
/panel         886ms
/oduller      1093ms
/siralama     1289ms
```

Dilim başıyla karşılaştırma (3 örnek ortalaması → 7 örnek medyanı):

```
rota        dilim başı   dilim sonu   değişim
/           2332ms       834ms        -64%
/gorevler   2355ms       738ms        -69%
/profil     1764ms       773ms        -56%
/siralama   1635ms      1289ms        -21%
/oduller    1689ms      1093ms        -35%
/panel      1269ms       886ms        -30%
```

**Ölçümün sınırı, açıkça:** bağlantım gürültülü. Aynı rotada ardışık
örnekler 600 ms ile 1900 ms arasında salınıyor ve bir ölçümde 12 saniyelik
uç değer görüldü. Bu uç değerlerin uygulama değil ağ kaynaklı olduğunu
şöyle doğruladım: `/api/health` — hiçbir veritabanı işi yapmayan rota —
aynı anda aynı salınımı gösteriyor. Sayfa medyanları tabanın 125–680 ms
üstünde; yani ölçülen sürenin büyük kısmı ağ.

Daha kesin bir rakam için ölçümün Avrupa'daki sabit bir sunucudan
yapılması gerekir; buradan alınan sayılar yön gösteriyor, mutlak değer
olarak kullanılmamalı.

**Hedef "< 800 ms":** `/gorevler` (738) ve `/profil` (773) altında,
`/` (834) ve `/panel` (886) sınırda, `/oduller` (1093) ve `/siralama`
(1289) üstünde. Taban 612 ms olduğu için hedefin altına inmenin tek
gerçek yolu hâlâ Supabase projesini Avrupa bölgesine taşımak — P8'de
gerekçesiyle yazıldı.

### Temizlik

Oturumlu ölçüm için buluta açılan `perfd22test@genclig.com` kullanıcısı
**silindi**. Bulutta yalnızca gerçek süper admin hesabı kaldı (1 kullanıcı).
Mevcut satırların hiçbirine dokunulmadı.

### MOCKUP EKLENTİSİ listesi

Dilim metninde adı geçmeyen, görsel hedefi tamamlamak için eklenenler:

1. **`IconBadge` için "card" (44 px) kademesi** — dilimde "44px chip"
   isteniyordu ama mevcut bileşende yalnızca 36/40/56 vardı.
2. **Görev kartında kademe adı rozeti** ("Kolay/Orta/Zor") — dilim yalnızca
   çerçeve rengi istiyordu; renk körlüğünde çerçeve tek başına ayırt edici
   değil.
3. **Ödül kartında kademe adı şeridi** ("Bronz/Gümüş/Altın") — aynı gerekçe.
4. **`/oduller/kuponlarim` ekranının HUD'a geçirilmesi** — bilet görünümü
   eklenince eski başlık barı tutarsız kalıyordu.
5. **`team_task_progress` RPC'si** — "Takım · N kişi" bandı için sayının
   nereden geleceği dilimde yazmıyordu; RLS altında normal sorguyla
   alınamadığı için definer fonksiyon gerekti.
6. **`x` ve `crown` ikonlarının küratörlü kümeye eklenmesi** — duyuru
   afişinin kapatma düğmesi ve podyum tacı için.

### Bilinçli kapsam dışı

- **Supabase bölge taşıma** (P8'de gerekçesiyle): tek başına en büyük
  kazanç adayı ama proje taşıma işi; dilim kapsamında değil, proje
  sahibinin kararı.
- DOKUNMA listesi korundu: çark/çekiliş/rastgele ödül mekaniği **yok**,
  push notification yok, streak yok, etkinlik domain'i yok, auth
  değişikliği yok.
- Ödül kartındaki `flip` animasyonu yalnızca satın alma anında; ayrı bir
  "kart açma" mekaniği (kasa/çark benzeri) bilerek yapılmadı.

### Sabah görsel turu — bakılacak ekranlar

1. **Alt gezinme** — ortadaki yükseltilmiş Görevler düğmesi, aktif
   sekmedeki parıltı halkası, basınca yay animasyonu
2. **HUD** — seviye halkası + avatar, XP çubuğu, coin hapı; oturumsuzda
   "Giriş yap" hapı
3. `/` — duyuru afişi (kapatılabilir), hızlı erişim, öne çıkan görev
4. `/gorevler` — Bireysel|Takım segment anahtarının kayan göstergesi,
   çiplerdeki sayı rozetleri, Anlık çipindeki yanıp sönen nokta
5. `/gorevler` kartları — bronz/gümüş/altın çerçeveler ve köşe rozetleri,
   sağdaki dikey XP/Coin sütunu
6. **Takım görevi detayı** — üye ilerleme çubuğu
7. `/oduller` — vitrin afiş kartı, yapışkan bakiye barı, şart çipleri;
   bir ödül alıp **kart çevirme + kod açılışını** görün
8. `/oduller/kuponlarim` — bilet görünümü (zımba delikleri, kesikli çizgi)
9. `/profil` — **Seviye Yolu** dikey yolu ve rozet kesişimleri
10. `/siralama` — podyumdaki altın/gümüş/bronz ve birincideki taç
11. `/admin/duyurular` ve `/panel/duyurular` — hedef seçimi; panelde
    belediye seçicinin hiç görünmediğini doğrulayın
12. **Panel görev formu** — Takım seçilince eşik ve bonus alanlarının
    açılması
13. Yükleme iskeletleri — yavaş bağlantıda shimmer'ı görmek için
    tarayıcı throttle
14. Karanlık/aydınlık tema ve `prefers-reduced-motion` (animasyonlar
    durmalı, kupon kodu yine de görünmeli)

### Dilim özeti

Yedi faz, dokuz commit, hepsi push'landı. Dört migration buluta gitti,
`db diff --linked` temiz. `check:all` her fazda 0.

**Bulunan ve düzeltilen hatalar (hepsi benim):**
1. `unstable_cache` içinde `cookies()` okunamıyor → çerezsiz
   `createPublicClient()`
2. `revalidateTag` Next 16'da iki argüman istiyor
3. `AUDIENCE_LABEL` sunucu modülünde durunca client bundle'a `next/headers`
   sızdı (D21'deki aynı tuzak)
4. Duyuru migration'ında rol adı `municipality_staff` yazılmıştı; doğrusu
   `municipality_operator`
5. Test betiğinde `\gset` değişkeni büyük harfle okundu; psql küçültüyor —
   ilk koşumda senaryoların yarısı sessizce atlanmıştı
6. `task-actions.ts` içinde `scope` adı zaten "panel|admin" anlamında
   kullanılıyordu; yeni alan `taskScope` oldu
7. `getLevels()` var olmayan `title` kolonunu seçiyordu; hiç çağrılmadığı
   için FAZ P'de sessiz kalmıştı, FAZ V'de yakalandı
8. `announcement-banner` ilk sürümü `useEffect` + `setState` kullanıyordu;
   lint `set-state-in-effect` ile reddetti → `useSyncExternalStore`
