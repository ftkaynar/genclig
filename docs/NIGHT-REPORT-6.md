# Gece Vardiyası 6 — DİLİM 25

## FAZ G2 — Görev ızgarası

`/gorevler` kart listesinden **ızgaraya** geçti: mobilde 2, `sm` 3, `lg` 4
sütun. Kart `aspect-ratio: 3/4` dikey kutucuk.

**Yeni bileşen** `src/components/tasks/task-tile.tsx`:
- Üst yarı (%46): kategori gradyanı + 56 px lucide ikon
- Sol üst: zaman durumu çipi (Yakında / Aktif / Sürekli)
- Sağ üst: zorluk kademe rozeti (bronz / gümüş / altın) + küçük parıltı
- Kenar halkası (`ring-inset`) kademe renginde
- Alt yarı: 2 satır clamp başlık, XP (cyan) + Coin (altın) hapları,
  en altta durum satırı (geri sayım ya da "Sürekli")
- Köşe kurdelesi: açık/onaylı teslimde "İncelemede" / "Tamamlandı"
- Takım görevinde alt şerit "Takım · N/M"
- Basınca `active:translate-y-0.5` (v2 buton dili)

**Zaman çipi kutucukta farklı stilde.** Kart listesindeki çip açık kart
yüzeyinde duruyor ve yarı saydam renkli zemin + renkli metin okunuyor.
Kutucukta çip kategori gradyanının **üstünde**; aynı stil okunmuyordu.
Koyu saydam zemin + beyaz metin + ikon kullanıldı.

**Desen:** düz gradyan bu boyutta yassı duruyordu. `.tile-pattern` ile ince
ızgara deseni — SVG yerine iki çizgisel gradyan: ek ağ isteği yok ve
beyazın saydamlığıyla çalıştığı için kategori rengi ne olursa olsun uyuyor.

**Kap genişliği:** `/gorevler` sayfası `sm:max-w-3xl lg:max-w-5xl` oldu.
`max-w-md` kalsaydı ızgara 3-4 sütuna çıksa bile sütunlar hiç
genişlemezdi. Diğer ekranlar telefon genişliğinde kaldı.

**`small` varyantı** keşif şeritleri için aynı bileşende: ayrı bir kart
yazmak iki ayrı görsel dil demekti ve biri güncellenince diğeri geride
kalıyordu.

### Kanıtlar (yerel dev sunucu, HTML sayımı)

Veritabanında 8 aktif feed görevi var. Render edilen HTML'de:

```
aspect-ratio:3 / 4    8 adet   ← kutucuk sayısı = görev sayısı
grid grid-cols-2 …    2 ızgara ← "Yaklaşan" + "Şimdi açık"
tile-pattern         16        (8 × 2: HTML + RSC payload kopyası)
tier-glow            16
Kolay 12 / Orta 4              (6 kolay + 2 orta = 8 görev × 2)
Yakında               2        (1 yaklaşan görev × 2)
Takım ·               4        (2 takım görevi × 2)
```

Çift sayılar Next'in RSC payload'ını da HTML'e gömmesinden; kutucuk
sayısı `aspect-ratio` ile tek tek doğrulandı.

---

## FAZ K2 — Keşfet v2

Düz harita+liste ekranı **keşif merkezine** dönüştü.

**Harita kompaktlaştı:** `h-72` yerine `h-[38dvh] max-h-80 min-h-56`
(ekranın ~%40'ı) — altındaki keşif şeritleri ilk ekranda görünsün diye.
Köşe yuvarlatma ve kenarlık dıştaki kapsayıcıya taşındı; leaflet
kutucukları köşeden taşıyordu.

**Kategori filtre çipleri** haritanın üstünde, yatay kaydırmalı, seçili
çip marka gradyanında. Filtre **hem haritayı hem tüm şeritleri birlikte**
süzüyor. Yalnızca görevi olan kategoriler çip oluyor.

**Keşif şeritleri** (yatay kaydırmalı, hepsi `TaskTile small` varyantı):
- **Yakınındaki görevler** — haversine ile mesafe sıralı, her kutucukta
  mesafe rozeti. Yalnızca "Konumum"a basıldıktan sonra görünüyor; konum
  yokken mesafe uydurmak yerine şerit hiç çizilmiyor.
- **Yaklaşan etkinlikler** — upcoming görevler, başlangıç saatine sıralı,
  "Tümünü gör" → `/gorevler?tip=instant`
- **Kategori şeritleri** — Çevre, Kültür, Sosyal, Spor, Şehir…

Kategori şeritlerinde **"Tümünü gör" bilerek yok:** `/gorevler`'de kategori
filtresi bulunmuyor ve süzmeyen bir bağlantı kullanıcıya yalan söylerdi.
Kategori filtresi eklenirse buraya derin link konabilir.

**"İlçende" kartı** — ilçedeki aktif görev sayısı, bu hafta tamamlanan,
topluluk kanalına kısayol. Yeni RPC `district_discover_stats()`
`security definer`: haftalık tamamlanan sayısı başka kullanıcıların
teslimlerini kapsıyor ve RLS onları gizliyor; fonksiyon yalnızca toplu
sayı döndürüyor.

"İlçedeki aktif görev" tanımı: o ilçedeki bir **belediyeye ait** aktif
görevler. Görevler ilçeye doğrudan bağlı değil (`municipality_id`
üzerinden), bu yüzden **global görevler bu sayıya girmiyor** — "senin
ilçene özel" ifadesinin anlamı bu.

**Konumu olmayan kullanıcı:** harita İstanbul geneli açılıyor, üstte
"Konumunu ayarla → daha iyi öneriler" kartı.

**Tutarlılık:** şeritler `/gorevler` ızgarasıyla **aynı** `TaskTile`
bileşenini kullanıyor. Ayrı bir şerit kartı yazmak iki görsel dil demekti
ve biri güncellenince diğeri geride kalıyordu.

### Kanıtlar (yerel dev sunucu)

Oturumsuz `/kesfet` → 200; şeritler: "Yaklaşan etkinlikler", kategori
grupları **Çevre / Kültür / Sosyal / Spor / Şehir**; "Konumunu ayarla"
kartı görünür; 8 kutucuk (`tile-pattern`).

İlçesi ayarlı oturumla `/kesfet` → 200; "Konumunu ayarla" kartı **kayboldu**,
"İlçende" kartı geldi: "aktif görev", "bu hafta tamamlandı",
"İlçe topluluğuna git". HTML'deki sayı ile RPC aynı:

```
district_name | active_tasks | weekly_completed | kanal_var
Adalar        |            1 |                0 | t
```

"Yakınındaki görevler" şeridi tarayıcı konum izni gerektirdiği için
curl ile doğrulanamıyor; "Konumum" düğmesine basılınca açılıyor (sabah
turunda elle bakılacak).

---

## FAZ R3 — Sürekli görevde günlük teslim sınırı (D24 borcu)

**Borcun kaynağı:** D24'te sürekli görevlerde açık teslim tekilliği
kaldırılmıştı (kullanıcı inceleme sürerken tekrar gönderebilsin diye).
Hiçbir sınır kalmayınca tek kullanıcı aynı görevi arka arkaya defalarca
gönderip inceleme kuyruğunu doldurabiliyordu. D24 raporunda borç olarak
yazılmıştı; kapandı.

**Çözüm:** `tasks.daily_submission_limit` (1–50, null → varsayılan 3) +
`daily_submission_count(task, user)` RPC'si.

**Gün sınırı Europe/Istanbul:** sunucu UTC çalışıyor ve gece yarısından
sonraki teslimler dünün sayacına düşüyordu — aynı sınıf sorun D09'da
günlük kazançta ölçülmüştü.

**Reddedilen teslimler sayılmıyor.** Kullanıcı haksız yere reddedilmişse
günü kapanmamalı; bekleyen ve onaylanan sayılıyor.

**Kolon null bırakıldı,** varsayılan fonksiyonda: mevcut satırları toplu
güncellemeye gerek kalmıyor ve varsayılanı değiştirmek tek yerden
yapılabiliyor.

Sınır `submit_task` ve `submit_quiz`'in **ikisinde de** uygulanıyor;
yalnızca `type = 'continuous'` görevlerde. Diğer tipler zaten dönemsel
tekil.

**Panel/admin formu:** `type = continuous` seçiliyken "Günlük teslim
limiti" alanı görünüyor (varsayılan 3). Sunucu 1–50 aralığını doğruluyor
ve sürekli olmayan görevde alanı `null`'a çekiyor — ileride tip değişirse
eski bir limit sessizce devreye girmesin diye.

### Kanıtlar (yerel psql)

- Varsayılan 3 → 1., 2., 3. teslim `approved`; **4. teslim** →
  "Bu görevi bugün için yeterince gönderdin, yarın tekrar dene."
- **Ertesi gün simülasyonu** (teslimler bir gün geriye alındı) → sayaç
  `0`, yeni teslim `approved`
- Görev bazında limit `1` → ikinci teslim reddedildi
- Teslimler `rejected` yapıldı → sayaç **0** (red sayaç doldurmuyor)
- **Daily görev etkilenmiyor:** ikinci teslimde "Bu görevi zaten
  gönderdin." (limit mesajı değil)
- Kolon kısıtı: `daily_submission_limit = 99` →
  `tasks_daily_submission_limit_check` ihlali
