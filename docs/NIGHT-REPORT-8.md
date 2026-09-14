# Gece Vardiyası 8 — DİLİM 27

## FAZ K — Kimlik Kartı yeniden (VIP)

Kart baştan yazıldı. **Tasarım tamamen özgün:** hiçbir oyunun, markanın ya
da lisanslı ürünün kartı taklit edilmiyor; dış görsel, logo ya da ticari
font kullanılmıyor. Form bilerek **yuvarlak köşeli dikdörtgen** (kalkan
silueti değil), en-boy 100/142, köşe yarıçapı 20 px.

### Katman sistemi

| Katman | Ne yapıyor |
|---|---|
| `vipcard-frame` | Çok duraklı metal kenar, `background-size: 300%` ile akan |
| `vipcard-hololine` | Çerçeve içinde ince cyan-mor-magenta hat (maskeyle yalnız kenar) |
| `vipcard-bg` | Koyu radyal zemin `#2a1a4d → #150e30 → #0a0618 → #050210` |
| `vipcard-rays` | Avatar arkasından konik ışın patlaması, nefes alan |
| `vipcard-glow` | Merkez mor hale (efsanede güçlü) |
| `vipcard-texture` | Eğik ince çizgi deseni, opacity 0.09 |
| `vipcard-sweep` | Üstten geçen ışık süpürmesi |
| `vipcard-float` | Kartın ±6 px yüzmesi |

**Performans:** animasyonların hepsi yalnızca `opacity`, `transform` ya da
`background-position` oynatıyor — hiçbiri layout ya da paint tetiklemiyor.
`prefers-reduced-motion` altında hepsi duruyor; süpürme ayrıca tamamen
gizleniyor, çünkü duran bir parlaklık lekesi tuhaf duruyordu.

### Kademe yoğunlukları (ölçüldü)

```
kademe   çerçeve           ışın  hale  süpürme  holo-hat  yüzme  etiket
bronze   vipcard-bronze     0     0      0         0        0    BRONZ
silver   vipcard-silver     0     1      0         0        0    GÜMÜŞ
gold     vipcard-gold       1     1      0         1        1    ALTIN
special  vipcard-gold       1     1      1         1        1    EFSANE
```

Bronz mat: çerçevede akış animasyonu bile yok. Yoğunluk kademeyle
kademeli artıyor — dördü aynı iskeleti paylaşıyor.

### Yerleşim

- **Tepe:** amblem dairesi + harf aralıklı altın "GENÇLİG"
- **Sol sütun:** dev OVR (metal gradyan yazı) → kademe etiketi (üst/alt
  ince çizgi arasında; altın ve efsanede holografik) → Türkiye bayrağı
  (altın çerçeveli, **saf SVG**, dış varlık yok) → ilçe adı
- **Merkez-sağ:** avatar dairesi (yoksa mor-cyan gradyan + baş harf),
  köşesinde "SEVİYE N" madalyonu
- **Orta:** kullanıcı adı — serif, `letter-spacing 4.5px`, altın gradyan,
  üstünde ve altında kenarları saydama giden ince altın ayraç.
  **Süs ikonu/elmas yok** — çizgi tek başına daha asil.
- **Alt:** 6 istat 2×3, her biri büyük metal sayı + kısaltma + ince
  dolan cyan-mor bar; ortada dikey ayraç

**Altın gradyan yazı** `background-clip: text` ile. Düz altın renk
denendi ve elendi: metal hissi vermiyordu.

**Kartta yalnızca ilçe** gösteriliyor; il adı bayrakla zaten örtülü ve iki
satır dar sütunda taşıyordu.

### Kanıt

`/profil` oturumlu çekildi, `user_stats.tier` dört değere tek tek
çevrildi; yukarıdaki tablo HTML'deki sınıf sayımlarından. **Üretim koduna
dev-only tier override query param'ı eklenmedi** — test arka kapısı
canlıda kalma riski taşıyor.

---

## FAZ P — Profil çevrilebilir kart

D26'daki flip korundu, yeni karta hizalandı:
- Sahne genişliği 280 → **300 px** (kartın yeni genişliği)
- Arka yüz en-boyu 3/4.2 → **100/142**; uyuşmadığında çevrilince yükseklik
  zıplıyordu

Ön yüz VIP kart, arka yüz altı istatın bar kırılımı + "nasıl artar"
ipuçları + özet sayılar + rozet ızgarası. Altında ön/arka nokta
göstergesi ve "Ayrıntıları gör" düğmesi.

---

## FAZ R — Rozet görünürlüğü

**Önceki sorun ölçüldü:** kilitli rozette rozetin **kendi ikonu yerine**
kilit ikonu gösteriliyordu (`name={badge.earned ? badge.icon : "lock"}`).
Kullanıcı neyi kazanacağını göremiyordu ve bütün kilitliler birbirinin
aynısıydı.

**Yeni davranış:**
- **Kazanılan:** altın tonda dolu, `badge-earned` parıltısı, altında
  kazanım tarihi
- **Kilitli:** **kendi ikonu duruyor** — soluk ama seçilebilir netlikte —
  ve sağ alt köşesine küçük kilit rozeti biniyor; altında kriter metni ve
  varsa ilerleme çubuğu + "3/10"

**İlerleme hesabı** `getBadges` içinde: `total_tasks`, `category_tasks`,
`problem_reports`, `xp_total` kriterleri için sayaçlar **tek seferde**
toplanıyor — her rozet için ayrı sorgu, rozet sayısı kadar veritabanı turu
demekti. Tanınmayan kriter tipinde ilerleme `null`; uydurma bir oran
göstermek yerine hiç göstermemek doğrusu.

**Rozet detay modalı:** ad, açıklama, "Nasıl kazanılır", ilerleme ya da
kazanım tarihi, rozet ödülü.

### Kanıt

`/profil` HTML'inde **yedi rozetin de kendi ikonu** render ediliyor:

```
sparkles 1 · tree-pine 1 · landmark 1 · users 2 · book-open 1
megaphone 2 · trophy 4
```

Kilit ikonları ayrıca var (`lucide-lock`), yani ikonun **yerine** değil
**üstüne** biniyor. Kriter metinleri ve ilerleme sayıları HTML'de:
"1 görev tamamla", "10 görev tamamla", "5 görev tamamla"…

---

## FAZ T — Coin → Token (yalnızca görünen metin)

**Kod ve veritabanı DEĞİŞMEDİ:** `coin_transactions`, `coin_cost`,
`coin_bonus`, `total_coin`, RPC adları, değişken adları, `text-coin`
sınıfları — hepsi aynen duruyor. Migration açılmadı.

Değişen yerler: bakiye barları, HUD hapı, ödül maliyetleri, satın alma
onayı ("500 Token harcanacak"), eksik bakiye çipi ("120 Token daha"),
görev ödül hapları, quiz sonuç ekranı, bildir sayfası, kuponlarım boş
durumu, profil bakiye etiketi, panel/admin form etiketleri ("Token
bedeli", "Token bonusu", "Takım bonusu Token"), admin hata mesajı.

**`CoinPill`'e `unit` seçeneği eklendi.** Dar yerlerde (görev kutucuğu
ızgarası, kompakt kart) "Token" metni kutucuğu taşırıyordu; orada ikon
zaten birimi anlatıyor, birim yazısı kapatıldı. Geniş yerlerde açık.

### Veritabanı mesajı — sapma ve gerekçe

`redeem_reward` fonksiyonunun hata mesajı veritabanında
**"Yeterli coin'in yok…"** diyor ve bu kullanıcıya görünüyor. Kalıcı
düzeltme migration gerektiriyor, migration ise bu dilimin DOKUNMA
listesinde.

Çözüm: metin gösterilmeden hemen önce eylem katmanında çevriliyor
(`error.message.replace(/coin/gi, "Token")`). Kalıcı çözüm — mesajı
migration'da değiştirmek — bir sonraki şema dilimine **borç** yazıldı ve
kod içine yorumla not düşüldü.

### Kanıt (yerel dev sunucu, oturumlu)

```
rota        "Token" geçişi   kullanıcı metninde "Coin"
/oduller         12                    0
/profil           6                    0
/                10                    0
```

Kodda kalan `coin` geçişlerinin hepsi kod tanımlayıcısı, yorum ya da
lucide ikon adı (`coins`) — kullanıcı metni değil.
