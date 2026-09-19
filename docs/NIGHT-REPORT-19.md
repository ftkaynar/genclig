# Gece Raporu 19 — DİLİM 38

**Trend oku düzeltme + keşfet sayı tutarsızlığı + sıralama filtre hizası
+ görev kapak görseli + profil analizi**

Commit'ler: `71fd11d` (T), `0606bcf` (K / M36a), `0b1f3ae` (S),
`f3a0d50` (GK), `cf687e8` (PA), bu rapor (Z).

Bu dilimde iki kez öncül yanlış çıktı ve ölçüm düzeltti: keşfet
sayacı zaten tutarlıydı (asıl sorun başkaydı), ve `rls_isolation.sql`
kalıntısı sandığım şey aslında testin kendi içindeki bir çakışmaydı.
İkisi de aşağıda.

---

## 1. FAZ T — trend işareti ikon değil şekil

Proje sahibi haklıydı: D36/D37'de yaptığım hali yanlış yorumlanmıştı.

**Ölçülen sorun:** `trending-up` / `trending-down` bir **grafik**
ikonu — zikzak çizgi ve ucunda küçük bir ok. 16px'te kartın içinde
"görev ikonu" gibi okunuyor, yön bilgisi kayboluyordu.

| durum | eski | yeni |
| --- | --- | --- |
| yükseldi | `trending-up` zikzak | dolu ▲ yeşil `rgb(34,197,94)` |
| düştü | `trending-down` zikzak | dolu ▼ kırmızı `rgb(239,68,68)` |
| değişmedi | `minus` ikonu | tire sarı `rgb(245,179,1)` |
| veri yok | tire + açıklama satırı | tire gri `rgb(151,166,199)`, metin YOK |

Üçgen CSS kenarlık hilesiyle çiziliyor: lucide'da dolu üçgen yok ve
`triangle` içi boş, bu boyutta seçilmiyor. Unicode ▲ denendi ve elendi
— yazı tipine göre boyut ve hiza oynuyordu.

"Değişmedi" üçgen **değil** tire: eşitlik bir yön değil, üçgen çizmek
onu üçüncü bir yön gibi gösteriyordu.

**"Trend okları yarın başlıyor." cümlesi kaldırıldı.** Üç sütunluk sıkı
bir bloğa dördüncü satır eklemek ekranı kirletiyordu; işaretin kendisi
zaten "henüz bir şey yok" diyor.

Sayılar parlak kaldı (`rgb(255,244,214)` + ışıma), count-up korundu.
Sıralama kartlarında artık hiç lucide `svg` yok.

---

## 2. FAZ K — keşfet sayacı: öncül yanlıştı, kök sebep başka

### Ölçülen: sayaç ile liste ZATEN tutarlıydı

Yedi ilçenin yedisinde de **sayaç = tekil kart = harita pini**. İkisi de
aynı diziden türüyor (`listFeedTasks`); `listDiscoverTasks` ise artık
hiç çağrılmıyor (ölü kod).

Tutarsız olan **veritabanı ile arayüzdü**: Fatih'te sayaç 3 derken
veritabanında 4 aktif görev vardı.

### Kök sebep

`tasks.type` beş değer kabul ediyordu:

```
continuous, instant, daily, weekly, monthly
```

ama uygulama yalnız ikisini tanıyor. `FEED_TASK_TYPES` sabiti
(`["continuous","instant"]`) bütün feed sorgularının içinde. Grep'te
diğer üç değer kodun **başka hiçbir yerinde** geçmiyordu — yalnız panel
formunun açılır listesinde.

Yani personel "Günlük" seçtiğinde görev kaydediliyor, `active` oluyor
ve uygulamada **hiç görünmüyordu**: ne feed'de, ne haritada, ne
sayaçta. Bulutta 1, yerelde 4 böyle görev vardı.

### M36a

`daily` / `weekly` / `monthly` → `continuous`, sonra `CHECK` kısıtı iki
tiple daraltıldı. Form da iki tip sunuyor.

**Neden `continuous`:** "günlük görev" zaten sürekli görevin kendisi —
görev günü penceresinde (06:00) tekrarlanabiliyor ve günlük sınır ayrı
bir sütunda (`daily_submission_limit`).

**Üç tipi feed'e eklemek denendi ve elendi:** haftalık/aylık ritmi
hesaplayan kod hiç yazılmamış, `taskCardState` tekrar davranışını
yalnız `continuous`'a veriyor. Görünür yapmak, ritmi tutulmayan
görevleri sessizce yanlış çalıştırmak olurdu — görünmezden kötü.

`CHECK` kısıtı da daraltıldı: form iki tip sunuyor ama veri katmanı beş
tipe izin verdiği sürece bir sonraki toplu içe aktarma aynı boşluğu
geri getirir.

### Sonuç

```
bolge        sayac  kart  pin   DB   durum
Bakırköy     2      2     2     2    UYUMLU
Beşiktaş     1      1     1     1    UYUMLU
Fatih        4      4     4     4    UYUMLU
Kadıköy      6      6     6     6    UYUMLU
Sarıyer      1      1     1     1    UYUMLU
Şişli        1      1     1     1    UYUMLU
Üsküdar      1      1     1     1    UYUMLU
```

---

## 3. FAZ S — sıralama filtreleri v3

**Yatay kaydırma kaldırıldı.** Dört alan çipi `HScroll` içindeydi:
kaydırılabilir şerit, kenarlarında ok düğmeleri ve solma maskesi. Dört
öğe 360px'e bile rahat sığıyor; kaydırma da oklar da hiç gerekmiyordu
ve sağda "burada daha çok şey var" izlenimi veriyordu.

`flex-wrap` denendi ve elendi: dar ekranda dördüncü çip alt satıra
düşüyor ve blok bir satır büyüyordu. `grid-cols-4` her genişlikte tek
satır. Etiketler 13px'ten 12px'e indi — 13px'te "Türkiye" 73px'lik
sütuna sığmıyordu.

**Seçili çip belirgin.** Önceden %15 opak dolgu + renkli metindi ve
seçilmemişlerle neredeyse aynı ağırlıktaydı. Artık dolu marka gradyanı
+ ışıma + beyaz metin (`.chip-active`), yani üstteki Bireysel|Takım
segmentinin kayan göstergesiyle aynı dil. Hem alan çipleri hem dönem
hapları.

Filtre kartına hafif iç gölge (`.filter-card`).

### Ölçüm

| ekran | alan çipleri | dönem hapları | segment |
| --- | --- | --- | --- |
| 360px | 4 × 73px | 3 × 99px | 2 × 151px |
| 390px | 4 × 81px | 3 × 109px | 2 × 167px |
| 430px | 4 × 91px | 3 × 123px | 2 × 186px |

Üç genişlikte de: kart iç kenarına **1px** hizalı, öğeler eşit
genişlikte, minimum yükseklik **40px**, metin taşması yok, kaydırma
oku **0**, yatay kaydırma yok, sayfa taşması yok.

---

## 4. FAZ GK — görev kapak görselleri

### Kaynak analizi

`public/brand/gorevler.png` (1642×958) bir **kontakt sayfası**:
20 adet 3:4 kart görseli (etiketli) + sağ altta 1 adet geniş detay
kapağı. 21 dikdörtgen, zemin rengine (#f6f9fc) göre bağlı bileşen
etiketlemesiyle **ölçülerek** bulundu; koordinatlar
`scripts/slice-task-art.mjs` içine yazıldı.

### Eşleme anlamla yapıldı

Sayfanın okuma sırasıyla değil. Mevcut görevler zaten `art_key`
taşıyor (art-06 üç görevde; art-01, 02, 04, 05, 14, 15 ikişer). Her
fotoğraf **anlamı en yakın anahtara** verildi ki yayındaki kapaklar
kaymasın:

| anahtar | fotoğraf | eşleşme |
| --- | --- | --- |
| art-01 (2 görev) | Gönüllülük · ağaç dikimi | tam |
| art-02 (2) | Sosyal · dayanışma | tam |
| art-04 (2) | Katılım · sahne | tam |
| art-05 (2) | Eğitim · çalışma | tam |
| art-06 (3) | Toplanma · buluşma | tam |
| art-12 (1) | Çevre · fide | tam |
| art-14 (2) | Kültür · müze | yakın |
| art-15 (2) | Kariyer · çalışma masası | yakın |
| art-11, 13, 17, 18, 19 | — | karşılık yoktu |

Beş anahtarda tam karşılık yoktu (bisiklet, sahil temizliği, hayvan
barınağı, yaşlı ziyareti, festival). Onlara konu olarak yakın birer
şehir/genç sahnesi verildi ve **ipucu yeni fotoğrafı anlatacak şekilde
güncellendi**; o görevlerin kapağı panelden değiştirilebilir.

### Kod tarafı

- `taskArtUrl` `.svg` → `.webp` (tek satır). Anahtarlar aynı kaldı,
  hiçbir veritabanı satırına dokunulmadı. Eski 20 SVG silindi.
- Detay sayfası: `image_url` yoksa `DEFAULT_TASK_COVER`. Önceden kapak
  boşken yalnız kategori gradyanı vardı; ekranın ilk gördüğü yer düz
  renkli bir bloktu. Gradyan arkada duruyor (görsel yüklenene kadar).
- Panel seçicide 21 seçenek (20 görselli + "görsel yok"), hepsi WEBP.
- `pnpm art:slice` komutu eklendi.

### ⚠ Çözünürlük yetersiz — üretim görselleri gerekiyor

Kontakt sayfası bir **önizleme**: içindeki her kart yalnız ~191×251.
Kart kutusu en geniş 237 CSS px ve telefonlar 3x, yani **711 px**
gerekiyor. Kart kapakları telefonda **yumuşak** görünüyor.

Detay kapağı daha iyi: 781 px kaynak, 2x ekranda neredeyse tam
karşılık, 3x'te 1.6 kat büyütme.

**Yapay büyütme uygulanmadı:** büyütmek bilgi eklemiyor, yalnız dosyayı
şişirip sahte keskinlik veriyor. Görseller olduğu çözünürlükte
kaydedildi (toplam 388 KB).

### Spec

`docs/GOREV-GORSEL-SPEC.md` yazıldı — ölçü, format, klasör, adlandırma,
kompozisyon kuralları ve kontrol listesi. Özet:

| görsel | oran | önerilen | en az | format |
| --- | --- | --- | --- | --- |
| kart kapağı (`art_key`) | 3:4 | **768×1024** | 480×640 | WEBP 80-85 |
| detay kapağı (`image_url`) | 2.9:1 | **1280×440** | 832×288 | WEBP 82-88 |

Kompozisyon: kartta özne **orta yatay bantta** (alt %20 kartta
görünmüyor), detayda özne **orta %60**'ta (dar telefonda kenarlar
kırpılıyor).

---

## 5. FAZ PA — profil analizi (yalnız analiz)

`docs/PROFIL-ONERI.md` yazıldı. Uygulama yok.

### Ölçülen (390×844, oturumlu)

Sayfa **1943px = 2.3 ekran** (FUT kartsız; kartlı ~2.8).

| blok | yükseklik |
| --- | --- |
| Seviye Yolu | **555px** |
| Rozetlerim (3/7) | **516px** |
| Seviye + hızlı bağlantılar | 408px |
| İstatistiklerim | 110px |
| Son aktiviteler | 102px |

### Bulgular

1. **Seviye ve XP dört yerde:** HUD, FUT kart, seviye halkası, Seviye
   Yolu. Dördü de aynı sayıyı söylüyor.
2. **En büyük blok en az bilgi veren blok:** Seviye Yolu ekranın üçte
   ikisi ve üstündeki halkanın uzatılmışı.
3. **Gerçek veri en dipte ve en küçük:** istatistik + aktivite toplam
   212px, Seviye Yolu'nun %38'i, iki ekran kaydırma sonrasında.
4. **Ayarlar ve çıkış profilin dışında**, üçüncü seviyede.
5. **Altı hızlı bağlantı iki farklı iş yapıyor** (içerik / hesap).
6. **Kartsız kullanıcıda FUT kart hiç çizilmiyor** — yeni hesapta
   profilin merkezi boş.

### Beş seçenek

| seçenek | özet | maliyet |
| --- | --- | --- |
| A | sekmeli profil + sağ üst çekmece | orta |
| B | tek akış, sıkıştırılmış ve yeniden sıralanmış | düşük |
| C | çekmece + sıkıştırılmış akış | düşük-orta |
| D | kart merkezli ("profil = kart") | yüksek |
| E | yapışkan sekme + küçülen kart | yüksek |

**Öneri: C ile başla, rozet sayısı artınca A'ya geç.** En ağır iki
sorun (dörtlü tekrar ve 555px'lik blok) sekme gerektirmeden çözülüyor;
sekmenin "içeriği gizleme" bedeli ancak bölümler gerçekten dolduğunda
karşılanıyor — bugün 7 rozet ve 3 aktivite satırı var.

---

## 6. Test sonuçları — ve D37'de eklediğim korumanın işe yaraması

```
--- SIRALI HATA LISTESI ---
(boş)
--- SAYILAR ---
HATA: 0
GECTI: 79
ERROR: 39
```

D37 ile **GEÇTİ listesi birebir aynı**.

### "Sessiz dosya" uyarısı bir hata yakaladı

D37'de koşum betiğine "hiç iddia üretmeyen dosya" uyarısı eklemiştim.
Bu dilimde uyarı `stat_decay.sql`'i işaretledi: 7 iddiası koşmuyordu.

**İlk teşhisim yanlıştı.** Kalan `task_submissions` satırlarının
(`rls_isolation.sql`'in bilinen kalıntısı) çakışmaya yol açtığını
sandım ve `rls_isolation.sql`'e sondan temizlik ekledim. Temizlik
doğruydu ve gerekliydi — ama `stat_decay.sql` **hâlâ** çöküyordu,
üstelik veritabanında hiç kalıntı yokken.

**Gerçek sebep:** `stat_decay.sql` fikstür görevini konumsal offset'le
seçiyordu:

```sql
select id into v_task from public.tasks
order by created_at limit 1 offset (v_i % 9);
```

Döngü 10 turda 9 offset kullanıyor, yani bir offset **iki kez** geliyor
ve aynı göreve iki teslim yazılıyor. `task_submissions_open_unique`
indeksi `(task_id, user_id, period_key)` üzerinde tekil ve yalnız
`task_type <> 'continuous'` satırlara uygulanıyor — o konumdaki görev
sürekli değilse ikinci insert çakışıyor.

Konumsal offset canlı tablodan fikstür seçtiği için görev havuzu her
değiştiğinde farklı davranıyordu: testin geçmesi veriye bağlıydı.
Fikstür artık yalnız `continuous` görevlerden seçiliyor, yani indeks
yüklemi hiç uygulanmıyor.

### İki test düzeltmesi

| dosya | sorun | düzeltme |
| --- | --- | --- |
| `rls_isolation.sql` | 27 yazımı transaction dışında yapıyor (RLS için gerekli), temizliği yalnız BAŞTA | sona da temizlik eklendi; 0 kullanıcı, 0 teslim kalıyor |
| `stat_decay.sql` | konumsal offset, aynı göreve iki teslim | fikstür yalnız `continuous` görevlerden |

### Yol boyunca yaptığım ve ölçümle yakaladığım hata

`rls_isolation.sql` temizliğine "levels geri al" diye
`update levels set min_xp = 250 where level = 2` yazdım. Bulut
referansını sorgulayınca tohum değerinin **100** olduğu çıktı — yani
testin o satırı zaten no-op, sızıntı yok. Benim "geri alma"m veriyi
bozuyordu. Satır kaldırıldı, yerel veri 100'e döndürüldü.

### Kalan tek sessiz dosya

`rls_isolation.sql` 0 iddia gösteriyor ama **abort etmiyor** — sonuna
kadar koşuyor. Tasarımı farklı: GECTI/HATA satırı yerine ham sayı basıp
yanına `\echo '(1 olmali)'` yazıyor, yani beklentiyi insan
karşılaştırıyor. Makine kontrolü yok; borç olarak duruyor.

`pnpm check:all` (types + lint + build): temiz.

---

## 7. Bulut

```
supabase db push --dry-run
Would push these migrations:
 • 20261003000000_task_type_cleanup.sql
```

Uygulandı. Bulut doğrulaması (IPv4 pooler):

```
tip dağılımı      instant 16, continuous 16  (daily YOK)
ilçe dağılımı     Kadıköy 6, Fatih 4, Bakırköy 2, Beşiktaş 1,
                  Sarıyer 1, Şişli 1, Üsküdar 1
```

### ⚠ SON KEZ: veritabanı şifresi rotasyon bekliyor

Bu dilimde de D33'te verilen **eski şifre çalıştı**. Yani
`docs/NIGHT-REPORT-2.md` git geçmişinde duran açık şifre **hâlâ
geçerli** ve depo GitHub'da.

Bu, D33'ten beri dört dilimdir taşıdığım ve her raporda yazdığım tek
gerçek güvenlik borcu. Kod tarafında yapabileceğim bir şey yok —
rotasyon panelden yapılıyor:

1. Supabase Dashboard → Project Settings → Database → **Reset database
   password**
2. Yeni şifreyi Vercel ortam değişkenlerine yaz
3. Bir sonraki bulut push'ta yeni şifre kullanılacak

Git geçmişindeki değeri silmek ayrı bir iş (history rewrite); rotasyon
onu zararsız hale getiriyor ve tek başına yeterli.

---

## 8. Canlı kontroller

`https://genclig.vercel.app` (commit `cf687e8`):

| yol | durum |
| --- | --- |
| `/` · `/karsilama` · `/giris` | 200 |
| `/kesfet` · `/gorevler` · `/siralama` | 200 |
| `/zincirler` · `/profil` · `/oduller` | 200 |
| `/panel/gorevler/yeni` · `/admin/gorevler/yeni` | 200 |
| `/task-art/art-01.webp` · `art-10` · `art-20` · `detay-kapak` | 200 |

Üretim CSS paketinde `trend-up`, `trend-down`, `trend-same`,
`trend-none`, `chip-active`, `filter-card` sınıflarının hepsi var.

Oturumlu canlı ekranlar yine üretimde doğrulanmadı (bulut anon anahtarı
anonim indirilebilen paketlerde yok). Aynı commit yerelde oturumlu
ölçüldü.

---

## 9. Sabah turu

1. **Ana sayfa "Sıralaman"**: sayıların yanında dolu üçgen ▲ / ▼ ya da
   tire. Altında açıklama cümlesi OLMAMALI.
2. **`/siralama`**: üç filtre satırı da kart kenarına hizalı, yan ok
   yok, seçili çip dolu mor gradyan.
3. **`/kesfet`**: bölge seçicideki sayı, o bölgeyi seçince görünen
   görev sayısıyla aynı olmalı. Fatih artık 4.
4. **Bir görev detayına girin**: üstte İstanbul silüeti kapağı.
5. **Panel → Yeni görev**: tip listesinde yalnız Sürekli ve Anlık.
   Kapak seçicide 20 fotoğraf.
6. **`docs/PROFIL-ONERI.md`** okunup bir seçenek seçilmeli — sonraki
   dilim ona göre planlanacak.

---

## 10. Borçlar

**Acil:** veritabanı şifresi (bkz. bölüm 7).

**Bu dilimden:**

- **Görev kapak görselleri üretim çözünürlüğünde değil** (bkz. bölüm 4).
  Kartlar 191px, spec 768px istiyor.
- `listDiscoverTasks` artık hiç çağrılmıyor — ölü kod.
- `rls_isolation.sql` makine kontrollü iddia üretmiyor.
- Trend karşılaştırması gün farkını göstermiyor ("Önceki kayda göre"
  doğru ama "3 gün önceye göre" daha bilgilendirici olurdu).

**Devam edenler:** ölü `TaskCard` / `task-card-compact.tsx`;
`ReportCta` ödül metni koda gömülü; davet kötüye kullanım önlemi yok;
belediye zincirleri yok; 52 ham `<button>`; rozet kutlaması madalyaya
geçmedi ve rozet adını göstermiyor; SQL kaynaklı yazımlardan push
gitmiyor; `redeem_reward` DB mesajı "coin" diyor; yönetim arama kutusu
devre dışı; `(user)/loading.tsx` ana sayfa şeklinde bir iskeleti yedi
segmente servis ediyor; sezon ödüllerinin tembel yolu yok; panel/admin
koyu temaya alınırsa `app-header.tsx` logosu koyu zeminde koyu kalıyor;
yeni görevlerde bölge alanı artık formda ama 16 eski görev hâlâ
bölgesiz (koordinatı olmayan quiz/fotoğraf görevleri — bu doğru).
