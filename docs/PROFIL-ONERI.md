# Profil ekranı — analiz ve öneriler

**Durum: yalnız ANALİZ.** Bu belge uygulama içermiyor; proje sahibi bir
seçenek seçtikten sonra ayrı bir dilimde uygulanacak. (D38 FAZ PA)

---

## 1. Bugün ne var — ölçüldü

390×844 telefonda `/profil` sayfası:

| blok | yükseklik | ne gösteriyor |
| --- | --- | --- |
| FUT kimlik kartı | ~400 px* | çevrilebilir kart: OVR, istat kırılımı, rozetler |
| Seviye + hızlı bağlantılar | 408 px | seviye halkası, XP sayacı, 6 bağlantı |
| Seviye Yolu | **555 px** | altı düğümlü dikey yol |
| Rozetlerim (3/7) | **516 px** | 3 sütunlu madalya ızgarası |
| İstatistiklerim | 110 px | tamamlanan görev sayısı |
| Son aktiviteler | 102 px | son üç işlem |

\* Kart yalnız `cardStats` varsa çiziliyor. Ölçüm kullanıcısında istat
yoktu, bu yüzden tabloda yok; kartlı hâlde sayfa daha da uzun.

**Toplam sayfa yüksekliği 1943 px = 2.3 ekran** (kartsız). Kartla
birlikte ~2.8 ekran. İçinde 6 bağlantı ve 7 düğme var.

### Ölçülen sorunlar

**a) Aynı bilgi dört yerde.** Seviye ve XP şu anda şurada:

1. Üst HUD — seviye rozeti + XP ilerleme çubuğu (her ekranda)
2. FUT kartın yüzünde — seviye
3. Seviye halkası — seviye + ilerleme + "X / Y XP"
4. Seviye Yolu — mevcut seviye ortada, XP eşikleri

Kullanıcı tek bir sayıyı öğrenmek için dört farklı gösterimden
geçiyor. Hiçbiri diğerinden fazla bilgi vermiyor.

**b) En büyük blok en az bilgi veren blok.** "Seviye Yolu" 555 px, yani
ekranın üçte ikisi. Taşıdığı bilgi: hangi seviyedeyim, sonraki
seviyeler ne. Bu, hemen üstündeki seviye halkasının söylediğinin
uzatılmışı.

**c) Gerçek veriler en dipte ve en küçük.** "İstatistiklerim" 110 px,
"Son aktiviteler" 102 px — ikisi toplam 212 px, yani Seviye Yolu'nun
%38'i. Kullanıcının fiilen ürettiği şey (görevler, işlemler) en az
yeri alıyor ve iki ekran kaydırma sonrasında görünüyor.

**d) Ayarlar ve çıkış profilin dışında.** `/ayarlar` ayrı bir sayfa ve
profildeki altı bağlantıdan yalnız biri. Çıkış yap orada, üçüncü
seviyede. Oysa mobil uygulamalarda hesap işlemleri profilden bir
dokunuş uzakta beklenir.

**e) Altı hızlı bağlantı, iki farklı iş yapıyor.** Arkadaşlar, Takımım,
Ödüller, Bildirimlerim → içerik ekranları. Destek, Ayarlar → hesap
işlemleri. Aynı ızgarada, aynı görünümde.

**f) Kartsız kullanıcı boş profil görüyor.** Yeni hesapta `cardStats`
yok → kart hiç çizilmiyor. Profilin merkezi olması gereken öğe, yeni
kullanıcıda hiç yok.

---

## 2. Karşılaştırma noktası — mobil oyun profillerinde ne var

Kavramsal olarak, iyi çalışan profillerde tekrarlayan üç desen:

- **Merkezde tek bir kimlik nesnesi** (kart, avatar, madalyon). Kimlik
  bir kez gösterilir, çoğaltılmaz.
- **Sekmeler**, sonsuz dikey akış değil. Rozet koleksiyonu ile
  istatistik ayrı sekmelerde durur; ikisini üst üste dizmek sayfayı
  uzatır ve ikisini de gömer.
- **Hesap işlemleri ayrı bir katmanda** (sağ üstten açılan menü/çekmece).
  Ayarlar, gizlilik, çıkış içerik akışına karışmaz.

---

## 3. Seçenekler

### Seçenek A — Sekmeli profil + sağ üst çekmece

Kart merkezde sabit kalır, altında dört sekme.

```
┌─────────────────────────────┐
│ Profil                  [☰] │  ← çekmece: ayarlar, gizlilik, çıkış
├─────────────────────────────┤
│        FUT KİMLİK KARTI     │  sabit, çevrilebilir
├─────────────────────────────┤
│ Genel │ Rozetler │ İstatistik │ Aktivite │
├─────────────────────────────┤
│ (seçili sekmenin içeriği)   │
└─────────────────────────────┘
```

- **Genel:** seviye halkası + ilerleme, dört hızlı bağlantı
  (Arkadaşlar, Takımım, Ödüller, Bildirimlerim)
- **Rozetler:** madalya ızgarası (bugünkü hâliyle)
- **İstatistik:** istat kırılımı + Seviye Yolu
- **Aktivite:** son işlemler, tam liste

**Artı:** sayfa 2.3 ekrandan ~1 ekrana iner; her bölüm kendi alanında
nefes alır; hesap işlemleri içerikten ayrışır.
**Eksi:** sekme = gizlenen içerik; rozetini görmek için kullanıcı bir
dokunuş daha yapar. Sekme durumu URL'de tutulmazsa geri tuşu şaşırtır.
**Maliyet:** orta. Çekmece yeni bir bileşen; sekmeler `?sekme=` ile
sunucu tarafında çözülebilir (istemci state'i gerekmez).

---

### Seçenek B — Tek akış, ama sıkıştırılmış ve sıralaması değişmiş

Sekme yok; bloklar küçültülüp yeniden sıralanıyor.

```
FUT kart → İstatistik + Aktivite (birleşik) → Rozetler →
Hızlı bağlantılar → Seviye Yolu (katlanır, varsayılan kapalı)
```

- Seviye halkası KALDIRILIR (HUD'da zaten var).
- Seviye Yolu katlanır bir bölüme iner (555 px → 48 px kapalıyken).
- İstatistik ve Son aktiviteler birleşir.

**Artı:** en ucuz değişiklik; sekme yok, gizlenen içerik yok; sayfa
~1.4 ekrana iner. Mevcut bileşenlerin hiçbiri yeniden yazılmaz.
**Eksi:** hâlâ tek uzun akış; ileride bölüm eklenince aynı noktaya
geri gelinir. Çekmece gelmediği için ayarlar/çıkış hâlâ ayrı sayfada.
**Maliyet:** düşük.

---

### Seçenek C — Çekmece + sıkıştırılmış tek akış (A ile B'nin arası)

Sekme yok ama sağ üst çekmece var; içerik B gibi sıkıştırılıyor.

- Sağ üst `[☰]` → Ayarlar, Profil bilgileri, Gizlilik, Destek, Çıkış
- Hızlı bağlantılar dörde iner (yalnız içerik ekranları)
- Seviye halkası kaldırılır, Seviye Yolu katlanır

**Artı:** hesap işlemleri doğru yere gider ve sayfa kısalır; sekmenin
"içeriği gizleme" sorunu yok. Sekmeye ileride geçilebilir.
**Eksi:** sayfa yine ~1.4 ekran; rozet ızgarası büyüdükçe (7 → 20
rozet) tekrar uzar.
**Maliyet:** düşük-orta.

---

### Seçenek D — Kart merkezli, "profil = kart" yaklaşımı

Profil neredeyse tamamen FUT karta indirgenir; kartın kendisi bilgi
taşır, altında yalnız iki şerit kalır.

```
┌─────────────────────────────┐
│ Profil                  [☰] │
├─────────────────────────────┤
│                             │
│      FUT KART (büyük)       │  ön yüz: kimlik + OVR
│      ← çevir →              │  arka yüz: istat + rozet + toplamlar
│                             │
├─────────────────────────────┤
│ Rozetler ▸   (yatay şerit)  │  → /profil/rozetler
│ Aktivite ▸   (son 3)        │  → /profil/aktivite
└─────────────────────────────┘
```

**Artı:** en güçlü kimlik hissi; kart zaten istat, rozet ve toplamları
taşıyor — tekrarın tamamı kalkar. Tek ekrana sığar.
**Eksi:** kart yoksa (yeni kullanıcı) profil boşalır — önce bunun
çözülmesi gerekir. Rozet ve aktivite ayrı sayfalara taşınır, yani iki
yeni route.
**Maliyet:** yüksek. FUT kart DOKUNMA listesinde; bu seçenek kartın
büyütülmesini ve yeni kullanıcı durumunu gerektirir.

---

### Seçenek E — Sekmeli + kart sabit başlık (A'nın "yapışkan" hâli)

A ile aynı, tek fark: sekme şeridi kaydırırken üste yapışır ve kart
küçülerek bir satıra iner (avatar + ad + seviye).

**Artı:** uzun rozet listesinde bile sekmeler erişilebilir kalır.
**Eksi:** yapışkan başlık + küçülen kart, alt gezinme ve HUD ile
birlikte ekranda dört sabit katman demek; 844 px'de içerik alanı
daralır.
**Maliyet:** yüksek.

---

## 4. Öneri

**Seçenek C** ile başlanması, sonra rozet sayısı arttığında **A**'ya
geçilmesi.

Gerekçe: ölçülen sorunların en ağır ikisi (aynı bilginin dört yerde
tekrarı ve 555 px'lik Seviye Yolu) sekme gerektirmeden çözülüyor.
Çekmece, ayarlar/çıkış için doğru yer ve sonradan sekme eklenirse
aynen kalıyor. Sekme, içeriği gizlemenin bedelini getiriyor; bu bedel
ancak sekme başına gerçekten dolu bir bölüm olduğunda (20+ rozet,
gerçek istat kırılımı, uzun aktivite listesi) karşılanıyor. Bugün 7
rozet ve 3 aktivite satırı var.

### C için sıra

1. Seviye halkasını kaldır (HUD'da var).
2. Seviye Yolu'nu katlanır yap, varsayılan kapalı.
3. Sağ üst çekmece: Ayarlar, Profil bilgileri, Gizlilik, Destek, Çıkış.
4. Hızlı bağlantıları dörde indir (içerik ekranları).
5. İstatistik + Son aktiviteler birleşsin, kartın hemen altına çıksın.
6. Kartsız kullanıcı için bir "kartını aç" durumu.

Adım 6 tek başına da değerli: yeni kullanıcının profili şu an boş.

---

## 5. Hangi öğe kaldırılmalı

Ölçüme dayalı, seçenekten bağımsız:

| öğe | karar | gerekçe |
| --- | --- | --- |
| Seviye halkası (`LevelRing`) | **kaldır** | HUD'daki halka + çubukla birebir aynı bilgi |
| Seviye Yolu | **katla** ya da İstatistik sekmesine al | 555 px, ekranın üçte ikisi, tekrar bilgi |
| "Ayarlar" hızlı bağlantısı | **çekmeceye** | hesap işlemi, içerik ekranı değil |
| "Destek" hızlı bağlantısı | **çekmeceye** | aynı |
| İstatistiklerim | **yukarı al** | gerçek veri, en dipte |
| Son aktiviteler | **yukarı al** | aynı |
| FUT kart | **kalsın, merkezde** | kimliğin tek taşıyıcısı (tasarımına dokunulmayacak) |

---

## 6. Ölçüm notu

Bu analizdeki bütün sayılar 390×844 telefon ölçüsünde, giriş yapmış bir
kullanıcıyla headless tarayıcıda ölçüldü. Tek istisna FUT kartın
yüksekliği: ölçüm kullanıcısının istatı olmadığı için kart çizilmedi ve
o satır tahminî (~400 px) olarak işaretlendi.
