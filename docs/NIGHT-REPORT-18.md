# Gece Raporu 18 — DİLİM 37

**Küçük kapatmalar: trend "ilk gün" işareti + panel görev bölge alanı**

Commit'ler: `300af7e` (T), `cf10d53` (P), bu rapor (Z).

Dar kapsamlı bir dilimdi ama iki gizli hata ortaya çıkardı: biri kendi
yaptığım değişikliğin içinde (sunucuda istemci modülü yayma), biri üç
dilimdir sessizce duran bir test (`'year'` dönemi). İkisi de aşağıda.

Yeni migration YOK — M35c ile gelen sütunlar zaten yerindeydi.

---

## 1. FAZ T — trend okunun "ilk gün" durumu

### Ölçülen sorun

D37 teşhisinde bulutta `rank_snapshots` tablosunda ftkaynar için yalnız
**bugünün 3 satırı** vardı, önceki günden **0**. Karşılaştırılacak dün
olmadığı için `rank_trends()` üç kapsam için de `'none'` döndürüyor,
`TrendArrow` da `null` basıyordu. Üç kartın yanı bomboştu ve proje
sahibi özelliği "yapılmamış" sandı.

Mantık doğruydu ("nötr bir çizgi 'değişmedi' demek olur, oysa
bilinmiyor") ama sonucu yanlıştı: **sessizlik "bilinmiyor"u
anlatmıyor.**

### Yapılan

- `'none'` artık nötr gri tire (`.trend-pending`, opaklık 0.55) + ekran
  okuyucu metni. Üç yönden daha silik: aynı ağırlıkta çizmek denendi ve
  elendi, gri tire sarı eşittir işaretiyle karışıp "dün de aynıydı"
  gibi okunuyordu.
- Açıklama blok ALTINDA tek satır: *"Bugünkü sıran kaydedildi. Trend
  okları yarın başlıyor."* Tire'nin `title` ipucu masaüstünde çalışıyor
  ama bu mobil bir uygulama, dokunmatikte hover yok. Kart başına yazmak
  denendi ve elendi — 390px'te üç sütunlu ritmi bozuyor ve aynı cümleyi
  üç kez okutuyordu. Yalnız sırası OLAN ve hepsi `'none'` olan durumda
  çıkıyor; bir kapsamda bile ok varsa mekanizma görünür biçimde
  çalışıyor demektir.
- `up` / `down` / `same` görünümleri aynen korundu.

### Yol boyunca bulunan metin hatası

Ok metni "Düne göre yükseldi" diyordu. Ama `rank_trends()` önceki kaydı
şöyle alıyor:

```sql
where s.day < v_today order by s.day desc limit 1
```

Kullanıcı birkaç gün uygulamayı açmazsa o gün için snapshot yazılmıyor
ve karşılaştırma beş gün öncesiyle yapılıyor — metin yalan söylüyordu.
**"Önceki kayda göre"** oldu; her iki durumda da doğru. Gün farkını
göstermek `RETURNS TABLE` imzasını değiştirmeyi gerektirirdi, bu dilim
için gereğinden büyük bir değişiklik.

### Snapshot beslemesi doğrulandı

pg_cron'da bu iş **yok** — bulutta üç job var (`daily-spotlight`,
`leaderboard-settle`, `season-settle`), üçü de başka. Tek yazan yer
`rank_trends()` ve onu çağıran tek yer ana sayfa render'ı. Yani
mekanizma "okurken yaz" ve kendini besliyor.

Ölçüm:

| adım | sonuç |
| --- | --- |
| ilk ziyaret | bugünün 3 satırı yazıldı |
| aynı gün ikinci ziyaret | hâlâ 3 satır (birincil anahtar kapısı) |
| dün satırları eklendi | toplam 6, oklar çıktı, ilk gün açıklaması kayboldu |

### Dört durumun dördü de ölçüldü

| durum | görünen |
| --- | --- |
| ilk gün | gri tire + "Trend okları yarın başlıyor." |
| yükseldi | yeşil yukarı ok, "Önceki kayda göre yükseldi" |
| düştü | kırmızı aşağı ok, "Önceki kayda göre düştü" |
| değişmedi | sarı eşittir, "Önceki kayda göre değişmedi" |

---

## 2. FAZ P — panel/admin görev formunda il + ilçe

### Ölçülen borç

`tasks.province_id` / `district_id` M35c ile geldi ve keşfet konum
filtresi bunları okuyor, ama **formda alan yoktu**. Personelin açtığı
her yeni görev bölgesiz kalıyor ve hiçbir bölge seçiminde
görünmüyordu.

### Yapılan

- İl seçici (81 il + "Bölgesiz") + ilçeyle kademeli seçici. İller
  sunucudan (referans önbelleği), **ilçeler istemcide**: 973 ilçenin
  tamamını her form açılışında göndermek, kullanıcının yalnız birini
  seçeceği bir liste için gereksiz yüktü. İl değişince ilçe olay
  işleyicisinde temizleniyor (effect'te değil — aynı kural onboarding
  formunda da yazılı).
- **Panelde ön dolu ama KİLİTLİ DEĞİL.** Varsayılan personelin
  belediyesinin il/ilçesi. Kilitlemek denendi ve elendi: (1) büyükşehir
  belediyesi il genelinde iş açıyor ve tek ilçeye hapsedilemez,
  (2) iki ilçenin ortak etkinliği (kıyı temizliği, bölgeler arası
  turnuva) komşu ilçeye yazılmak zorunda. Belediye bağlama
  (`municipality_id`) zaten sunucuda ve değiştirilemiyor; bölge ise
  görevin NEREDE yapıldığını söylüyor, kimin açtığını değil.
- Admin'de serbest, ön dolu yok.
- **Konum doğrulamalı görevde il artık zorunlu.** Koordinatı olup
  bölgesi olmayan görev haritada görünüyor ama "Kadıköy" seçilince
  kayboluyordu — kullanıcı açısından tutarsız. Koordinatı olmayan
  görevlerde (quiz, düz fotoğraf) isteğe bağlı: onların bir yeri yok ve
  zorlamak personeli uydurmaya iterdi.
- `lat` / `lng` / `radius_m`, konum etiketi ve kurum alanları zaten
  formda vardı; dokunulmadı.
- Düzenleme formu da bölgeyi okuyor (şema koruma katmanına eklendi).

### Yol boyunca bulunan ve düzeltilen hata

İlk sürümde panel sayfası şunu yazıyordu:

```tsx
<TaskForm initial={{ ...EMPTY_TASK, ...area }} ... />
```

`EMPTY_TASK` bir `"use client"` modülünden geliyor ve **sunucu
tarafında gerçek nesne değil istemci referansı**. Yayılınca bütün
alanlar kayboluyor; forma yalnız kullanıcının elle doldurduğu alanlar
kalıyor ve `saveTaskAction` `input.xp` undefined ile çöküyordu.

Ekranda **hiçbir mesaj çıkmıyordu** — sunucu eylemi istisna fırlatınca
`save()` içindeki `try` bloğu hata da bildirim de yazamıyor. Kayıt
sessizce başarısız oluyordu. Dev log'da:

```
⨯ TypeError: Cannot read properties of undefined (reading 'trim')
    at saveTaskAction (src\lib\panel\task-actions.ts:91:14)
    └─ ƒ saveTaskAction({"categoryId":"1","description":"...",
       "districtId":"1421","...":"7 items not stringified"})
```

"7 items not stringified" ipucuydu: nesnede ~10 anahtar vardı, oysa
`TaskFormValues` yirmi beşten fazla alan taşıyor.

Düzeltme: birleştirme istemciye taşındı — `initial={EMPTY_TASK}` +
`defaultArea={area}`, `useState` içinde birleştiriliyor. Prop olarak
geçilen `EMPTY_TASK` istemcide doğru çözülüyor.

Ayırt eden ölçüm: aynı akış **admin** sayfasında çalışıyordu (orada
spread yok), panelde çökmüyordu — fark tek satırdaydı.

### Uçtan uca kanıt

```
panel formu   82 il seçeneği, İstanbul ÖN DOLU, 39 İstanbul ilçesi
kaydet        "Görev kaydedildi."
psql          il=İstanbul ilce=Kadıköy lat=40.9880
              etiket="Olcum Parki, Kadikoy" durum=active
keşfet        Kadıköy sayacı 6 -> 7
              görev Kadıköy filtresinde GÖRÜNÜYOR
              görev Beşiktaş filtresinde GÖRÜNMÜYOR
```

---

## 3. Test sonuçları — ve üç dilimdir gizli duran bir hata

```
--- SIRALI HATA LISTESI ---
(boş)
--- SAYILAR ---
HATA: 0
GECTI: 79
ERROR: 33
```

D36'da **64** GEÇTİ raporlamıştım. Şimdi 79. Fark bir iyileştirme değil,
**D36 raporumun eksikliğiydi.**

### Ne oldu

Dosya başına iddia sayısını ilk kez bu dilimde saydım:

| dosya | D36 | D37 |
| --- | --- | --- |
| stat_decay.sql | **0** | 7 |
| team_leaderboard_scope.sql | **0** | 8 |
| diğer sekiz dosya | aynı | aynı |

**`team_leaderboard_scope.sql` üç dilimdir koşmuyordu.** İçinde
`leaderboard_teams('year', 'turkiye')` çağrısı vardı; `'year'` dönemini
D35 FAZ SZ'de (M34c) ben kaldırdım. Fonksiyon `'Geçersiz dönem.'` raise
ediyor, işlem abort oluyor ve dosyanın **15 iddiasının hiçbiri
koşmuyor**.

**`stat_decay.sql` ise D36 koşusunda** ilk insert'te
`task_submissions_open_unique` çakışmasına düşüp abort etmişti — yerel
veritabanında o sırada açık bir teslim satırı duruyordu (D36 FAZ TK
ölçümünden kalma). D37'de veritabanı temiz olduğu için tamamı koştu.

### Neden fark etmedim

Kuralım "sayıya değil sıralı HATA listesine bak" idi ve buna uydum.
Ama **abort eden bir test ne GECTI ne HATA satırı üretiyor** — yani ne
sayaca ne listeye giriyor. İki koşu arasında listeyi diff'lemek de
yetmedi, çünkü iki koşuda da aynı boşluk vardı.

D35 ve D36 raporlarında yazdığım "0 HATA / 64 GEÇTİ" rakamları yanlış
değildi ama **eksikti**: koşan testlerin hepsi geçiyordu, koşmayanları
saymıyordum.

### Düzeltme

- `team_leaderboard_scope.sql` içindeki `'year'` → `'all'`. Senaryonun
  iddiası "dönem parametresi sonucu değiştiriyor" ve `'all'` bunu
  veriden bağımsız kanıtlıyor. `'season'` denendi ve elendi: aktif
  sezon penceresine bağlı kalırdı ve o pencere zaten
  `leaderboard_rewards.sql` senaryo 7-8'de sınanıyor. Sekiz iddianın
  sekizi de geçiyor.
- Test koşum betiğine **"sessiz dosya" uyarısı** eklendi: her dosyanın
  gerçekten iddia ürettiği ayrıca yazdırılıyor.

### Kalan tek sessiz dosya

`rls_isolation.sql` 0 iddia gösteriyor ama **abort etmiyor** — sonuna
kadar koşuyor (121 sayı/beklenti satırı, `ROLLBACK`'e ulaşıyor).
Tasarımı farklı: GECTI/HATA satırı yerine ham sayı basıp yanına
`\echo '(1 olmali)'` yazıyor, yani beklentiyi **insan** karşılaştırıyor.
Makine kontrolü yok. Borç olarak yazıldı.

`pnpm check:all` (types + lint + build): temiz.

---

## 4. Bulut

Yeni migration yok; M35c sütunları zaten yerinde.

```
supabase db push --dry-run
{"upToDate":true,"migrations":[],"message":"Remote database is up to date."}
```

### ⚠ Veritabanı şifresi hâlâ rotasyon bekliyor

Bu dilimde de D33'te verilen eski şifre çalıştı. `docs/NIGHT-REPORT-2.md`
geçmişinde duran değer hâlâ geçerli. D36 raporunda da yazmıştım;
tekrar ediyorum çünkü değişmedi:

Supabase Dashboard → Project Settings → Database → Reset database
password. Sonra Vercel ortam değişkenleri güncellenmeli.

---

## 5. Canlı kontroller

`https://genclig.vercel.app` (commit `cf10d53`):

| yol | durum |
| --- | --- |
| `/` · `/karsilama` · `/giris` · `/kayit` | 200 |
| `/kesfet` · `/gorevler` · `/siralama` | 200 |
| `/zincirler` · `/profil` · `/oduller` | 200 |
| `/panel/gorevler/yeni` | 200 |
| `/admin/gorevler/yeni` | 200 |

Üretim CSS paketinde `trend-pending` sınıfı var — FAZ T dağıtıldı.

Oturumlu canlı ekranlar yine üretimde doğrulanmadı (bulut anon anahtarı
anonim indirilebilen paketlerde yok; D36'da da böyleydi). Aynı commit
yerelde oturumlu ölçüldü.

---

## 6. Sabah turu

1. **Ana sayfa "Sıralaman"**: üç sayının yanında gri tire ve altında
   "Bugünkü sıran kaydedildi. Trend okları yarın başlıyor." **Yarın**
   aynı ekranda gri tirelerin yerinde renkli oklar olmalı.
2. **Panel → Yeni görev**: İl alanı belediyenizin iliyle dolu gelsin,
   ilçe seçilebilir olsun. İkisini de değiştirebildiğinizi görün.
3. Doğrulamayı "Konum" yapın ve il'i "Bölgesiz"e çekin — kaydet
   dediğinizde *"Konum doğrulamalı görevde il seçmelisin."* uyarısı
   çıkmalı.
4. Bir görev oluşturup **Keşfet**'e gidin, bölge seçicide o ilçeyi
   seçin: göreviniz listede olmalı, başka ilçede olmamalı.
5. **Admin → Yeni global görev**: il alanı boş ("Bölgesiz") gelmeli.

---

## 7. Borçlar

**Acil:** veritabanı şifresi hâlâ sıfırlanmadı (bkz. bölüm 4).

**Bu dilimden:**

- `rls_isolation.sql` makine kontrollü iddia üretmiyor; beklentileri
  `\echo` ile insanın okumasına bırakıyor. Diğer dokuz dosyanın
  biçimine çevrilmeli.
- Trend karşılaştırması gün farkını göstermiyor. Metin artık doğru
  ("Önceki kayda göre") ama "3 gün önceye göre" demek daha bilgilendirici
  olurdu; `rank_trends()` imzasına gün alanı eklemek gerekiyor.
- Görev formunda il/ilçe var ama **mevcut 16 bölgesiz görev** hâlâ
  bölgesiz (koordinatı olmayan quiz/fotoğraf görevleri). Bu doğru:
  yeri olmayan göreve yer yazmadık.

**Devam edenler:** ölü `TaskCard` / `task-card-compact.tsx`;
`ReportCta` ödül metni koda gömülü; davet kötüye kullanım önlemi yok;
belediye zincirleri yok; 52 ham `<button>`; rozet kutlaması madalyaya
geçmedi ve rozet adını göstermiyor; SQL kaynaklı yazımlardan push
gitmiyor; `redeem_reward` DB mesajı "coin" diyor; yönetim arama kutusu
devre dışı; `rls_isolation.sql` yerel veritabanında satır bırakıyor;
`(user)/loading.tsx` ana sayfa şeklinde bir iskeleti yedi segmente
servis ediyor; sezon ödüllerinin tembel yolu yok; panel/admin koyu
temaya alınırsa `app-header.tsx` logosu koyu zeminde koyu kalıyor.
