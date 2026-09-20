# NIGHT REPORT 21 — DİLİM 40

**Kapsam:** görev görselleri yeniden — gorevler1/gorevler2 işleme, eski
setin temizlenmesi, admin galerisi, kart tasarımının teyidi.

**Commit'ler:** `9fb49d1` (A), `fb5cfe0` (T), `00e0a61` (AD),
`5624f5f` (K), bu rapor ayrı.

---

## 1. FAZ A — Görsel analiz (kesmeden ÖNCE ölçüldü)

| dosya | ölçü | ağırlık | oran |
| --- | --- | --- | --- |
| gorevler1.png | 1536 × 1024 | 2.55 MB | 1.500 |
| gorevler2.png | 1536 × 1024 | 2.47 MB | 1.500 |

### Izgara yapısı

İkisi de **5 sütun × 4 hücre**. Ve kritik bulgu: **her hücre tek görsel
değil, bir ÇİFT** — üstte yatay bir sahne, hemen altında daha geniş bir
şerit.

```
gorevler1, 1. sütun -> 4 bant  (her bant bir ÇİFT, parçalar bitişik)
gorevler2, 1. sütun -> 8 bant  (sahne ve şerit beyaz boşlukla ayrık)
```

Yani **"biri kart, diğeri kapak" DEĞİL**: iki sayfa da aynı yapıda ve
ikisi de kart+kapak çifti taşıyor. Toplam **20 + 20 = 40 çift**.

Aradaki gerçek fark içerikte: gorevler2'nin şeritlerinde beyaz bir
kategori ikonu basılı (ayakkabı, pin, kamera, kalp, nota…), gorevler1'in
şeritleri ikonsuz illüstrasyon. Bizim kartımız kendi kategori ikonunu
zaten çiziyor, yani gorevler2'nin şeritleri detay sayfasında ikinci bir
ikon gösteriyor. Sorun çıkarmıyor (detayda bizim ikonumuz yok) ama
bilinmesi gereken bir fark.

### Bir hücrenin içi nasıl bulundu

gorevler1'de parçalar bitişik olduğu için ayrım satırı ayrıca arandı.
Önce "açık piksel oranı en yüksek satır" denendi ve **elendi**: oran
hücreden hücreye %36 ile %96 arasında değişiyor, eşik seçilemiyor.
Satır-farkı tepesi kullanıldı — 20 hücrenin 20'sinde aynı satırı ±1
içinde veriyor, eşik gerektirmiyor.

Bir de kural **kaynak başına değil**: gorevler1'in 3. sütun 4.
hücresinde boşluk var, diğer 19'unda yok. Karar bant bant veriliyor.

### Parça çözünürlükleri (üretilen, yeniden boyutlandırılmamış)

| tür | genişlik | yükseklik | oran | adet | toplam |
| --- | --- | --- | --- | --- | --- |
| kart (`art-NN.webp`) | 258-271 | 130-173 | 1.49-2.07 | 40 | 644 KB |
| detay (`cover-NN.webp`) | 258-271 | 59-76 | 3.42-4.51 | 40 | 236 KB |

WebP q86. `public/task-art/` toplamı **936 KB** (manifest dâhil).

### Neden 3:4 yapılmadı

Dilim 3:4 kart görseli istiyordu. Kaynakta 3:4 parça **yok**, hepsi
yatay. Üstelik uygulamadaki kart kapağı alanı ölçüldüğünde **172 × 101
= 1.70**, yani zaten yatay. Yatay sahneyi 3:4'e kırpmak genişliğin
yarısını atmak, sonra kartta tekrar yataya kırpmak demekti — iki kez
kayıp. Parçalar kaynak oranında bırakıldı ve seçicinin kutu oranı
3:4'ten 16:10'a çekildi.

### Yeniden boyutlandırma yok

Dilim "YAPAY BÜYÜTME YOK, kaynak neyse o" diyor. Parçalar 258-271 px
arası ve birbirinden birkaç piksel farklı; tek ölçüye getirmek en
küçüğü büyütmek ya da en büyüğü küçültmek olurdu. Her parça kendi doğal
ölçüsünde yazıldı; kart ve ızgara sabit oranlı kutuya `bg-cover` ile
bastığı için düzensizlik görünmüyor.

### Köşe kırpması — bir hatam

Parçaların köşeleri yuvarlak ve köşelerde sayfa zemini (beyaz) kalıyor.
Yarıçap ölçüldü: gorevler1'de 9 px, gorevler2'de 7 px.

İlk yazımda **dört kenardan da** yarıçap kadar kırptım. Yanlıştı: beyaz
takoz yalnız `x < r` VE `y < r` bölgesinde var, yani x'i `[r, w-r]`
aralığına çekmek dört takozu da siliyor. Dikey kırpma 80 px'lik şeridin
%22'sini boşuna atıyordu (kapak boyu 45-66 px'e düşmüştü). Düzeltildi:
yatayda `r+1`, dikeyde 2 px.

**Kanıt:** 80 dosyanın 80'inde köşede zemin pikseli **0**.

### Çözünürlük dürüstlüğü — üretim kalitesinde DEĞİL

| yer | ekranda (CSS) | cihaz pikseli (3x) | kaynak | büyütme |
| --- | --- | --- | --- | --- |
| kart kapağı | 172 × 101 | 516 × 303 | ~265 × 150 | **≈1.95×** |
| detay kapağı | 358 × 144 | 1074 × 432 | ~265 × 68 | **≈4.0×** |

Kart tarafı eski setten **daha iyi**: eski 3:4 parçalar kartta dikey
kırpılıyordu ve efektif büyütme ≈2.7× idi. Detay tarafı ise **daha
kötü**: eski tek ortak kapak 781 × 238 idi (≈1.4×), yeni şeritler
265 px. Karşılığında her görev kendi konusunu gösteriyor.

Üretim ölçüleri `docs/GOREV-GORSEL-SPEC.md` içinde duruyor.

---

## 2. FAZ T — Eski set temizlendi, anahtarlar yeniden eşlendi

`public/task-art/` altında artık yalnız yeni set var: 40 kart, 40 detay
kapağı, manifest. Eski 20 parçalık set ve tek ortak `detay-kapak.webp`
silindi. Canlıda `/task-art/detay-kapak.webp` **404** veriyor, yani
gerçekten gitti.

### Kod

- `TASK_ART_KEYS` 20 → 40, ipuçları manifest'ten yeniden üretildi
- yeni `taskCoverUrl()`: `art-07` → `/task-art/cover-07.webp`
- `DEFAULT_TASK_COVER` artık `cover-01` (silinen dosyanın yerine)
- detay sayfası sırası: `image_url` → `art_key`'in detay kapağı → son
  çare. **D40'a kadar ortadaki basamak yoktu**: `image_url`'i olmayan
  her görev, konusu ne olursa olsun aynı Galata manzarasını
  gösteriyordu.

İki ayrı anahtar alanı (kart ve kapak için ayrı) tutulmadı: çift zaten
kaynakta birlikte çiziliyor; iki ayrı seçim, eşleşmeyen kart/kapak
üretme riskini karşılıksız açardı.

### M37 — neden üzerine yazıyor

M36b (D39) yalnız `art_key is null` satırlara dokunuyordu, çünkü dolu
olanlar geçerli bir görseli gösteriyordu. D40'ta kaynak tamamen
değişti: `art-01..art-20` anahtarları hâlâ geçerli ama **başka**
fotoğrafları gösteriyor (eski `art-13` "şehir turu", yeni `art-13`
"duvar resmi"). Eski değerleri korumak her kapağı rastgele bir
fotoğrafa bağlamak olurdu. 33 görevin hepsi başlığa göre yeniden
eşlendi.

```
1. koşu: 30 görev yeniden eşlendi, 0 emniyet ağı, kapaksız kalan 0
2. koşu:  0 görev yeniden eşlendi, 0 emniyet ağı, kapaksız kalan 0
```

(33 − 30 = 3 görevin eski değeri tesadüfen hedefle aynıydı.)

Emniyet ağı ayrıca anahtar aralığını da denetliyor: `art-01..art-40`
dışında bir değer kartta sessizce gradyana düşerdi.

**Kırık referans yok:** veritabanındaki 29 farklı anahtarın 29'u için
hem kart hem detay dosyası mevcut.

### Kaynakta karşılığı olmayan tek görev

"Bisikletle işe/okula git" — 40 karenin hiçbirinde bisiklet yok. En
yakın açık hava/hareket sahnesi verildi (`art-20`, dağ manzarası) ve
panelden değiştirilebilir. Yeni kaynak sayfa hazırlanırsa bir bisiklet
karesi işe yarar.

---

## 3. FAZ AD — Admin galerisi

- 20 → 40 görsel, kaydırmalı ızgara (`max-height` 280 px, içerik 1376 px)
- arama kutusu: hem anahtar hem ipucu taranıyor, Türkçe normalize
- her küçük resmin üstünde ipucu şeridi, sayaç `40/40`
- seçilen **çift** altta birlikte önizleniyor: Kart + Detay

Arama kutusu eskiden **bilerek** yoktu; kodda "yirmi görsel tek ekrana
sığıyor, arama gereksiz bir adım" yazıyordu. Gerekçe artık geçerli
değil.

Önizlemede genişlikler %36/%64 — `w/1.6 = w/2.9` denkleminin çözümü.
Yarı yarıya bölünce kart iki kat uzun düşüyor ve detayın yanı boş
kalıyordu.

### Kanıt (panelde ölçüldü)

```
görselli seçenek 40 + "Görsel yok" kutusu = 41
ızgara overflow-y auto, kaydırma gerekiyor: evet
kutu oranı 1.60

arama "fidan" -> 2/40   (art-06, art-34)
arama "müze"  -> 2/40   (art-10, art-32)
arama "art-3" -> 10/40
arama "zzz"   -> 0/40

art-31 seçildi -> önizleme art-31.webp + cover-31.webp
                  etiketler "Kart" / "Detay", oranlar 1.60 / 2.90

"Güncelle" -> "Görev kaydedildi." -> DB art_key: art-09 -> art-31
```

Ölçüm için geçici bir belediye ve yetki oluşturuldu; panel yalnızca
kendi belediyesinin görevini kaydettiği için görev de geçici olarak o
belediyeye bağlandı. Hepsi geri alındı: `art_key` art-09,
`municipality_id` null, kalan belediye 0, kullanıcının yetkisi 0.

---

## 4. FAZ K — Kart tasarımı teyit

D39'un kararı aynen duruyor: kapak arkada, kategori ikonu kapak
alanının **tam ortasında 58 × 58** chip içinde, araya okunurluk perdesi.

Perdenin merkezi **%42 → %52** çıkarıldı. Yeni sette üç kapak (art-02
park, art-07 sahil, art-25 broşür) ikonun tam arkasında açık
gökyüzü/deniz taşıyor ve beyaz ikon kontrastı 4.01-4.32:1'e
düşüyordu. +%10, en kötü kareyi 4.5 eşiğinin üstüne çıkaran en küçük
artış; daha fazlası bütün kapakları gereksiz söndürürdü.

### Kanıt — 6 kategori, 32 kart

```
chip boyutu 58x58 olmayan       : 0
merkezden sapan (x,y != 0,0)    : 0
perdesiz kapaklı kart           : 0
beyaz ikon kontrastı eşik altı  : 0
en düşük 4.78:1  |  ortalama 6.03:1
```

Canlı üretim CSS'inde kural:
`radial-gradient(circle,#00000085 0%,…)` — `0x85` = %52, yani
değişiklik yayında.

---

## 5. Ölçüm hatalarım (üçü de düzeltildi)

1. **Ayrım satırı sinyali yanlış seçilmişti.** "Açık piksel oranı"
   hücreye göre %36-%96 arasında değişiyor; eşik seçilemez. Satır-farkı
   tepesine geçildi.

2. **Köşe kırpmasını dört kenardan yaptım.** Yuvarlak köşe için yatay
   kırpma yeter; dikey kırpma şeritlerin %22'sini boşuna atıyordu.

3. **Kontrast ölçümünde kartları görünüme kaydırmamıştım.** Görünüm
   dışındaki kartlarda ekran kırpması sayfa zeminini yakalayıp
   18.72:1 gibi **sahte yüksek** değerler üretti. İkinci turda her kart
   ortalanıyor ve "görünür mü" ayrıca doğrulanıyor (32/32 görünür).

Bir de ölçüm betiğimde kaçış hatası vardı: `\s` `s`'e dönüşmüş ve
`replace(/s+/g, ' ')` sayfa metnindeki bütün küçük `s` harflerini
siliyordu ("Moderasyon" → "Modera yon"). Ürün değil, çıktı hatasıydı.

---

## 6. Kontroller

```
check:all        temiz (çıkış 0) — dört fazda da
SQL testleri     79 GECTI / 0 HATA — D38 ve D39 ile birebir aynı
sessiz dosya     rls_isolation.sql (bilinen borç, yeni değil)
```

Dosya başına: daily_spotlight 8, leaderboard_rewards 8,
province_community_audit 12, referrals 11, rls_isolation 0, seasons 7,
stat_decay 7, task_chains 8, task_day_window 10,
team_leaderboard_scope 8.

### Bulut

```
db push --dry-run -> "Would push: 20261005000000_task_art_remap.sql"
db push           -> "Applying migration 20261005000000_task_art_remap.sql"
db push --dry-run -> {"upToDate":true,"migrations":[]}
```

### Canlı

11 yolun 11'i 200: `/` `/karsilama` `/giris` `/gorevler` `/siralama`
`/kesfet` `/profil` `/oduller` `/zincirler` `/topluluk` `/panel`.

Görseller 200: `art-01.webp` (14.1 KB), `art-40.webp` (13.5 KB),
`cover-01.webp` (6.1 KB), `cover-31.webp` (4.6 KB), `manifest.json`.
Silinen `detay-kapak.webp` **404**.

`/gorevler` HTML'i yeni kapakları referans veriyor (art-01, art-02,
art-05, art-06, art-07 ×4, art-08, art-09, art-10 …). Açılan bir görev
detayı `cover-22.webp` çiziyor, yani kart-detay eşleşmesi canlıda
çalışıyor.

### Boyut (Vercel / git)

```
public/task-art   936 KB  (80 webp + manifest)
public/brand       11 MB  (kaynak kontakt sayfaları + logo + giriş)
.git               18 MB  |  size-pack 10.96 MiB
```

En büyük izlenen dosyalar: `gorevler1.png` 2.6 MB, `gorevler2.png`
2.5 MB, `gorevler.png` 2.2 MB, `giris.png` 2.2 MB,
`docs/design/mockup3.png` 1.8 MB. GitHub'ın dosya başına 50 MB uyarı
eşiğinin ve Vercel'in dağıtım sınırlarının çok altında.

---

## 7. Test listesi

**Çift bütünlüğü** — her `art_key` için hem `art-NN.webp` hem
`cover-NN.webp` bulunmalı; biri eksikse kart ya da detay sessizce
gradyana düşer ve kimse fark etmez; kanıt: DB'deki her farklı anahtar
için iki dosyanın varlığı (29/29).

**Anahtar aralığı** — `art_key` yalnız `art-01..art-40` olmalı; kaynak
set değişince eski aralık geçerli görünüp yanlış fotoğrafı gösterir;
kanıt: M37'nin `!~ '^art-(0[1-9]|[1-3][0-9]|40)$'` emniyet ağı ve
kapaksız kalan sayısının 0 olması.

**İkon okunurluğu** — kapak fotoğrafı ne olursa olsun beyaz ikonun
kontrastı 4.5:1'i geçmeli; yeni bir kaynak seti gelince açık gökyüzü
taşıyan kareler eşiğin altına düşer; kanıt: kartları görünüme
kaydırarak alınan, kart başına zemin örneklemeli kontrast tablosu.

---

## 8. Sabah turu — proje sahibinin bakması gerekenler

1. **Kapak eşlemeleri.** 33 görevin kapağı anlamına göre atandı ama
   bu benim yorumum. Panelden her görevin kapağına bakıp
   beğenmediğinizi değiştirin — seçici artık 40 görseli arayarak
   gösteriyor.

2. **"Bisikletle işe/okula git"** kaynakta karşılığı olmayan tek görev.

3. **Detay kapağı çözünürlüğü düştü** (≈4× büyütme). Kart tarafı
   iyileşti, detay tarafı kötüleşti. Karşılığında her görev kendi
   konusunu gösteriyor. Kabul edilebilir mi, yoksa detay için ayrı ve
   geniş bir kaynak sayfa mı hazırlanmalı?

4. **Veritabanı şifresi hâlâ bekliyor** (aşağıda).

---

## 9. Devreden borçlar

1. **VERİTABANI ŞİFRESİ — hâlâ bekliyor.** Bu dilimde yeni şifre
   gelmediği için eski şifreyle push edildi. Açık şifre git geçmişinde
   yedi ayrı sürümde duruyor (`docs/NIGHT-REPORT-2.md`, 2026-09-14
   tarihli commit'ler; çalışma ağacındaki sürümde maskeli). Depo
   GitHub'da. Rotasyon: Supabase Dashboard → Project Settings →
   Database → Reset database password, ardından Vercel ortam
   değişkenleri.

2. **Görsel çözünürlüğü.** Kart ≈1.95×, detay ≈4.0× büyütülüyor.
   Üretim ölçüleri `docs/GOREV-GORSEL-SPEC.md` içinde.

3. **Kontakt sayfaları `public/` altında.** `gorevler.png` (2.2 MB)
   artık hiçbir yerde kullanılmıyor; `gorevler1/2.png` yalnız derleme
   öncesi kesim kaynağı. Üçü de herkese açık servis ediliyor ve 7.3 MB
   yer tutuyor. `public/` dışına (örn. `assets/brand-source/`) taşımak
   dağıtımı hafifletir — kapsam dışı olduğu için dokunulmadı.

4. **gorevler2'nin detay şeritlerinde gömülü kategori ikonu var.**
   Şimdilik sorun değil (detayda kendi ikonumuzu çizmiyoruz) ama
   ileride detay sayfasına ikon eklenirse çakışır.

5. **Kapaksız kartta ikon kontrastı 2.32:1** (açık mavi kategori
   gradyanı üstünde beyaz ikon). Artık her görevin kapağı olduğu için
   yalnız yönetici "Görsel yok" seçerse görünür.

6. **`rls_isolation.sql` makine ile denetlenen iddia üretmiyor.**

7. **`docs/PROFIL-ONERI.md` kararı bekliyor** (A–E, öneri C sonra A).

8. Önceki dilimlerden devam edenler: ölü `TaskCard` /
   `task-card-compact.tsx`, ölü `listDiscoverTasks`, `ReportCta` sabit
   ödül metni, davet kötüye kullanım önlemi yok, belediye zincirleri
   yok, 52 ham `<button>`, rozet kutlaması madalyonlarda değil ve
   rozet adı eksik, SQL kaynaklı yazımlarda push yok, `redeem_reward`
   "coin" diyor, yönetici araması kapalı, `(user)/loading.tsx` yedi
   segmente ana sayfa iskeleti veriyor, sezon ödüllerinde tembel yol
   yok, panel koyu temaya geçerse `app-header.tsx` logosu koyu üstünde
   koyu kalır.
