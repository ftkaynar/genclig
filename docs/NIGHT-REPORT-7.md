# Gece Vardiyası 7 — DİLİM 26

## FAZ S1 — İstat motoru (M26)

`user_stats` tablosu: altı istat (0-99), `ovr`, `tier`, `computed_at`.
Hepsi **gerçek davranıştan** türüyor; hiçbiri elle girilmiyor.

### Normalizasyon eğrisi

```
stat = round(99 * (1 - exp(-k * signal)))
```

Doğrusal ölçekte ya tavan çok erken doluyor ya da ilk görevler hiçbir şey
hissettirmiyordu. Üstel doyum eğrisi başta hızlı yükseliyor (ilk birkaç
eylem görünür fark yaratıyor), sonra yavaşlıyor; 99 kasıtlı olarak çok
zor. `k` istat başına ayrı: sinyali bol olanlarda küçük, seyrek olanlarda
büyük.

Ölçülen eğri (`k = 0.055`):

```
sinyal:  0    5    20   60   200
stat:    0    24   66   95   99
```

### Sinyaller

| İstat | Sinyal |
|---|---|
| AKT | onaylı görev + 2 × en uzun günlük seri |
| SOS | 3 × arkadaş + takım(5) + min(mesaj,20)/2 + 3 × sosyal/takım görev |
| KAT | bildirim + 2 × çözülen |
| KEŞ | farklı konumlu görev + 4 × farklı kategori |
| BİL | 3 × geçilen test + 2 × (eğitim+kültür görev) |
| AZM | 3 × zor + orta + son 30 günde aktif gün |

**Streak türetiliyor, saklanmıyor:** ardışık günler "tarih − sıra numarası
sabit kalır" kuralıyla gruplanıyor (gaps-and-islands). Ayrı bir streak
tablosu olsaydı, bir teslim sonradan onaylandığında sayı geriye dönük
düzelmezdi.

**Mesaj katkısı tavanlı (20):** sohbeti spam'leyerek istat yükseltmek
mümkün olmamalı.

**Tüm gün hesapları Europe/Istanbul** — D09 ve D25'te ölçülen aynı sınıf
sorun.

### OVR harmanı: %60 istat ortalaması + %40 seviye

Yalnız istat ortalaması olsaydı çok XP toplamış ama tek alanda yoğunlaşmış
kullanıcı düşük OVR alırdı; yalnız seviye olsaydı kart altı istattan
**kopuk** olur ve istatları yükseltmenin karta hiçbir etkisi kalmazdı.
60/40 istat tarafını baskın tutuyor — kartın vaadi "ne yaptığın".

Kademe: <50 bronz, 50-69 gümüş, 70-84 altın, 85+ özel.

### Güncelleme yolu: RPC yerine tablo tetikleyicileri

`award_task_points` sonuna eklendi; diğerleri için **tetikleyici**
kullanıldı (`problem_reports`, `friendships`, `team_members`,
`channel_messages`).

Neden RPC gövdelerine `perform` eklenmedi: `report_problem`,
`set_problem_status`, `respond_friend_request`, `join_team`, `leave_team`
gövdelerini bu migration'a kopyalamak gerekirdi ve her kopya ileride
ıraksama riski. Tetikleyici ayrıca **her** yazma yolunu yakalıyor — bugün
aklıma gelmeyen ya da sonradan eklenecek bir yol dahil.

**Denenen ve elenen alternatif:** "istat bayat" işareti koyup okuma anında
hesaplamak. Elendi: profil açılışını yavaşlatıyordu ve kartın "az önce
yaptığım iş kartıma yansıdı mı" hissi kayboluyordu.

### Yol boyunca bulunan İKİ GERÇEK HATA

**1. Hesap silme kırılıyordu.** Kullanıcı silinince `team_members`
satırları cascade ile siliniyor, `AFTER DELETE` tetikleyicisi
`recompute_user_stats` çağırıyor, ama `auth.users` satırı çoktan gitmiş
oluyor:

```
ERROR: insert or update on table "user_stats" violates foreign key
constraint "user_stats_user_id_fkey"
```

Yani **kullanıcı silme işlemi hata veriyordu.** Koruma
`recompute_user_stats`'ın başına kondu (tetikleyicilere değil — orası her
çağıranı birden kapsıyor). Düzeltmeden sonra silme temiz: `DELETE 1`,
kalan istat satırı 0.

**2. `get_profile_card`'da belirsiz kolon.** Fonksiyonun `user_id` OUT
parametresi `user_stats.user_id` ile çakışıyordu:

```
ERROR: column reference "user_id" is ambiguous
```

Yalnızca **arkadaş** yolunda patlıyordu (sorgu `if v_friend` içinde), bu
yüzden arkadaş olmayan yolu test etmek yetmezdi. Takma adla çözüldü.

### Kanıtlar (yerel psql)

- Sıfır davranış → altı istat da 0, tier `bronze`
- Görev tamamla → AKT 0 → **15**
- Arkadaş ekle → SOS 0 → **20**, karşı tarafın SOS'u da 20 (tetikleyici
  iki tarafı da tazeliyor)
- Bildirim → KAT 0 → **12**; çözülünce → **32**
- Test geç → BİL 0 → **45**
- Takım kur → SOS **45**
- Streak: 3 ardışık + 1 kopuk gün → AKT **42**
- Gizlilik: arkadaş olmayan kullanıcı 0 istat satırı görüyor; A arkadaşı
  B'yi görüyor (1), C'yi görmüyor (0)
- `get_profile_card`: arkadaş değilken `ovr/akt/tier` **null**; arkadaş
  olunca dolu
- Kullanıcı kendi kartına yazamıyor → `permission denied for table
  user_stats`
- `recompute_user_stats` başkası için çağrılamıyor →
  `permission denied for function`
- anon: `my_stats`, `user_stats` select → `false`

---

## FAZ S2 — GENÇLİG Kimlik Kartı bileşeni

**Telif notu:** tasarım tamamen özgün. Hiçbir oyunun ya da markanın kartı
taklit edilmiyor, hiçbir lisanslı görsel/logo/font kullanılmıyor. Düzen
(sol üstte genel puan, ortada portre, altta istat ızgarası) spor
kartlarının ortak dili; yüzeyler, renkler ve tipografi GENÇLİG'in v2
paletinden.

**Metalik yüzeyler CSS ile,** görsel varlık yok: açılı taban gradyanı +
üstten geçen dar parlaklık bandı (`::before`) + içeriden gölge
(`inset box-shadow`).

- Bronz: kahve-bakır
- Gümüş: gri-mavi metalik
- Altın: amber-sarı metalik
- **Özel:** koyu taban üzerinde mor→cyan→magenta holografik kayma.
  Animasyon yalnızca `background-position` oynatıyor (layout/paint
  tetiklemiyor), bu yüzden düşük güçlü telefonlarda da akıcı.
  `prefers-reduced-motion` altında duruyor.

İki boyut: `large` (profil) ve `mini` (arkadaş kartı modalı). İstat
değerleri 80+ ise vurgulu renkte.

---

## FAZ S3 — Profil merkezinde çevrilebilir kart

`/profil` en üstte kart, **ortalı**. Altında iki nokta göstergesi ve
"Ayrıntıları gör" düğmesi; dokununca 3D flip.

- **Ön yüz:** kimlik kartı
- **Arka yüz:** altı istatın bar gösterimi + her birinin **"nasıl artar"
  ipucu**, özet sayılar (görev / bildirim / arkadaş), kazanılan rozet
  ızgarası

İpuçları bilerek var: bir sayının neden düşük olduğunu bilmeyen kullanıcı
onu yükseltmeye de çalışmıyor.

Çevirme tekniği ödül ekranındakiyle **aynı** (`.flip-scene` /
`.flip-inner`, D22 FAZ R). Ayrı bir teknik, `prefers-reduced-motion`
davranışını iki yerde ayrı yönetmek demekti.

İstatlar hesaplanamadıysa kart hiç gösterilmiyor — boş bir kart "bozuk"
gibi duruyordu.

**Arkadaş kartı modalında** mini kimlik kartı; arkadaş değilse yalnızca
avatar + seviye + "Arkadaş ekle". Karar sunucuda (`get_profile_card`),
istemcide gizlemek veriyi zaten göndermiş olmak demekti.

Gizlilik sınırı **tek yerde**: ayrı bir "arkadaşın istatları" fonksiyonu
yazılmadı; iki fonksiyon olsaydı biri güncellenip diğeri unutulduğunda
sınır sessizce açılabilirdi.

---

## FAZ S4 — Seviye Yolu v2

Düz dikey liste **zigzag yola** dönüştü: düğümler sola-sağa alternatif
diziliyor, aralarındaki bağlayıcı çizgi ilerledikçe doluyor (geçilen kısım
mor→indigo gradyan, gelecek gri).

- **Geçilen seviye:** dolu halka, mor tonda, seviye numarası yazılı
- **Mevcut seviye:** büyük gradyan düğüm + nabız animasyonu
- **Gelecek seviye:** kesikli kenarlı gri düğüm, içinde kilit ikonu
- **Kilometre taşları:** o seviyede açılan rozet ve **ödül**ler düğümün
  yanında ikonlu çip olarak; ulaşılmamışsa "· burada açılır" eki
- **Mevcut seviyede** bir sonrakine ilerleme çubuğu ve "Seviye N için X XP"

**Nabız yalnızca `box-shadow` yayılımını oynatıyor.** `scale` denendi ve
elendi: düğümün boyutu değişince komşu düğümleri itiyor ve yol
kayıyordu. `prefers-reduced-motion` altında duruyor.

**Yeni tablo yok:** tamamı `levels` + `badges` + `rewards.min_level`
verisinden. Ödül kilometre taşları `min_level` ile doğrudan eşleşiyor;
`min_level = 1` olanlar dışarıda — seviye 1'de zaten herkese açık bir
ödülü "burada açılır" diye işaretlemek yanıltıcıydı.

Rozet eşleşmesi hâlâ yalnızca `xp_total` kriterli rozetlerde: diğer
kriterler (görev sayısı, kategori) XP'ye çevrilemiyor ve uydurma bir
eşleştirme kullanıcıya yanlış hedef gösterirdi.

### Kanıtlar (yerel dev sunucu, oturumlu)

`/profil` → 200. HTML'de:

```
kimlik kartı:  card-tier + card-tier-bronze, flip-scene, flip-inner,
               AKT / SOS / KEŞ, "İstat kırılımı", "Ayrıntıları gör"
seviye yolu:   "Seviye Yolu", node-pulse, "buradasın",
               "burada açılır" (3 ödül kilometre taşı), "Sıradaki duraklar"
```

**Dört kademe de doğrulandı.** Üretim koduna dev-only OVR override query
param'ı **eklemedim** — test arka kapısı canlıda kalma riski taşıyor.
Bunun yerine `user_stats.tier` doğrudan veritabanından değiştirilip sayfa
çekildi:

```
bronze  → card-tier-bronze   · etiket "Bronz"
silver  → card-tier-silver   · etiket "Gümüş"
gold    → card-tier-gold     · etiket "Altın"
special → card-tier-special  · etiket "Özel"
```
