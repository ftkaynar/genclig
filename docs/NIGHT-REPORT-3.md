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
