# NIGHT REPORT 20 — DİLİM 39

**Kapsam:** iki düzeltme (kapaksız görevlere kapak atama, kart ikonunun
yeniden tasarımı) + FAZ G (giriş görseli netleştirme).

**Commit:** `cb888fa` (D39a), `51a1004` (D39b), bu rapor ayrı.

---

## 1. FAZ 1 — Kapaksız görevlere kart kapağı (M36b)

### Sorun

D38 FAZ GK kontakt sayfasını 20 kart kapağına ayırdı, ama kapakları
görevlere ATAMADI. Yayındaki 32 görevin 25'inde `art_key` vardı
(M34'teki 24 görev + 1); ilk migration'dan
(`20260914000000_tasks.sql`) gelen 7 görev kapaksız kaldı.

Kapaksız kart yer tutucuyla çiziliyor: kategori gradyanı üstünde
çerçeveli büyük ikon. Proje sahibi bunu "ikon ve çerçeve kapak
fotoğrafı olan kartlar" diye bildirdi — doğru tespit, benim
atlamamdı.

### Eşleme

Kapak, görevin KATEGORİSİNE değil FİİLEN NE YAPTIRDIĞINA göre seçildi:

| görev | kapak | gerekçe |
| --- | --- | --- |
| Belediye tarih müzesini ziyaret et | art-14 | müze içi, büst |
| Takımca kültür noktası keşfedin | art-13 | şehir turu, Galata |
| Sahil temizliğine katıl | art-07 | eldivenli el, atık toplama |
| Takımınla sahil temizliğine katılın | art-07 | aynı işin takım sürümü |
| STK buluşması: sahilde fidan dikimi | art-01 | grupça fidan dikimi |
| Bir parkı ziyaret et | art-09 | park, yeşil alan (kullanılmamış anahtar) |
| Parkta 7.500 adım at | art-03 | hareket / koşu |

**Denenen ve elenen:** sahil temizliğinin takım sürümüne farklı bir
kapak vermek (art-08 "dayanışma"). Elendi — ikisi aynı işin bireysel
ve takım sürümü; aynı kapak bunu doğru anlatıyor, takım ayrımını kart
zaten pembe "TAKIM · 0/2 KİŞİ" kurdelesiyle yapıyor.

### Kanıt

```
=== 1. KOSU ===
NOTICE:  M36b: 7 göreve kapak atandı
DO

=== 2. KOSU (idempotence kaniti) ===
NOTICE:  M36b: 0 göreve kapak atandı
```

İkinci koşunun 0 yazması `where art_key is null` koşulunun çalıştığını
gösteriyor: panelden kapak seçilmiş bir görev bu migration'dan
etkilenmiyor.

```
SONRA: art_key null sayisi        -> draft|1
yayindaki kapaksiz gorev          -> 0
```

Taslak görev ("Taslak görev (yayında değil)") bilerek kapaksız
bırakıldı — "Görsel yok" yolunun canlı bir örneği kalsın.

### Yan bulgu: yerel migration defterinde sapma

`supabase_migrations.schema_migrations` 45 kayıt tutuyordu ama diskte
48 migration dosyası vardı. D38'de üç migration `psql` ile doğrudan
uygulanmış, deftere yazılmamıştı. Üçünün de gerçekten uygulandığı
şemadan doğrulandı (`rank_snapshots` tablosu var, `tasks.province_id`
var, `type` CHECK'i iki değerli), sonra kayıtları eklendi.

Sonuç: **dosya 49, kayıt 49.**

---

## 2. FAZ 2 — Kart ikonu: kapak üstünde de ortalı ve tam boyut

### Geri alınan karar

D38'de kapaklı kartta ikon 32px'e küçültülüp sağ alta çekilmişti. Bu
dilimin ilk turunda onu tamamen kaldırdım. **İkisi de yanlıştı** ve
ikisi de geri alındı. Proje sahibinin istediği tasarım: ikon kapak
olsa da olmasa da AYNI yerde, AYNI boyutta.

### Yeni yapı

```
kapak alanı (h-44%, items-center justify-center)
├── kapak fotoğrafı      absolute inset-0, bg-cover bg-center
├── .tile-art-scrim      absolute inset-0, okunurluk perdesi
└── .tile-chip           relative 58×58, ORTADA — ikon burada
```

Perde iki katmanlı:

- **radyal** (%42 → %34 → %10 → %0): ikonun oturduğu daireyi
  koyulaştırıyor
- **dikey** (%26 → %4 → %22): üst köşedeki zorluk rozeti ile alttaki
  vitrin kurdelesinin zeminini topluyor

**Denenen ve elenen:** düz `bg-black/35`. Elendi — fotoğrafın tamamını
eşit söndürüyordu, kapak koymanın anlamı kalmıyordu. Perdenin ağırlığı
ikonun olduğu yerde toplanıyor.

Sağ-alt cam ikonu kalıcı olarak kaldırıldı.

### Kanıt — kapaklı ve kapaksız kart yan yana

Ölçüm için bir görevin `art_key`'i geçici olarak `null` yapıldı,
ölçüm sonrası geri alındı (çıktıda doğrulandı).

```
[KAPAKLI ]  kapak alani 172x101 | perde: var
            chip boyut 58x58
            merkez sapma: x 0 px, y 0 px

[KAPAKSIZ]  kapak alani 172x101 | perde: yok
            chip boyut 58x58
            merkez sapma: x 0 px, y 0 px

[KAPAKLI ] chip arkasi ortalama rgb 104,96,72  -> beyaz ikon 6.24:1
[KAPAKSIZ] chip arkasi ortalama rgb 112,174,242 -> beyaz ikon 2.32:1
```

İkonun konumu ve boyutu iki kartta birebir aynı; tek fark arka plandaki
fotoğraf. Ekran görüntüsü de bunu doğruluyor.

**Not (kapsam dışı):** kapaksız karttaki 2.32:1 beni değil, açık mavi
kategori gradyanını ilgilendiriyor ve D39 ÖNCESİNDEN geliyor — bu
dilimde dokunulmadı. Kapaklı kart artık kapaksızdan daha okunur.

---

## 3. FAZ G — Giriş görseli

### Ölçü

`public/brand/giris.png` — **941 × 1672 px**, PNG, **2.12 MB**.

En-boy 0.563 (≈9:16). 390px genişlikte 3x ekran 1170px istiyor;
kaynak 941px. Yani giriş görseli de üretim çözünürlüğünün altında —
görev kapaklarındaki aynı borç (bkz. `docs/GOREV-GORSEL-SPEC.md`).
`next/image` `quality={82}` ile WEBP'e çeviriyor.

### Sorun

Fotoğraf perdelerin altında görünmüyordu:

- form ekranlarında tüm görsele `blur-sm` + `scale-105`
- her ekranda `bg-brand/25` genel karartma
- üst perde `h-2/5`, %85 → %45
- alt perde `h-3/5`, opak → %75

Sonuç: İstanbul manzarası tanınmaz bir renk lekesiydi.

### Değişiklik

| katman | önce | sonra |
| --- | --- | --- |
| form ekranı bulanıklığı | `blur-sm scale-105` | **kaldırıldı** |
| genel karartma | `bg-brand/25` | `bg-brand/10` |
| üst perde | `h-2/5` %85/%45 | `h-2/5` %62/%24 |
| alt perde | `h-3/5` opak/%75 | `h-1/2` %86/%38 |
| next/image kalite | 72 | 82 |

Bulanıklık gereksizdi: `.auth-card` zaten
`backdrop-filter: blur(18px) saturate(1.3)` taşıyor, yani kartın
ARKASINI bulanıklaştırıyor. Tüm fotoğrafı ayrıca bulanıklaştırmak
yalnız kartın DIŞINI — manzaranın görünen tek kısmını — söndürüyordu.

Karşılama sloganı `text-white/80` → `text-white`. Perde incelince o
satır gökyüzünün en parlak yerine denk gelip 3.21:1'e düşüyordu.
Metni parlatmak perdeyi koyulaştırmaktan ucuz: fotoğraf net kalıyor.

### Kanıt — WCAG kontrast

Yöntem: metin `visibility:hidden` yapılıp ekran görüntüsü alınıyor,
metnin kutusundaki piksellerin ortalaması zemin kabul ediliyor, metin
rengi alfasıyla zemine kompozit ediliyor.

**Karşılama** (eşik: 36px/20px başlıklar 3.0, gerisi 4.5)

```
GECTI  3.68:1  36px  "GençLİG"
GECTI  4.69:1  14px  "Şehrini değiştir, kartını parlat."
GECTI 18.29:1  16px  "Hemen Başla"
GECTI 19.20:1  16px  "Giriş Yap"
```

**Giriş**

```
GECTI  4.14:1  20px  "GençLİG"
GECTI  7.70:1  18px  "Giriş yap"
GECTI  4.96:1  14px  "Hesabınla devam et."
GECTI  8.68:1  14px  "E-posta"
GECTI 12.10:1  14px  "Şifre"
GECTI  6.07:1  14px  "Hesap aç"
```

Slogandaki 4.69:1, eşiğin (4.5) hemen üstünde — istenen "okunurluğun
izin verdiği minimum karartma" tam olarak bu.

### Ölçüm hatası — düzeltildi

İlk turda metin rengini `getComputedStyle(el).color` çıktısından
regex ile ayrıştırdım. **Tailwind 4 rengi `oklab()` olarak
döndürüyor**; `[\d.]+` yakalayıcısı `oklab(1 0 0 / 0.8)` üzerinde
`[1, 0, 0, 0.8]` üretti ve kontrast sayıları tamamen saçmaydı. O turda
"KALDI" görünen satırların hepsi geçersizdi.

Renk artık sayfa içinde canvas'a boyanıp piksel olarak okunuyor.
Fonksiyon bilinen referanslarla doğrulandı: beyaz/siyah **21.00**,
beyaz/#767676 **4.54**.

Düzeltilmiş ölçekle önceki sürüm de ölçüldü — slogan ÖNCE 5.37:1 idi,
ilk denememde 3.21:1'e düşmüştü. Yani gerçek bir gerilemeydi ve
düzeltildi (4.69:1).

---

## 4. Kontroller

```
check:all                 temiz (çıkış 0)
SQL testleri              79 GECTI / 0 HATA — D38 ile birebir aynı
sessiz dosya              rls_isolation.sql (bilinen borç, yeni değil)
```

Test dosyası başına: daily_spotlight 8, leaderboard_rewards 8,
province_community_audit 12, referrals 11, rls_isolation 0, seasons 7,
stat_decay 7, task_chains 8, task_day_window 10,
team_leaderboard_scope 8.

### Bulut

```
db push --dry-run   -> "Would push: 20261004000000_task_art_backfill.sql"
db push             -> "Applying migration 20261004000000_task_art_backfill.sql"
db push --dry-run   -> {"upToDate":true,"migrations":[]}
```

Son kuru provanın boş dönmesi bulutun migration'ı kaydettiğini
gösteriyor.

Buluttaki satır sayılarını doğrudan sorgulamak istedim; uzak veritabanına
psql bağlantısı izin katmanınca engellendi. Bu yüzden bulut kanıtı CLI'ın
kendi çıktısıyla sınırlı.

### Canlı

11 yolun 11'i 200: `/` `/karsilama` `/giris` `/kayit` `/gorevler`
`/siralama` `/kesfet` `/profil` `/oduller` `/zincirler` `/topluluk`.

Görseller 200: `/brand/giris.png`, `/task-art/art-09.webp`,
`/task-art/art-14.webp`, `/task-art/detay-kapak.webp`.

Üretim CSS'inde `tile-art-scrim` var. `/giris` HTML'inde `blur-sm` ve
`scale-105` **yok** — yeni sürüm yayında.

**Düzeltme:** ilk canlı taramada `/odul-magazasi` yazıp 404 aldım; öyle
bir yol hiç olmadı, doğrusu `/oduller` ve o 200 dönüyor. Ürün hatası
değil, benim yazım hatam.

---

## 5. Test listesi

**Kapak bütünlüğü** — yayındaki her görevin `art_key`'i olmalı; yeni
görev kapaksız eklenirse kart sessizce yer tutucuya düşer ve kullanıcı
bunu "bozuk kart" olarak görür; kanıt: `status='active' and art_key is
null` sayısı 0.

**İkon eşitliği** — kapaklı ve kapaksız kartta ikonun boyutu ve merkez
sapması aynı olmalı; biri değişirse liste iki farklı kart dili konuşur;
kanıt: iki kartta da chip 58×58 ve merkez sapması 0,0.

**Perde alt sınırı** — giriş ekranlarındaki her metin kendi WCAG
eşiğini geçmeli; perde inceltilirken bir satır gözden kaçarsa metin
gökyüzünün üstünde kaybolur; kanıt: metin gizlenip zemin örneklenerek
hesaplanan kontrast tablosu (renk canvas'tan, regex'ten değil).

---

## 6. Devreden borçlar

1. **VERİTABANI ŞİFRESİ — hâlâ bekliyor.** Bu dilimde de eski şifreyle
   push edildi. Açık şifre git geçmişinde yedi ayrı sürümde duruyor
   (`docs/NIGHT-REPORT-2.md`, 2026-09-14 tarihli commit'ler; çalışma
   ağacındaki sürümde maskeli). Depo GitHub'da. Rotasyon: Supabase
   Dashboard → Project Settings → Database → Reset database password,
   ardından Vercel ortam değişkenleri.

2. **Görsel çözünürlüğü.** Görev kapakları 191px (hedef 768px), giriş
   görseli 941px (3x ekran için 1170px gerekli). `docs/GOREV-GORSEL-SPEC.md`
   üretim ölçülerini yazıyor.

3. **Kapaksız kartta ikon kontrastı 2.32:1.** Açık mavi kategori
   gradyanı üstünde beyaz ikon. D39 öncesinden geliyor, bu dilimde
   dokunulmadı.

4. **Mevcut kapak eşlemelerinin bir kısmı tutmuyor.** "Takımınla
   mahalle parkı temizliği" kartında Galata şehir turu, "Evinde geri
   dönüşüm köşesi kur" kartında ağaç dikimi, "Bozuk bir kaldırımı
   bildir" kartında grup buluşması fotoğrafı var. D38'de bilerek
   korunmuştu (yayındaki kapaklar kaymasın diye). 25 görevin hepsi
   yeniden eşlenebilir — proje sahibinin kararı.

5. **`rls_isolation.sql` makine ile denetlenen iddia üretmiyor.**

6. **`docs/PROFIL-ONERI.md` kararı bekliyor** (A–E seçenekleri,
   öneri C sonra A).

7. Önceki dilimlerden devam edenler: ölü `TaskCard` /
   `task-card-compact.tsx`, ölü `listDiscoverTasks`, `ReportCta`
   sabit ödül metni, davet kötüye kullanım önlemi yok, belediye
   zincirleri yok, 52 ham `<button>`, rozet kutlaması madalyonlarda
   değil ve rozet adı eksik, SQL kaynaklı yazımlarda push yok,
   `redeem_reward` "coin" diyor, yönetici aramasi kapalı,
   `(user)/loading.tsx` yedi segmente ana sayfa iskeleti veriyor,
   sezon ödüllerinde tembel yol yok, panel koyu temaya geçerse
   `app-header.tsx` logosu koyu üstünde koyu kalır.
