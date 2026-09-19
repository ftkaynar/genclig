# Gece Raporu 17 — DİLİM 36

**Görsel canlılık turu + keşfet konum/filtre + rozet 3D + FAB yerleşim +
rötuşlar**

Commit'ler: `6be7c2c` (D), `e05a810` (SP), `4f944c5` (FB),
`3022ec3` (TK / M35a), `b6379ad` (RZ), `e6753df` (HD),
`3de494e` (HR / M35b), `ef03daf` (ZR), `11c22b7` (KF / M35c),
`fa0446d` (CL), bu rapor (Z).

73 dosya, +1861 / −449 satır. Üç migration (M35a, M35b, M35c) buluta
gitti.

Bu dilimin çoğu "şu soluk görünüyor" ile başlayıp ÖLÇÜMLE bambaşka bir
yere varan işlerden oluştu. Dört yerde ilk teşhisim yanlıştı ve ölçüm
düzeltti; hepsi aşağıda açıkça yazılı.

---

## 1. FAZ D1 — keşfet "Konumum" kök sebebi

**Başarı yolu zaten çalışıyordu.** İzin verilmiş bir tarayıcıda düğme
kullanıcı noktasını koyuyor, haritayı 14 yakınlaştırmaya taşıyor ve
"Yakınındaki görevler" şeridini gerçek mesafelerle (529 m, 2.7 km,
4.8 km) açıyor. Yani tek bir kırık satır yoktu. Düğme **üç ayrı
sebeple** çalışmıyor gibi görünüyordu:

**1. Tek deneme, yüksek hassasiyet.** `enableHighAccuracy: true` +
`maximumAge: 0` + 15 saniye. Telefonda kapalı mekânda GPS kilidi çoğu
zaman bu süreye sığmıyor ve `TIMEOUT` dönüyor; kullanıcı "Konumun
alınamadı" görüp bir daha denemiyor. Artık iki aşama:

```
1. hassas   : enableHighAccuracy true,  8sn, önbellek yok
2. ağ tabanlı: enableHighAccuracy false, 20sn, 60sn önbellek kabul
```

Şehir ölçeğinde görev listelemek için baz istasyonu hassasiyeti
fazlasıyla yeterli.

**2. İzin reddinde yönlendirme yok.** Eski metin "Konum izni verilmedi.
Görevleri haritadan gezebilirsin." — doğru ama çıkışsız. Artık hata
koduna göre üç ayrı metin ve reddedilmişse izni nereden açacağı yazılı.

**3. Zaten reddedilmişse 8 saniye boşa bekleme.** Permissions API ile
önceden sorulup anında yönlendiriliyor. Ölçüm: 1503 ms.

Ayrıca güvenli bağlam (`isSecureContext`) kontrolü eklendi.

**Dördüncü sebep FAZ TK'de:** konum doğrulamalı 17 görevin 10'unda
koordinat yoktu. Konum gelse bile haritada görünecek görev yoktu.

**Yakındakiler şeridine 40 km sınırı.** Sınır **yoktu**: en yakın on
görev ne kadar uzakta olursa olsun "Yakınındaki görevler" başlığına
giriyordu. Ankara'daki kullanıcı İstanbul görevlerini "412.3 km"
etiketiyle yakın diye görüyordu. Ölçüm (Ankara koordinatı enjekte
edildi): şerit artık hiç açılmıyor, yerine sebebi söyleyen bir satır
çıkıyor.

---

## 2. FAZ D2 — FAB harita katmanı

**Ölçülen z-index ölçekleri:**

| katman | z-index |
| --- | --- |
| `.leaflet-map-pane` | 400 (üstelik `transform` taşıyor) |
| `.leaflet-popup-pane` | 700 |
| `.leaflet-control` | 800 |
| `.leaflet-top` / `-bottom` | 1000 |
| uygulama: HUD | 20 |
| uygulama: alt gezinme | 30 |
| uygulama: FAB | 40 |

Yani haritanın **her** katmanı sayısal olarak kazanıyor. Ölçümde harita
gövdesi FAB'ı örtmüyordu (ata zinciri sayesinde) ama bir pin'e
dokununca açılan **popup** örtüyordu:
`elementFromPoint(FAB merkezi)` → `div.leaflet-popup-content-wrapper`.

**Düzeltme tek satır:**

```css
.leaflet-container { isolation: isolate; }
```

Leaflet'in 200–1000 aralığı haritanın İÇİNDE anlamlı kalıyor, dışarıda
harita tek bir `z-index: auto` öğe gibi davranıyor. Tek tek z-index
ezmek denendi ve elendi: katman listesi sürüm sürüm değişiyor, elle
takip edilmesi gerekiyordu ve bir sonraki sürümde yeni bir pane sessizce
yukarıda kalırdı.

FAB `z-40` → `z-[45]`. Ölçek artık yazılı: HUD 20 < nav 30 < FAB 45 <
kip 50. **50 değil**, çünkü FAB bir diyaloğun üstünde yüzmemeli.

Ölçüm sonrası: popup açıkken `FAB_POPUP_ALTINDA: false` (önce `true`).

---

## 3. FAZ SP — açık marka arka planı

**Ölçülen sorun:** ikonlar `#0B1220` koyu lacivert zemine basılıyordu.
Logo ise sol altta koyu laciverte, sağ üstte yeşile giden bir gradyan.
Opak piksellerin en koyu %5'i (`#10223b`) ile o zemin arasındaki
kontrast:

| mürekkep | koyu zemin | açık zemin (#EEF1F8) |
| --- | --- | --- |
| en koyu %5 `#10223b` | **1.17:1** | 14.13:1 |
| ortanca `#06687a` | 2.91:1 | 5.68:1 |
| en açık %95 `#1cc084` | 7.96:1 | 2.08:1 |

Figürün **yarısı** kayboluyordu; geriye tek başına anlamsız bir yeşil
parça kalıyordu. Yeşil uç açık zeminde 2.08:1'e düşüyor ama o bir metin
değil büyük bir grafik işaret ve şekli koyu yarısı taşıyor — iki uçtan
birini feda etmek gerekiyorsa şekli taşıyan yarı korunur.

Yapılanlar:

- `generate-icons.mjs` düz renk yerine açık marka gradyanı çiziyor
  (`#EEF1F8` taban + mor ve cyan yumuşak ışıltı, SVG'den rasterleştirme).
  Tüm ikonlar, apple-touch-icon ve favicon yeniden üretildi.
- manifest `background_color` → `#EEF1F8` (Android açılış ekranı).
  `theme_color` **koyu kaldı**: o, açılış ekranının değil çalışan
  uygulamanın sistem çubuğunu boyuyor.
- `(auth)/loading.tsx` eklendi — grupta hiç yoktu, giriş/kayıt
  geçişinde ekran boş kalıyordu. Açık marka zemini + şeffaf logo.
- `viewport.themeColor` artık temaya göre. Tek sabit koyu değer vardı;
  panel ve admin açık temayla açıldığı için o yüzlerde sayfa beyaz,
  tarayıcı çubuğu koyuydu.

Canlı doğrulama: `background_color: #EEF1F8`, iki media-scoped
`theme-color` meta etiketi.

---

## 4. FAZ FB — FAB sağ ortada + kalıcı etiket

**Varsayılan konum sağ orta.** Sağ alt köşe ekranın en kalabalık yeri:
alt gezinme, "benim sıram" bandı, görev kartının ödül şeridi, gönder
düğmeleri. Dikey orta + sağ kenar hem baş parmağın rahat eriştiği yer
hem içerik akışının en seyrek noktası.

**Konum artık sessionStorage'da**, localStorage'da değil. Taşıma kararı
o anki ekrandaki bir engeli aşmak için veriliyor ("şu kartın üstünden
çekil"); kalıcı olunca kullanıcı haftalar sonra FAB'ı beklemediği bir
köşede buluyordu.

**Kalıcı etiket.** Bir kerelik ipucu kaldırıldı — yalnızca ilk
saniyelerde iş görüyordu, sonraki her ziyarette FAB yeniden "ne yaptığı
belirsiz altın daire" oluyordu. Etiket sürekli: "Ödül Mağazası",
alınabilir yeni ödül varsa "Yeni Ödüller!". Ok uçlu balon, 3.2 saniyede
bir hafif nabız, sürüklerken gizleniyor, sol kenara yapışınca sağa
açılıyor. "YENİ" hapı kaldırıldı: aynı köşede iki ayrı "yeni" işareti
belirsizlik yaratıyordu, kelime hapı yeniyor.

Ölçüm (390×844): `fabMerkeziY 422 == ekranOrtasiY 422`; sola
sürükleyince etiket sağa açılıyor ve ekran içinde kalıyor; sayfa
değişince konum korunuyor, oturum temizlenince sağ ortaya dönüyor;
`/kesfet`'te harita ile örtüşüyor ama altında kalmıyor.

---

## 5. FAZ TK — kurum/konum ikonları, süreklilik, konum backfill (M35a)

**Renkli ikonlar.** Kurum (bina) ve konum (pin) ikonları metinle aynı
soluk griydi; 10px'te gri bir bina ile gri bir pin ayırt edilmiyor,
satır tek bir gri lekeye dönüşüyordu. Kurum indigo `rgb(99,102,241)`,
konum cyan `rgb(34,211,238)`. Detay sayfasındaki pin de magenta'dan
cyan'a çekildi — aynı bilgi iki ekranda iki renkti.

**Süreklilik ayrı eksen.** Kartın alt satırı tek bir ya-o-ya-bu
zinciriydi ve "Sürekli" rozeti zincirin SON dalıydı: sürekli bir görev
"Bugün tekrar yap" durumuna geçtiği anda sürekli olduğu bilgisi
kayboluyordu. 06:00'da tik kalkınca kullanıcı aynı kartı bambaşka bir
görev gibi görüyordu. Hap "şu an ne yapmalıyım", rozet "bu görev
tekrarlanabilir mi" diyor. Artık yan yana.

Rozet ayrıca yalnız `type = 'continuous'` olduğunda çiziliyor — eski
zincirde tarihi olmayan HER görev son dala düşüyordu.

Ölçüm: aynı kartta hem "Bugün tekrar yap" hapı hem "Sürekli" rozeti;
aynı kartta hem yeşil tik mührü hem rozet.

### M35a — konum backfill

| ölçüm (migration öncesi) | değer |
| --- | --- |
| konum doğrulamalı görev (gps + photo_gps) | 17 |
| koordinatı olmayan | 10 |
| konum etiketi olmayan | 9 |
| yarıçapı olmayan | 10 |

Konum doğrulaması isteyen her üç görevden ikisinde doğrulanacak bir
konum yoktu. 16 satır dolduruldu; haritada görünen görev 7'den 16'ya
çıktı.

**İlk sürüm hatalıydı ve düzeltildi.** Her alanı bağımsız `coalesce`
ile dolduruyordu, yani koordinatı ZATEN OLAN ama etiketi olmayan
görevlere listeden bir ad yazıyordu. Ölçümde "Fethi Paşa Korusu,
Üsküdar" etiketi 40.9865/29.0254 (Kadıköy) koordinatının üstüne bindi.
Koordinatıyla çelişen bir etiket, etiketsizlikten daha kötü. Artık
yalnızca ikisi de boş olan satırlar dolduruluyor.

Koordinatlar gerçek ve herkese açık İstanbul mekânlarının **yaklaşık**
merkezleri, ölçülmüş giriş noktaları değil; yarıçap 150 m bunu tolere
edecek şekilde seçildi. Panel personeli düzeltebiliyor.

---

## 6. FAZ RZ — rozet madalyaları

**Ölçülen sorun:** rozet, kenarı yuvarlatılmış bir kareydi — rozetin
kendi tonunda %20 opak dolgu, içinde aynı tonda ince çizgili bir lucide
ikonu. Uygulamadaki her "renkli kutu içinde ikon" öğesiyle (kategori
çipi, durum hapı, HUD rozeti) tıpatıp aynı reçete. Oyunun en değerli
öğesi, en sıradan öğesiyle aynı görünüyordu.

**Beş katman**, her biri bir iş yapıyor:

| katman | işi |
| --- | --- |
| dış metal halka | kategori renginde eğik gradyan + üst/alt bevel |
| iç kenar çizgisi | halka ile diski ayıran ince ışık hattı |
| iç disk | koyu, merkezden dışa kararan; madalyanın oyulmuş yüzü |
| ikon | rozetin kendi ikonu, renkten beyaza açılmış tonda |
| cam parlaması | yalnız üst yarıda |

Cam parlamasını alt yarıya da koymak denendi ve elendi: iki yönden
gelen ışık hacmi düzleştirip çıkartmaya çeviriyor.

Kazanılan: kendi renginde çok yavaş hâle nefesi (3.4sn). Hızlı parıltı
denendi ve elendi — dokuz rozetlik ızgarada dokuz hızlı animasyon göz
yoruyordu. Kilitli: doygunluk 0.3 + parlaklık 0.74 + soğuk örtü + kilit.
Griye çevirmek (grayscale) denendi ve elendi: kategori tamamen
kayboluyordu.

Renk `--medal` değişkeninden, türevleri `color-mix` ile CSS'te. Sekiz
ton için sekiz sınıf seti yazmak denendi ve elendi: Tailwind literal
sınıf istiyor, 8 ton × 5 katman = 40 sınıf elle yazılacaktı.

Ölçüm: 7 madalya, dört iç katman da DOM'da, ızgara 56px / modal 88px,
yedi ayrı `--medal` değeri, kazanılan `genclig-medal-glow` çalışıyor,
kilitli `saturate(0.3) brightness(0.74)`. Ekran görüntüsüyle de
doğrulandı.

**FUT kart DOKUNMA listesinde**, bu yüzden kart arka yüzündeki
rozetlere dokunulmadı; `sm` varyant tanımlı ama orada bağlanmadı.

---

## 7. FAZ HD — üst şeritte "Token" kelimesi

Üst HUD dört öğeyi 390px'e sıkıştırıyor. "Token" kelimesi ~42px yiyor
ve ilerleme çubuğunu daraltıyordu. Altın jeton ikonu birimi zaten
söylüyor. `aria-label`'da duruyor; ödül ve profil ekranlarında kelime
kalıyor.

Ölçüm: HUD hapının metni `"0"`, aria-label `"0 Token, Ödüller'e git"`.

---

## 8. FAZ HR — sıra sayıları + trend okları (M35b)

**Parlak sayılar.** `#ffe9a8` → `#fff4d6` + kendi renginde ışıma.
Gradyan metin (`background-clip`) denendi ve elendi: sayı her karede
değişen bir sayaç, kırpma sayı genişledikçe kayıyor ve rakamlar
titriyordu.

**Trend oku.** Sayı tek başına yön taşımıyor: kullanıcı #412 görüyor ve
bunun iyiye mi kötüye mi gittiğini bilmiyor.

`rank_snapshots (user_id, scope, day, rank)` — birincil anahtar kapı:
aynı gün kaç kez açılırsa açılsın ilk yazım kalıyor, yani "önceki" her
zaman ÖNCEKİ BİR GÜNÜN sırası; gün içi dalgalanma ok üretmiyor.

- **localStorage denendi ve elendi:** cihaz değiştiren kullanıcı
  trendini kaybediyor ve istemcide tutulan "önceki sıra"
  değiştirilebiliyor.
- **Ayrı cron denendi ve elendi:** her kullanıcı için sıra hesaplamak
  gerekirdi (kullanıcı sayısıyla doğrusal iş), oysa trend yalnız ekranı
  AÇAN kullanıcı için lazım.

`rank_trends()` güncel sırayı `leaderboard_my_rank`'ten alıyor — kartla
aynı kaynak. OUT parametreleri `t_` önekli: `scope` ve `rank`
`rank_snapshots` sütunlarıyla çakışıyordu (D32 FAZ KE'deki belirsiz
`id` hatasının aynı sınıfı).

Yön ters sezgisel: sıralamada KÜÇÜK sayı iyidir, 12'den 5'e geçmek
yükseliştir. Çeviri SQL'de. Renk + ikon birlikte. İlk gün ok yok —
nötr çizgi "değişmedi" demek olurdu, oysa bilinmiyor.

Ölçüm: sayı `rgb(255,244,214)` + text-shadow; ilk gün ok yok; ertesi
gün üç yön de üretildi (yükseldi / değişmedi / düştü — sonuncusu rakip
kullanıcı eklenerek); aynı gün için kapsam başına tek satır.

---

## 9. FAZ ZR — /zincirler index

Bu route **hiç var olmamıştı**. Yalnız `/zincirler/[id]` vardı; zincire
ancak `/gorevler` üstündeki yatay şeritten girilebiliyordu. D35
kapanışında canlı curl 404 döndürmüştü.

Kart işaretlemesi `chain-strip.tsx` içinde gömülüydü; index aynı kartı
isteyince ikinci kopya gerekecekti. `ChainCard`'a çıkarıldı.

Sıralama: önce DEVAM EDENLER, sonra başlanmamışlar, en sonda
tamamlananlar. Alfabetik denendi ve elendi — bitirdiği zincir başa
geliyordu.

Şeride "Tümü" bağlantısı **dörtten itibaren**: üç kartın tamamı ekranda
görünürken "tümünü gör" demek aynı üç kartı ikinci kez göstermek olurdu.

---

## 10. FAZ KF — keşfet konum filtresi (M35c)

**Filtre bugünkü şemayla KURULAMIYORDU.** Ölçüm:

| ölçüm | değer |
| --- | --- |
| `tasks.municipality_id` dolu olan görev | 0 |
| `provinces` koordinat sütunu | yok (yalnız id, name) |
| `districts` koordinat sütunu | yok (id, province_id, name) |
| `tasks` üzerinde il/ilçe alanı | yok |

Filtre yazılsaydı her seçim boş liste döndürürdü — filtresizlikten
kötü. Denenen ve elenen üç yol:

1. `municipality_id` üzerinden gitmek. Sıfır dolu; üstelik belediye
   "kim açtı" sorusunu yanıtlıyor, "nerede yapılıyor" sorusunu değil.
2. Sorgu anında `location_label` metnini ilçe adıyla eşlemek. Serbest
   metin: "Fatih" ilçe adı ama "Fatih Sultan Mehmet Köprüsü" de
   eşleşirdi.
3. 81 il merkezi koordinatı + en yakın il. İstanbul'un iki yakası
   arasındaki mesafe, bazı komşu il merkezleri arasındakinden büyük.

**M35c:** `tasks.province_id` + `district_id`, kısmi indeks, geri
doldurma.

**Geri doldurmanın ilk sürümü de ölçümle elendi.** Etiket metninden
gitmek 16 koordinatlı görevden yalnız **3'ünü** yakaladı: M34a/M35a
etiketi `coalesce` ile yazmıştı ve "Muhtarlık", "Halk kütüphanesi" gibi
genel etiketlerde ilçe adı geçmiyor. Koordinat ise hepsinde bilinen bir
yer listesinden geliyor — **16/16** eşleşti, yedi ilçeye dağıldı.

Filtre seçenekleri **görevlerden** türetiliyor, referans tablolarından
değil: 81 il + 973 ilçeyi istemciye taşımak %98'i boş bir liste demekti
ve bu yolla seçilen her bölgede en az bir görev olduğu garanti.

Kısıt yok, varsayılan "Tüm bölgeler" — kendi bölgesine kilitlemek
keşfetmenin tersi. "Konumum" filtreyi sıfırlayıp haritayı kullanıcıya
taşıyor. Harita taşıma tek effect'e indirildi: iki ayrı effect denendi
ve elendi, "Konumum" hem konum verip hem filtre sıfırlayınca iki
`setView` ardışık koşuyor ve harita görünür biçimde zıplıyordu.

Ölçüm: yedi ilçe seçeneği; Kadıköy seçilince harita pinleri 15→6, şerit
kartları 32→7, harita 13 yakınlaştırmayla bölge merkezine taşındı;
"Tüm bölgeler"e dönünce 15 pin / 32 kart geri geldi.

---

## 11. FAZ CL — soluk renk taraması

**Tarama ölçümle yapıldı ve sonuç beklediğimin tersiydi.** Tema
tokenları zaten iyi:

| ölçüm | açık tema | koyu tema |
| --- | --- | --- |
| `ink` / kart | 17.34:1 | 15.73:1 |
| `muted` / kart | 7.10:1 | 6.97:1 |
| `muted` / zemin | 6.28:1 | 7.66:1 |

Kimlik kartındaki `text-white/55` bile 5.96:1. "Genel soluk"
şikâyetinin tek büyük kaynağı başkaydı:

| renk | koyu kart (#131c2e) |
| --- | --- |
| `#7c3aed` marka moru | **2.99:1** |
| `#6366f1` indigo | 3.81:1 |

2.99:1 küçük metin eşiği 4.5'in çok altında, ikon/büyük metin eşiği
3'ün bile altında. Uygulamada **68 `text-primary` + 13 `text-indigo`**
kullanımı var ve neredeyse tamamı bağlantı, küçük etiket ya da ikon.

**Çözüm: metin için ayrı, temaya göre token.**

| token | açık tema | koyu tema |
| --- | --- | --- |
| `--brand-ink` | `#7c3aed` (beyazda 5.70:1) | `#a78bfa` (kartta 6.26:1) |
| `--indigo-ink` | `#4f46e5` | `#818cf8` (kartta 5.71:1) |

Dolgular (`--color-primary`, `--color-indigo`) **değişmedi**: düğme
zemini olarak zaten doğru ve markanın rengi o. Tek sabit açık ton
denendi ve elendi — koyuda okunan `#a78bfa` beyaz kartta 2.72:1'e
düşüyor, sorun yer değiştiriyordu.

Ölçümle bulunan iki eşik altı nokta daha:

| kullanım | önce | yer |
| --- | --- | --- |
| `text-ink-muted/70` | 4.11:1 | admin kenar çubuğu bölüm etiketi |
| `text-ink-muted/60` | 3.37:1 | kupon / görev / bildir yer tutucuları |

Dördü de tam `muted`'e çekildi (6.97:1).

### Ekran-ekran değişiklik listesi

**Kullanıcı ekranları (11):** `/` (ana sayfa), `/gorevler`,
`/gorevler/[id]`, `/siralama`, `/profil`, `/bildirimler`,
`/bildir/gecmis`, `/zincirler/[id]`, `/kesfet`, `/oduller` (bileşen
üzerinden), `/takim` (bileşen üzerinden).

**Kimlik ekranları (3):** `/giris`, `/kayit`, `/kayit/dogrulama` —
"Hesabın var mı / yok mu" bağlantıları.

**Yönetim (3):** `/admin`, `/admin/siralama-odulleri`,
`/panel/gorevler`.

**Bileşenler (35):** announcement-composer, flip-card, chain-card,
chain-strip, chat-view, province-picker, discover-view, arrival,
announcement-banner, podium, scope-tabs, push-nudge, admin-sidebar,
audit-feed, chain-editor, coupon-form, icon-picker, inline-editor,
panel-shell, report-list, review-queue, task-form, report-form,
avatar-upload, badge-grid, level-path, redeem-panel, friends-view,
category-rows, task-filters, task-tile, team-view, form, bottom-nav,
user-hud.

**Değişikliğin türü:** hepsinde `text-primary` → `text-primary-ink`,
`text-indigo` → `text-indigo-ink`. Dolgu, kenarlık ve gradyan sınıfları
(`bg-primary`, `border-primary`, `brand-gradient`) 100 kullanımıyla
olduğu gibi kaldı.

### FUT kart — bronz çizgi

Bronz kademede OVR/kademe altındaki çizgi kaldırıldı. Çizgi **altın**
gradyanı (`rgb(212 160 44)`); altın/gümüş/efsanede çerçeveyle aynı
aileden ama bakır çerçevede (`#b07b4f → #7a4a24`) karşılığı olmayan
yabancı bir şerit. Çizgiyi bakıra boyamak denendi ve elendi: bakır
çerçevede görünmüyor, görünmeyen bir öğe için ikinci bir kural yazmış
oluyorduk. Kartın geri kalanına dokunulmadı.

Ölçüm: `.vipcard-bronze` + `.vip-rule` → `display: none`.

---

## 12. Test sonuçları

```
--- SIRALI HATA LISTESI ---
(boş)
--- SAYILAR ---
HATA: 0
GECTI: 64
ERROR: 60
```

D35 koşusuyla **liste diff'i**:

- HATA listesi: fark yok (iki koşuda da boş).
- GECTI listesi: **fark yok** — aynı 64 iddia geçti.
- ERROR 63 → 60. Fark: `rls_isolation.sql` içindeki üç
  `"Görev bulunamadı."` satırı. Sebep FAZ TK sırasında yapılan
  `db reset`: o test yerel veritabanına satır bırakıyor (bilinen borç)
  ve sıfırlamadan önce artık var olmayan bir görev kimliğine
  bakıyordu. Geçen iddia sayısı değişmediği için gerileme değil.

60 `ERROR` satırının hepsi testlerin **kasten** tetiklediği redler (RLS
politikası, `permission denied`, `Geçersiz dönem.`) ve bunları izleyen
"transaction is aborted" zincirleri.

`pnpm check:all` (types + lint + build): temiz.

---

## 13. Bulut push — M35a, M35b, M35c

Dry-run:

```
Would push these migrations:
 • 20261002000000_task_location_backfill.sql
 • 20261002010000_rank_snapshots.sql
 • 20261002020000_task_area.sql
```

Üçü de uygulandı. `db diff` çıktısında yalnız **pg_cron eklentisi ve üç
cron işi** var — yerel gölge veritabanında pg_cron kurulu olmadığı için
beklenen fark. `dropStatements: []`, şema sapması yok.

Bulut doğrulaması (IPv4 pooler üzerinden):

```
konum doğrulamalı görev / koordinatlı / bölgeli   16 / 16 / 16
ilçe dağılımı  Kadıköy 6, Fatih 4, Bakırköy 2, Beşiktaş 1,
               Sarıyer 1, Şişli 1, Üsküdar 1, bölgesiz 16
rank_snapshots tablosu                            var
rank_trends() fonksiyonu                          var
```

### ⚠ Veritabanı şifresi SIFIRLANMAMIŞ

Dilim "şifre reset sonrası yeni şifreyle" diyordu. **Eski şifre hâlâ
çalışıyor**: push'u D33'te verilen şifreyle yaptım ve bağlantı kabul
edildi. Yani `docs/NIGHT-REPORT-2.md` geçmişinde duran şifre hâlâ
geçerli.

Bu, D33'ten beri taşınan açık bir güvenlik borcu. Rotasyon:
Supabase Dashboard → Project Settings → Database → Reset database
password. Rotasyondan sonra Vercel ortam değişkenleri ve bir sonraki
push için yeni şifre gerekecek.

---

## 14. Canlı kontroller

`https://genclig.vercel.app` (commit `fa0446d`):

| yol | durum |
| --- | --- |
| `/` | 200 |
| `/karsilama` | 200 |
| `/giris` | 200 |
| `/kayit` | 200 |
| `/kesfet` | 200 |
| `/gorevler` | 200 |
| `/siralama` | 200 |
| `/zincirler` | **200** (D35'te 404'tü) |
| `/profil` | 200 |
| `/oduller` | 200 |
| `/manifest.webmanifest` | 200 |

- manifest: `background_color #EEF1F8`, `theme_color #0B1220`
- kimlik ekranlarında `bottom-nav` ve `reward-fab` **hiç yok** (üçünde
  de 0 eşleşme)

**Oturumlu canlı ekranlar yine üretimde doğrulanmadı** (D35'te olduğu
gibi: bulut anon anahtarı anonim indirilebilen paketlerde bulunamadı).
Aynı commit yerelde oturumlu ölçüldü ve bulut veritabanı doğrudan
sorgulandı.

---

## 15. Ölçüm yöntemine dair notlar

Bu dilimde **dört kez** ilk teşhis yanlıştı ve ölçüm düzeltti:

1. "FAB harita arkasında" — harita **gövdesi** FAB'ı örtmüyordu; örten
   şey **popup**'tı. z-index tablosunu okumadan "harita üstte" demek
   yanlış katmanı düzeltmeye götürürdü.
2. "Konumum çalışmıyor" — başarı yolu çalışıyordu; sorun zaman aşımı,
   yönlendirme eksikliği ve koordinatsız görevlerdi.
3. M35a konum etiketi — ilk sürüm koordinatla çelişen etiket yazdı,
   ölçümde yakalandı.
4. M35c bölge geri doldurma — etikten eşleme 16'da 3 yakaladı;
   koordinattan eşleme 16'da 16.

Ayrıca tarayıcı içi kontrast ölçüm betiğim yarı saydam `lab()`
zeminleri ayrıştıramıyor ve o örneklerde anlamsız oranlar (335:1,
702:1) üretti. Raporda yalnızca düz `rgb` zeminli okumalar kullanıldı.

---

## 16. Sabah turu — neye bakmalı

1. **PWA'yı ana ekrana ekleyip aç:** açılış ekranı artık açık zeminli
   ve logonun tamamı görünüyor olmalı. Ana ekrandaki ikon da öyle.
2. **`/kesfet`**: bölge seçiciden Kadıköy'ü seç — harita oraya taşınsın,
   pinler ve şeritler azalsın. "Konumum"a bas: filtre "Tüm bölgeler"e
   dönsün, harita sana gelsin. Bir pin'e dokun, popup açılsın ve
   **FAB popup'ın üstünde kalsın**.
3. **Konum izni kapalıyken "Konumum"**: hemen (beklemeden) izni nasıl
   açacağını söyleyen metin çıkmalı.
4. **FAB**: her yeni açılışta sağ ORTADA olmalı, yanında "Ödül
   Mağazası" balonu. Sürükle, kenara yapışsın, sayfa değiştir, kalsın;
   uygulamayı kapatıp aç, sağ ortaya dönsün.
5. **`/profil` rozetler**: madalyalar 3D görünmeli, kazanılanlar
   parlasın, kilitliler soluk + kilitli. Bir rozete dokun, modalda
   büyük madalya.
6. **FUT kart**: bronz kademede OVR/BRONZ altındaki altın çizgi
   olmamalı.
7. **Ana sayfa "Sıralaman"**: sayılar parlak. İlk gün ok olmayabilir;
   ertesi gün açtığında yanında ok çıkmalı.
8. **Üst şerit**: token hapında yalnız jeton + sayı, "Token" yazısı
   yok.
9. **`/zincirler`**: liste açılmalı, devam eden zincirler başta.
10. **Görev kartı**: kurum ikonu mor-indigo, konum ikonu cyan. Sürekli
    bir görevi bugün tamamla — kartta hem yeşil tik hem "Sürekli"
    rozeti görünmeli.

---

## 17. Borçlar

**Acil:**

- **Veritabanı şifresi hâlâ sıfırlanmadı** (bkz. bölüm 13). Eski şifre
  bu gece de çalıştı. `docs/NIGHT-REPORT-2.md` geçmişindeki değer
  geçerli olduğu sürece açık bir risk.

**Bu dilimden:**

- Oturumlu canlı ekranlar üretimde doğrulanmadı.
- **Yeni görevlerde bölge alanı boş kalacak**: M35c `province_id` /
  `district_id` sütunlarını ekledi ve geçmişi doldurdu ama panel görev
  formunda bu alanlar YOK. Personel yeni görev açtığında bölge
  yazılmıyor ve görev keşfet filtresine girmiyor. Panel formuna alan
  eklemek ayrı bir iş.
- 16 aktif görev hâlâ bölgesiz (koordinatı olmayan quiz/fotoğraf
  görevleri). Bu doğru: yeri olmayan göreve yer yazmadık.
- Rozet madalyasının `sm` (mini) varyantı tanımlı ama hiçbir yerde
  kullanılmıyor — FUT kart DOKUNMA listesindeydi.
- Rozet kutlama ekranı (`arrival.tsx`) hâlâ eski düz kutuyu ve
  `badge-earned` sınıfını kullanıyor; madalyaya geçmedi.
- Panel/admin koyu temaya alınırsa `app-header.tsx`'teki şeffaf logo
  koyu zeminde koyu mürekkeple kalıyor (FAZ SP'deki 1.17:1 sorununun
  aynısı, dar bir yüzeyde).
- Sezon ödüllerinin tembel yolu yok (D35'ten devam).

**Devam edenler:** ölü `TaskCard` / `task-card-compact.tsx`;
`ReportCta` ödül metni koda gömülü; davet kötüye kullanım önlemi yok;
belediye zincirleri yok; 52 ham `<button>`; rozet kutlamasında rozet
adı görünmüyor; SQL kaynaklı yazımlardan push gitmiyor; `redeem_reward`
DB mesajı "coin" diyor; yönetim arama kutusu devre dışı;
`rls_isolation.sql` yerel veritabanında satır bırakıyor;
`(user)/loading.tsx` ana sayfa şeklinde bir iskeleti yedi segmente
servis ediyor.

**Yerel veritabanı notu:** FAZ TK sırasında `pnpm db:reset` koşuldu
(M35a'nın hatalı ilk sürümü yerel veriyi kirletmişti). Ölçüm kullanıcısı
`d35check@example.com` yeniden kuruldu: bilinen parola, `super_admin`
rolü, 123 XP, tamamlanmış profil. Buluta gitmedi, migration'da yok.
