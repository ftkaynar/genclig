# Gece Vardiyası 9 — DİLİM 28

Fazlar: A (avatar fix) · L (Arkadaşlar sekmesi) · D (istat decay) · G (görev
kartı v3) · Z (kapanış). Her faz ayrı commit, hepsi `origin/main`'de.

---

## FAZ A — Avatar yükleme: kök sebep

### Semptom

Kullanıcı avatar seçiyor, "32 KB → 21 KB küçültüldü" mesajını görüyor,
ardından "öğe yüklenemedi" hatası alıyor. Yani sıkıştırma çalışıyor,
storage yüklemesi patlıyor.

### Teşhis — doğal deney

Uygulama kodu hatayı yutuyordu (`setError("Görsel yüklenemedi. Tekrar
dene.")`, ham hata hiçbir yere yazılmıyor), bu yüzden önce ham yanıtı
görmek gerekti. Yerelde gerçek bir oturumla, aynı 160 baytlık JPEG ile
dört yükleme denendi:

```
avatars,        upsert: true   -> new row violates row-level security policy
avatars,        upsert: false  -> BAŞARILI
task-proofs,    upsert: true   -> BAŞARILI
problem-photos, upsert: true   -> BAŞARILI
```

Çalışan iki bucket ile çalışmayan bucket arasındaki tek fark
`pg_policies`'te görüldü:

```
avatars_delete_own|DELETE      task_proofs_insert_own|INSERT
avatars_insert_own|INSERT      task_proofs_select_own|SELECT     <-- var
avatars_update_own|UPDATE      task_proofs_select_staff|SELECT
(SELECT politikası YOK)        problem_photos_select_own|SELECT  <-- var
```

### Kök sebep

storage-api, `upsert` isteğini `insert ... on conflict do update` olarak
çalıştırıyor. PostgreSQL bu ifadede çakışan satırı **okumak** zorunda,
yani SELECT politikası arıyor. `avatars` bucket'ında SELECT politikası
yoktu.

Bucket'ın `public = true` olması yalnızca **imzasız HTTP okumasını**
açıyor; SQL düzeyindeki RLS'i hiç etkilemiyor. M25'teki
"okuma bucket public olduğu için politikaya bağlı değil" yorumu bu
yüzden eksikti — ve hatayı üç ay görünmez tuttu.

Sıkıştırmanın çalışıp yüklemenin patlaması da buradan: compress
istemcide, RLS sunucuda. İkisi arasında hiçbir bağ yok.

### Doğrulama

Politika elle eklendiğinde `upsert: true` anında BAŞARILI oldu, yanlış
klasöre yükleme hâlâ reddedildi. Migration'a alınıp `db reset` ile
sıfırdan uygulandıktan sonra da aynı sonuç.

### Düzeltme — iki taraflı

- **M28a** (`20260922000000_avatar_upload_fix.sql`): `avatars_select_own`
  eklendi; `avatars_update_own`'a açık `with check` yazıldı (davranış
  zaten doğruydu, örtük davranışa yaslanmamak için açık).
- **avatar-upload.tsx**: `upsert: false`. Yol zaten zaman damgalı, üzerine
  yazılacak satır yok — bayrak baştan gereksizdi.

Tek başına istemci düzeltmesi yeterli olurdu ama kabul edilmedi: bucket
SELECT politikası olmadan kullanıcı kendi dosyasını listeleyemiyor ve
ileride üzerine yazma yine kırılırdı.

### 100 KB sınırı

Sınır **sıkıştırmadan sonraki** dosyaya uygulanıyor. Ham dosyaya
uygulansaydı kamerayla çekilen hiçbir fotoğraf yüklenemezdi (telefon
kamerası 4-8 MB üretiyor).

`compressToLimit` merdiveni: kalite `0.82 → 0.3`, sonra çözünürlük
`1x → 0.75x → 0.5x`. İlk sığan adımda duruyor.

```
a) inilebilir   -> withinLimit: true  | 1 deneme  | 1600x1200 q0.82
b) inilemez     -> withinLimit: false | 18 deneme | en küçük 288000
c) görsel değil -> withinLimit: false
d) zaten küçük  -> withinLimit: true
```

18 denemede de inemezse **"Görsel en fazla 100 KB olabilir."**

Ham dosya için ayrı bir 8 MB sınırı KALDI: 50 MB'lık bir kareyi çözmek
telefonda sekmeyi kilitliyor. Sebebi farklı, mesajı farklı.

### Hata yutma düzeltildi

`describeUploadError` ham hatayı **her zaman** konsola yazıyor, kullanıcıya
sebebe uygun bir yönlendirme veriyor:

| Ham hata | Kullanıcıya |
|---|---|
| RLS / AccessDenied / jwt | "Yükleme izni alınamadı. Çıkış yapıp tekrar giriş yapmayı dene." |
| payload too large | "Görsel en fazla 100 KB olabilir." |
| fetch / network / timeout | "Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene." |
| diğer | "Görsel yüklenemedi. Tekrar dene." |

Aynı fix üç akışa da uygulandı: avatar, görev fotoğrafı, sorun fotoğrafı.

### Uçtan uca kanıt (yerel)

```
e2e yukleme:        BASARILI
e2e profiles update: BASARILI
e2e avatar_url:     DOLU
e2e public URL:     200 image/jpeg
```

---

## FAZ L — Sıralamadan Arkadaşlar sekmesi

`SCOPES` listesinden çıkarıldı. Sayfa geçerli kapsamı bu listeden
doğruladığı için `?kapsam=arkadaslar` sessizce varsayılana (Türkiye)
düşüyor — ölü sekme ya da boş liste kalmıyor.

`leaderboard_top` içindeki `'arkadaslar'` kapsamı **DB'de duruyor**: ana
sayfadaki "Arkadaşlarında #N" kartı `getMyRank("arkadaslar")` ile
besleniyor. O kartın bağlantısı artık `/siralama` yerine `/arkadaslar`'a
gidiyor.

Yan kazanç: alan çipleri dörde inince 390 px ekranda yatay kaydırma bitti
(4 çip ≈ 340 px, kullanılabilir 358 px).

---

## FAZ D — İstat decay (M27)

### Mimari kararı: decay OKUMA ANINDA

`user_stats` satırındaki değerler **TABAN** (decay'siz) olarak duruyor;
`my_stats` / `stats_for` / `get_profile_card` son aktifliğe göre çarpanı
uyguluyor.

**Denenen ve elenen 1 — pg_cron ile gecelik toplu recompute.** Yerelde
kurulu değil (`pg_available_extensions`'ta var, `pg_extension`'da yok —
ölçüldü), bulutta ayrıca açılması gerekiyor ve yerel/bulut ayrışıyor.
Daha önemlisi: gecelik job uygulamayı hiç açmayan binlerce kullanıcı için
de hesap yapar. Ve 03:00'te sessizce düşen bir job'ı fark etmek, satır içi
bir çağrının patlamasını fark etmekten çok daha zor.

**Denenen ve elenen 2 — "stale ise satıra decay'li değer yaz".** Kullanıcı
40 gündür uygulamayı açmadıysa satırı kimse tazelemiyor ve ARKADAŞI onun
kartına baktığında eski (yüksek) istatları görüyor. Decay'in yazıya bağlı
olması decay'i görünmez kılıyordu.

Okuma anında hesaplayınca her bakan doğru değeri görüyor ve kullanıcı bir
görev tamamlar tamamlamaz istat **anında** toparlıyor.

**BORÇ:** "kimse bakmasa da doğru olsun" gereği doğarsa (toplu rapor,
e-posta kampanyası) pg_cron ile gecelik bir TABAN recompute işi
eklenmeli. Decay mantığı değişmeden kalır.

### Eğri (ölçüldü)

```
gün    AKT    AZM    SOS    KEŞ    BİL    KAT
 0    1.000  1.000  1.000  1.000  1.000  1.000
 5    1.000  1.000  1.000  1.000  1.000  1.000
 7    1.000  1.000  1.000  1.000  1.000  1.000
14    0.939  0.951  0.963  0.970  0.976  0.991
30    0.800  0.840  0.880  0.900  0.920  0.970
60    0.625  0.700  0.775  0.813  0.850  0.944
90    0.450  0.560  0.670  0.725  0.780  0.918
180   0.450  0.560  0.670  0.725  0.780  0.918   <- taban düz
365   0.450  0.560  0.670  0.725  0.780  0.918
```

Ayarlanabilir sabitler `stat_decay_factor` içinde tek yerde:
`grace_days 7`, `step_days 30`, `floor_days 90`, `step_loss 0.20`,
`floor_loss 0.55`.

### Duyarlılıklar ve gerekçeleri

| İstat | Duyarlılık | Neden |
|---|---|---|
| AKT | 1.00 | Doğrudan "aktiflik" istatı; en duyarlı olan bu olmalı |
| AZM | 0.80 | Süreklilik istatı; bırakınca anlamını yitiriyor |
| SOS | 0.60 | Arkadaşlık kalıcı, sohbet/takım katkısı tazeliğe bağlı |
| KEŞ | 0.50 | Gezilen yer/kategori kalıcı, keşif tazelik ister |
| BİL | 0.40 | Öğrenilen bilgi büyük ölçüde kalıcı |
| KAT | 0.15 | Şehre yapılan KALICI katkı; neredeyse hiç düşmemeli |

Taban neden 0 değil: istat "şu an ne kadar aktifsin" değil, "neler
yaptın"ın aktiflikle ölçeklenmiş hâli. Sıfıra çökmek geçmişi silmek
olurdu ve geri dönen kullanıcıyı sıfırdan başlıyormuş gibi karşılardı.

### Son aktiflik

`last_activity_at` yalnızca **gerçek eylemden** türüyor: onaylı teslim,
sorun bildirimi, kanal mesajı, kabul edilmiş arkadaşlık. "Uygulamayı
açtı" bilerek sayılmıyor — yoksa decay'i durdurmak bedava olurdu.

### Uyarı bildirimi

5 gün eylemsizlikte `stat_decay` tipiyle **"Kartın soğumaya başladı!"**
/ "Bir görev tamamla, istatların düşmesin."

Eşik decay'in başladığı 7 günden **önce**: kullanıcı önleyebilsin diye.
Ceza değil hatırlatma. Spam koruması `decay_notified_at` ile 7 günde bir.
pg_cron olmadığı için tetikleyici kullanıcının uygulamayı açması; bu
yüzden zaman kontrolü şart, yoksa her sayfa yüklemesinde bildirim düşerdi.

`notifications.type` check'ine `'stat_decay'` eklendi.

### Gösterge

Kartta küçük **SOĞUYOR** rozeti — 7 günden sonra, yalnız büyük kartta,
yalnız kendi kartında. Mini kartta yok (160 px'te okunmuyor) ve arkadaş
kartında yok (başkasının aktiflik geçmişi bize ait bir bilgi değil).

### Test — `supabase/tests/stat_decay.sql`, 7/7 geçti, 0 hata

```
taze     80/49/54/86/86/56  ovr 44
20 gün   71/46/53/81/82/51  ovr 41
200 gün  36/33/50/62/67/31  ovr 30    AKT tabanda, KAT 54->50
365 gün  200 günle aynı                taban düz
rozetler 2 tane duruyor, XP 580 değişmedi
dönüş    81/49/54/86/89/56  ovr 44    anında toparladı
bildirim 0/1/1                         bir kez düştü, tekrarı engellendi
```

---

## FAZ G — Görev kartı v3

**Önceki sorun:** kart bilgi olarak doğruydu ama teşvik etmiyordu. Ödül
iki küçük hapta duruyordu, zorluk ince bir halkaydı, dokunuşun geri
bildirimi yoktu. Kullanıcı kartı okuyordu; istemiyordu.

**Tek tasarım kararı her şeyi belirledi:** ödül hapları **başlıktan önce**
geliyor. Göz kartın alt yarısına indiğinde ilk gördüğü şey "+80 XP
+50 Token". Gençleri harekete geçiren görevin adı değil, kazancı.

| Öğe | Ne değişti |
|---|---|
| Üst alan | Kategori gradyanı + parıltılı chip içinde BÜYÜK ikon |
| Zorluk | İnce halka → parlak metal kenar (`.tile-edge`) + köşe rozeti |
| Ödül | Soluk haplar → dolgun cyan/altın, kabartmalı, `+` işaretli |
| Süreli görev | Turuncu-magenta geri sayım hapı + nabız atan nokta |
| Yaklaşan | Mavi-mor YAKINDA şeridi + başlangıç geri sayımı |
| Tamamlanan | Köşe kurdelesi + çok hafif yeşil kutlama izi |
| Takım | Soluk şerit → dolgun magenta, "TAKIM · 3/4 kişi" |
| Dokunuş | `scale(0.97)` + hafif parlaklık, 110 ms |

Nabız atan nokta **yalnızca** süreli görevde. Sürekli görevde de yanıp
sönseydi aciliyet sinyali değersizleşirdi.

Kutlama izi bilerek konfeti değil: ızgarada onlarca kart varken hareketli
kutlama gürültü olurdu.

**Izgara:** `gap-3 → gap-3.5`, kartlar 45 ms adımla kademeli beliriyor
(`.tile-stagger`). Gecikme satır içi `--i` ile veriliyor — her karta ayrı
sınıf üretmek Tailwind'in tarayıcısından geçmezdi. 8 kartta tavan; daha
uzun zincir alttaki kartları "geç yükleniyor" gibi gösteriyordu.

**Boş durum:** "İlk görevini tamamla, kartını parlatmaya başla!" +
Keşfet'e CTA. Boş ekran hep bir sonraki adımı göstermeli.

Animasyonların hepsi yalnızca `opacity`/`transform`.
`prefers-reduced-motion` altında `.tile-stagger` ve nabız kapanıyor.

---

## FAZ Z — Kapanış

### Bulut

```
dry-run:  20260922000000_avatar_upload_fix.sql
          20260923000000_stat_decay.sql
push:     Applying migration ... x2, Finished
db diff:  No schema changes found
list:     her ikisi de local=remote
```

### RLS suite

`supabase/tests/rls_isolation.sql` TAM koştu. **Sayıya değil listeye
bakıldı** (D24 dersi): M27 öncesi ve sonrası ERROR listeleri `diff`'lendi.

```
M27 ONCESI: 28
M27 SONRASI: 28
diff: FARK YOK
```

### check:all

`check:types`, `check:lint`, `check:boot` — üçü de temiz.

### Canlı doğrulama (gerçek bulut oturumuyla)

Oturumsuz istek `/siralama` için 200 dönüyor ama gövde `/giris`
yönlendirme yükü (D27'de ölçülmüştü). Bu yüzden gerçek bir oturum açıldı:

```
/siralama                  200 | 73465 B | Bireysel VAR | Takım VAR
                                          | Türkiye VAR | Mahalle VAR
                                          | Arkadaşlar YOK  <-- FAZ L
/siralama?kapsam=takimlar  200 | 69211 B | Bireysel VAR | Takım VAR
                                          | Türkiye yok | Mahalle yok
                                          <-- alan çipleri takımda gizli
/profil                    200 | 115404 B
```

Bulut DB:

```
stat_decay_factor(60 gün, 1.0) = 0.625     <- yerelle birebir aynı
'stat_decay' bildirim tipi kabul: EVET
```

Oturumsuz TTFB:

```
/            200  0.85 s
/giris       200  0.71 s
/siralama    200  1.37 s
/gorevler    200  0.57 s
/kesfet      200  1.10 s
/api/health  200  0.55 s
```

Görev kartı v3 canlıda: `/gorevler` gövdesinde `reward-pill` ×28,
`tile-edge` ×14, `tile-stagger` ×14, `countdown-pill` ×4.

---

## Sapmalar

1. **FAZ A'da 100 KB sınırının yorumu.** Direktif "100 KB üstü dosya için
   'en fazla 100 KB' hata" diyordu. Ham dosyaya uygulansaydı kamerayla
   çekilen hiçbir fotoğraf yüklenemezdi; sınır sıkıştırmadan sonraki
   dosyaya uygulandı ve direktifin bir sonraki cümlesi ("sıkıştırma
   sonrası hâlâ büyükse kaliteyi düşür") bu okumayı destekliyor.

2. **FAZ D'de pg_cron seçilmedi.** Direktif "pg_cron mevcutsa" diyordu;
   eklenti bulutta açılabilir durumda ama kurulu değil. Okuma anında
   decay hem scheduler'a hiç ihtiyaç bırakmıyor hem de arkadaş kartı
   sorununu çözüyor (yukarıda). Gerekçe migration'da da yazılı.

3. **Arkadaşlar kapsamı DB'den silinmedi.** Direktif "kod olarak kalabilir
   ya da temizle — UI'dan kaldır yeter" diyordu; ana sayfadaki
   "Arkadaşlarında #N" kartı o kapsamı kullandığı için bırakıldı.

4. **Test kullanıcıları.** Yerelde ve bulutta açılan tüm test hesapları
   silindi; bulut testinde servis anahtarı Management API'den oturum
   içinde alındı, hiçbir dosyaya/log'a yazılmadı.

---

## Sabah turu — önerilen sıra

1. `/ayarlar` → gerçek bir telefon fotoğrafıyla avatar yükle. Beklenen:
   "X MB → Y KB olarak küçültüldü" + avatar değişiyor. Tarayıcı
   konsolunda hata OLMAMALI.
2. Çok büyük ve karmaşık bir görsel dene (örn. tarama/PNG). Beklenen:
   ya sığıyor ya "Görsel en fazla 100 KB olabilir."
3. `/gorevler` → kartların yeni hâli, ödül hapları, geri sayım nabzı,
   basma hissi. Bir görevi aç-kapa yap, kademeli beliriş tekrar oynamalı.
4. `/siralama` → Bireysel/Takım anahtarı, Arkadaşlar sekmesinin yokluğu,
   Takım modunda alan çiplerinin gizlenmesi.
5. `/profil` → kart. Hesap yeniyse SOĞUYOR rozeti görünmez (doğru);
   görmek için `user_stats.last_activity_at`'i elle 10 gün geriye çek.
6. `/bildirimler` → 5+ gün eylemsiz bir hesapta "Kartın soğumaya
   başladı!" bildirimi.

## Açık borçlar (devam edenler)

- `redeem_reward` DB hata mesajı hâlâ "coin" diyor; kalıcı düzeltme bir
  şema diliminde migration ister (şimdilik action katmanında çevriliyor).
- İstat taban hesabı her yazımda satır içi çalışıyor; kullanıcı sayısı
  büyürse kuyruğa taşınmalı.
- M27'nin geriye dönük doldurması `do $$ ... loop` kullanıyor; büyük
  tabloda toplu sorgu gerekir.
- `/gorevler`'de kategori filtresi yok, bu yüzden Keşfet'in kategori
  şeritlerinde "tümünü gör" derin bağlantısı da yok.
- Seviye Yolu'ndaki rozet kilometre taşları yalnızca `xp_total` kriterli
  rozetlerde çalışıyor.
- Gerçek zamanlı topluluk sohbeti (şu an 30 s yoklama).
- Supabase projesini Avrupa bölgesine taşımak, <400 ms TTFB hedefinin tek
  yolu.
- Decay için gecelik TABAN recompute (yukarıda, FAZ D borcu).
