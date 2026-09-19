# Görev görselleri — ölçü, format, adlandırma

Bu belge yeni görsel eklerken uyulacak kuralları tanımlar. Ölçüler
**tahmin değil**: uygulamadaki gerçek kutular headless tarayıcıda
ölçüldü (D38 FAZ GK).

---

## İki ayrı görsel var

Karıştırılmaması gereken iki şey:

| görsel | nerede | veritabanı alanı | oran |
| --- | --- | --- | --- |
| **Kart kapağı** | görev kutucuğu (ızgara + şerit) | `tasks.art_key` | 3:4 |
| **Detay kapağı** | görev detay sayfasının üstü | `tasks.image_url` | geniş |

Aynı görseli ikisinde birden kullanmak işe yaramıyor: kart kutusu
yatay bir bant kırpıyor, detay kutusu ondan çok daha geniş. Tek görsel
birinde mutlaka özneyi kesiyor.

---

## 1. Kart kapağı

### Gerçek render kutuları (ölçüldü)

| yer | kutu (CSS px) | oran |
| --- | --- | --- |
| ızgara, 360px telefon | 157×92 | 1.70 |
| ızgara, 390px telefon | 172×101 | 1.70 |
| ızgara, geniş ekran (tavan) | 237×139 | 1.70 |
| yatay şerit (sabit) | 160×92 | 1.74 |

Kart 3:4; kapak alanı kartın **%44'ü**, yani kutunun oranı her ekranda
sabit **1.70** (yatay).

### Ne üretilmeli

**Kaynak dosya 3:4 dikey** olmalı — `background-size: cover` ortadan
yatay bir bant kırpıyor ve kalan %58'lik bandı gösteriyor. 3:4 üretmek,
kart düzeni ilerde değişirse görseli yeniden istemek zorunda
bırakmıyor.

| alan | değer |
| --- | --- |
| oran | **3:4** (dikey) |
| önerilen ölçü | **768×1024** |
| en az | 480×640 |
| format | WEBP, kalite 80–85 |
| hedef boyut | 40–80 KB |

**Neden 768 genişlik:** en büyük kutu 237 CSS px ve telefonlar 3x
piksel yoğunluğunda çalışıyor → 711 px gerekiyor. 768 bunu karşılıyor.

**ÖNEMLİ — kompozisyon:** görselin **orta yatay bandı** (yaklaşık
%20–%78 arası) kartta görünen kısım. Özne oraya yerleşmeli. Alttaki
%20'lik şerit kartta GÖRÜNMÜYOR — oraya etiket/yazı koymanın anlamı
yok, üstelik uygulamanın kendi kategori ikonu zaten sağ alt köşeye
biniyor.

### Adlandırma

```
public/task-art/art-01.webp .. art-20.webp
```

Anahtarlar `art-01`..`art-20` ve **kodda sabit**
(`src/lib/tasks/art.ts`, `TASK_ART_KEYS`). Yirmiden fazlasını eklemek
için o listenin de büyütülmesi gerekiyor — dosyayı klasöre koymak tek
başına yetmiyor.

Veritabanı **anahtarı** saklıyor, yolu değil. Yani bir görselin
içeriğini değiştirmek için aynı adla üzerine yazmak yeterli; hiçbir
görev satırına dokunulmuyor.

Her anahtarın panelde görünen kısa açıklaması `TASK_ART_HINTS` içinde;
görseli değiştirirken açıklamayı da güncelleyin, yoksa personel yanlış
kapak seçer.

---

## 2. Detay kapağı

### Gerçek render kutusu (ölçüldü)

Yükseklik **sabit 144 px**, genişlik ekranla değişiyor:

| ekran | kutu (CSS px) | oran |
| --- | --- | --- |
| 360px | 328×144 | 2.28 |
| 430px | 398×144 | 2.76 |
| 448px ve üstü (tavan) | 416×144 | 2.89 |

### Ne üretilmeli

| alan | değer |
| --- | --- |
| oran | **2.9:1** civarı (2.8–3.3 arası kabul) |
| önerilen ölçü | **1280×440** |
| en az | 832×288 |
| format | WEBP, kalite 82–88 |
| hedef boyut | 80–140 KB |

**Neden 1280 genişlik:** en geniş kutu 416 CSS px, 3x yoğunlukta
1248 px.

**ÖNEMLİ — kompozisyon:** oran ekran genişliğiyle 2.28'den 2.89'a
oynadığı için dar telefonlarda **soldan ve sağdan kırpılıyor**. Özne
ortadaki **%60**'lık alanda olmalı. Kenarlara yerleştirilen bir figür
dar ekranda yarısı kesik görünür.

### Adlandırma

```
public/task-art/detay-kapak.webp
```

Tek dosya: görevin kendi `image_url`'i yoksa bu kullanılıyor. Birden
çok varsayılan kapak istenirse `src/lib/tasks/art.ts` içindeki
`DEFAULT_TASK_COVER` sabitinin bir seçiciye dönüşmesi gerekir.

---

## 3. Toplu kaynak: kontakt sayfası

Şu an görseller tek bir kontakt sayfasından kesiliyor:

```
public/brand/gorevler.png  →  pnpm art:slice  →  public/task-art/*.webp
```

Kesme koordinatları `scripts/slice-task-art.mjs` içinde **ölçülerek**
yazılı (kaynakta zemin rengine göre bağlı bileşen etiketlemesi). Kaynak
sayfanın düzeni değişirse o koordinatlar yeniden ölçülmeli — script
sayfayı kendi başına tanımıyor.

### ⚠ Mevcut görsellerin çözünürlüğü yetersiz

Eldeki `gorevler.png` bir **önizleme sayfası**: 1642×958 ve içindeki
her kart yalnız ~191×251. Yukarıdaki spec 768×1024 istiyor.

Ölçülen sonuç: kart kapakları telefonda **yumuşak** görünüyor (191 px
kaynak, 3x ekranda 711 px'e uzatılıyor — 3.7 kat). Detay kapağı daha
iyi durumda: 781 px kaynak, 2x ekranda neredeyse tam karşılık.

Yapay büyütme uygulanmadı: büyütmek bilgi eklemiyor, yalnız dosyayı
şişirip sahte keskinlik veriyor. Görseller **olduğu çözünürlükte**
kaydedildi.

**Yapılması gereken:** kartları tek tek, spec ölçüsünde (768×1024)
üretip `public/task-art/` altına aynı adla koymak. O zaman
`slice-task-art.mjs` çalıştırmaya da gerek kalmaz.

---

## 4. Hızlı kontrol listesi

Yeni bir görsel eklerken:

1. Kart kapağı mı, detay kapağı mı? (oranlar farklı)
2. Oran doğru mu? (3:4 / 2.9:1)
3. Ölçü en azı geçiyor mu? (480×640 / 832×288)
4. WEBP mi, boyut hedefte mi?
5. Özne doğru bölgede mi? (kartta orta bant, detayda orta %60)
6. Dosya adı mevcut anahtarlardan biri mi?
7. `TASK_ART_HINTS` açıklaması görselle uyuşuyor mu?
