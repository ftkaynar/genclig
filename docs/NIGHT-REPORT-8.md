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
