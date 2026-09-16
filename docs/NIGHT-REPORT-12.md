# Gece Vardiyası 12 — DİLİM 31 (sadece görsel)

Bu dilimde **yeni özellik, migration, RPC yok.** Fazlar: B (buton sistemi) ·
H (ana sayfa) · NAV (alt gezinme) · O2 (ödül netliği) · PR (profil +
tarama) · Z. Beş commit, hepsi `origin/main`'de.

---

## FAZ B — Tek buton sistemi

**Önceki durum:** 130 ham `<button className="...">` ve 39 dosyada
`btn-chunky`. Her ekran kendi dolgusunu, yarıçapını, gölgesini yazıyordu;
aynı önemdeki iki aksiyon iki ekranda iki türlü görünüyordu.

`components/ui/button.tsx` — `Button` + `ButtonLink`, beş varyant:

| Varyant | Yüzey |
|---|---|
| primary | Gradyan `#7C3AED→#6366F1`, iç parlak hat, `0 6px 16px` gölge |
| secondary | Koyu kart + 1.5px canlı indigo kenar (**soluk gri değil**) |
| gold | `#F5B301→#D97706`, koyu metin (altın üstünde beyaz okunmuyor) |
| danger | Kırmızı kenar + hafif zemin |
| ghost | Yalnız metin ama yine 40px dokunma alanı |

Hepsinde min 44px (sm 40px), radius 14px, `font-weight 700`, basınca
`translateY(1px) scale(.98)`, hover'da parlaklık +%8.

**Devre dışı buton okunur kalıyor:** opaklık `.55` + kilit ikonu. Silik
gri bir buton "bozuk" gibi görünüyor ve kullanıcı neden basamadığını
anlamıyordu.

### Geçiş — iki denemede

1. Düz regex yalnız tek satırlık gövdeleri yakaladı: 130'dan **9**.
2. Dengeli tarayıcı **93** dönüştürdü ama **fazla agresifti**: tema
   anahtarını, şerit oklarını, rozet kutucuklarını ve ikon seçici
   karelerini de aldı. Onlar CTA değil. **Geri alındı**, yapısal filtre
   eklendi (`h-N`/`w-N`, `flex-col`, `aspect`, `grid`, gövdesi yalnız
   ikon) ve tekrar koşuldu.

```
DONUSTURULEN:        72
ATLANAN yapisal:     32
ATLANAN sablon:       6   (toggle çip/sekme — stili duruma göre değişiyor)
ATLANAN diger:       14
```

Şablon `className`'liler bilerek dışarıda: tek varyanta indirgemek toggle
görünümünü yok ederdi.

---

## FAZ NAV — Alt gezinme kök sebebi

**Kök sebep iki parça, ikisi de ölçüldü:**

**1. `position: sticky` kullanılıyordu, `fixed` değil.**
Sticky öğe akışta kalıyor ve konumu kapsayıcısının yüksekliğine bağlı.
Kapsayıcılar `min-h-dvh`; iOS'ta URL çubuğu açılıp kapandıkça `dvh`
değişiyor, kapsayıcı yeniden ölçülüyor ve gezinme zıplıyor.

Tutarsızlığın ikinci kaynağı: `/topluluk` `h-dvh`, diğer 25 sayfa
`min-h-dvh` — farklı kapsayıcı, farklı davranış.

**2. `env(safe-area-inset-bottom)` kullanımı SIFIRDI** (grep: 0 sonuç).
Ana ekran çubuğu olan telefonlarda gezinmenin alt kenarı jest çubuğunun
altında kalıyordu.

**Düzeltme:**
```
nav: fixed inset-x-0 bottom-0 + pb-[env(safe-area-inset-bottom)]
     iç kapta mx-auto max-w-md (fixed öğe kapsayıcıdan çıkıyor)
.has-bottom-nav{padding-bottom:calc(57px + env(safe-area-inset-bottom))}
.above-bottom-nav{bottom:calc(85px + env(safe-area-inset-bottom))}
```

`.has-bottom-nav` 26 dosyada `<main>`'e eklendi. Tek yerde tanımlı — her
sayfaya ayrı `pb-` yazmak, birini unutunca son satırın gezinmenin altında
kalmasıyla sonuçlanıyordu.

Canlı doğrulama: `fixed inset-x-0 bottom-0` **VAR**, `sticky bottom-0`
**yok**.

---

## FAZ H — Ana sayfa

**Şerit okları.** Önceki ok kart zeminiyle aynı renkte kenarlı bir
daireydi ve şeridin üstünde yama gibi duruyordu. Artık yarı saydam koyu
daire + `backdrop-blur`: cam etkisi altındaki kartın devam ettiğini
gösteriyor. Opaklık `.75`, hover/dokunmada 1 — her zaman tam parlaklıkta
olsaydı içeriğin önüne geçiyordu. Kenar solması 8px→12px.

**XP çubukları altın.** HUD, hero ve profil seviye çubuğu
`.xp-track`/`.xp-fill`: `#F5B301→#FFD966`, uçta parlama noktası, koyu ray
`#1a2440`. Çubuk boşken uçtaki nokta havada kalıyordu — `data-empty` ile
gizleniyor.

XP **hapı ve sayısı cyan kaldı** (kimlik rengi); yalnız çubuk altın.
Rozet ilerleme çubuklarına dokunulmadı: her dolan çubuğu altın yapmak
XP'ye özel sinyali sıradanlaştırırdı.

**Sıralaman kartı.** Hızlı erişimin hemen üstünde, Türkiye / İl / İlçe üç
sütun, 30px açık altın (`#ffe9a8`) sıra sayısı, giriş anında yukarı
sayarak geliyor.

Sayaç yüksek sıralarda baştan saymıyor (#4213 için 4213 adım saçmaydı):
başlangıç hedefin en fazla 40 fazlası.

Eski blok (ilçe sırası + "arkadaş ekle" daveti) **kaldırıldı**: tek kapsam
"iyi miyim" sorusunun üçte birini yanıtlıyordu ve arkadaş ekleme daveti
burada yersizdi.

---

## FAZ O2 — Ödül uygunluk netliği

**Önceki sorun:** uygunluk tek satırlık bir metinle anlatılıyordu ve
kullanıcı hangi şartın eksik olduğunu ancak okuyarak öğreniyordu.

**Şart rozetleri yan yana:** `🪙 500 ✗ | Sv.3 ✓ | Rozet ✓`. İkon + renk +
işaret üçü birlikte — renk tek başına ayırt edici değil.

| Durum | Görünüm |
|---|---|
| Alınabilir | Altın nefes kenarı + "ALABİLİRSİN" rozeti + ışık süpürmesi |
| Alınamaz | `saturate-.35` + buzlu kilit katmanı + kırmızı eksik özeti |

Süpürme **yalnız** alınabilir kartta — her kartta olsaydı "bu özel"
sinyali kaybolurdu. Nefes 2600ms: ızgarada beş-altı kart aynı anda uygun
olabiliyor, hızlı nabız ekranı titretirdi.

**Bakiye şeridi (D30'dan borç kapandı):** bakiye + "N ödül hazır" + bir
alt satırda "150 Token sonra: Kahve Kuponu". Hedef yalnız **Token eksiği**
olanlar arasından seçiliyor — seviye/rozet eksiğini "biraz daha Token
topla" diye göstermek yanlış hedef verirdi.

AL butonu `gold` varyanta geçti ve uygunken nefes alıyor.

---

## FAZ PR — Ekran ekran tarama (zorunlu çıktı)

Tarama dört kusur sınıfı arıyor: SOLUK metin, KÜÇÜK hedef (<40px),
KENARSIZ tıklanabilir, GRİ ikon.

```
ilk koşu:  23 bulgu  (KENARSIZ 8, KUCUK_HEDEF 15)
son koşu:   9 bulgu  (hepsi yanlış pozitif)
```

### Ne değişti — ekran ekran

| Ekran | Değişiklik |
|---|---|
| **profil** | Altı kısayol kutucuğu gri ikon + gri metin + ince kenardı, hepsi pasif görünüyordu. İkon gradyan chip'te, metin tam kontrastta, hedef 64px. |
| **HUD** | "Giriş yap" → `ButtonLink`. Token hapı bir bağlantı ve 28px'ti → 40px. XP çubuğu altın. |
| **ana sayfa** | Sıralaman kartı eklendi, eski sıra bloğu kaldırıldı. "Şehrin için bildir" hero altına taşınmıştı (D30), tam gradyan CTA. XP çubuğu altın. |
| **Keşfet** | Kategori çipleri ve "Konumum" 40px + `press-soft`; "Konumum" gri kenardan canlı indigo kenara. Şerit okları cam. |
| **ödüller** | Şart rozetleri, buzlu kilit, altın parlama, bakiye şeridi (yukarıda). |
| **sıralama** | Yapışkan bant `above-bottom-nav`'a geçti (güvenli alan). |
| **destek** | SSS satırı kenarsızdı → `press-soft` + yuvarlak köşe. Yanıt/kapat butonları `Button`. |
| **topluluk** | Sohbet menüsündeki kenarsız butonlar 40px + `press-soft`. |
| **alt gezinme** | `fixed` + güvenli alan; sekme `min-h-48`. |
| **admin özet** | "Tüm denetim izi" ve bekleyen iş rozeti 40px, gri kenardan canlı indigo kenara. |
| **panel** | Çip ve düğmeler (panel-shell, report-list, task-status-controls, inline-editor, archive-controls, level-editor, gorevler) 40px. |
| **level-editor** | Sayı girdisi `py-1`'di (28px) → 40px. |
| **72 dosya** | Butonlar `Button`/`ButtonLink` bileşenine geçti. |

### Kalan 9 bulgu — hepsi yanlış pozitif

- 4× `brand-gradient` ikon chip'i (profil, keşfet, öne çıkan görev, admin
  sidebar) — tarayıcı `brand-gradient`'i stil saymıyor ama bunlar zaten
  gradyan zeminli.
- 3× tıklanabilir kartın **içindeki** metin (arkadaşlar ×2, HUD) — kap
  zaten stilli.
- 1× admin sidebar kapatma düğmesi (ikon butonu, hover'ı var).
- 1× alt gezinme sekmesi (artık `min-h-48`; tarayıcı hâlâ `py-1` görüyor).

Tarayıcı scratchpad'de tutuldu, repoya girmedi: tek seferlik bir denetim
aracı ve her derlemede koşması gereken bir şey değil.

---

## FAZ Z — Kapanış

### Migration YOK

```
git log --name-only son 6 commit | grep supabase/migrations  ->  0
```

### RLS suite

```
D30: 30 | D31: 30 | diff: FARK YOK
```

Beklenen: bu dilim yalnız görsel, DB'ye hiç dokunulmadı.

### check:all

`check:types`, `check:lint`, `check:boot` — üçü de temiz.

### Canlı doğrulama (gerçek süper admin oturumuyla)

```
/            200 | Sıralaman, xp-fill, has-bottom-nav, Şehrin için bildir
/oduller     200 | şart rozeti "Sv.2/Sv.3/Sv.4 Rozet" VAR
                   buzlu kilit (backdrop-blur-[2px]) VAR
                   desatüre (saturate-[.35]) VAR
/kesfet      200 | scroll-arrow, scrollbar-none
/profil      200 | press-soft ×14, gradyan chip ×12, xp-fill VAR
/siralama    200 | above-bottom-nav, Zirve

nav fixed mi:            EVET
sticky bottom-0 kaldı mı: hayır (doğru)
ana sayfa xp-track:      4
```

`/oduller`'de `reward-ready` ve "ALABİLİRSİN" görünmüyor — **doğru
davranış**: süper adminin 60 Token'ı var ve üç ödülün üçü de seviye
eksiğiyle kilitli. Kilit katmanı ve şart rozetleri görünüyor.

---

## Sapmalar

1. **52 ham `<button>` elde kaldı** (32 yapısal + 6 şablon + 14 diğer).
   Yapısal olanlar ikon butonu, rozet kutucuğu ve ızgara hücresi; şablon
   `className`'liler toggle çip/sekme. İkisini de `Button`'a çevirmek
   görünümlerini bozardı. Direktifteki "ham `<button class>` kalmadı"
   hedefi bu yüzden tam karşılanmadı — gerekçesi yukarıda.
2. **Tarayıcı repoya girmedi.** Tek seferlik denetim aracı.

---

## Sabah turu

1. **Telefonda alt gezinme:** sayfayı yukarı-aşağı kaydır, sekmeler
   kımıldamamalı. Ana ekran çubuğu olan bir telefonda sekmeler jest
   çubuğunun üstünde durmalı.
2. **Ana sayfa:** "Sıralaman" kartındaki üç sayı yukarı sayarak gelmeli.
   XP çubuğu altın ve ucunda parlayan nokta olmalı.
3. **Ödüller:** şart rozetlerine bak (`🪙 500 ✗ | Sv.3 ✓`). Kilitli
   kartlar buzlu ve soluk olmalı. Üstte "N Token sonra: X" satırı —
   Token biriktikçe değişmeli.
4. **Butonlar:** herhangi bir ekranda birincil butona bas; çökme hissi
   ve gölge değişimi olmalı. Devre dışı bir butonda (ör. uygun olmayan
   ödülde AL) kilit ikonu görünmeli, silik gri olmamalı.
5. **Keşfet:** şeritlerin kenarındaki cam oklara bas, yumuşak kaymalı.
   Kaydırma çubuğu hiçbir yerde görünmemeli.
6. **Profil:** altı kısayol kutucuğunun ikonları renkli chip'te olmalı.

---

## Açık borçlar

- 52 ham `<button>` (yapısal/toggle) — bilinçli, yukarıda.
- Rozet kutlamasında rozet adı (D30 borcu).
- Push SQL kaynaklı işlemlerde yok (pg_net gerekir).
- `redeem_reward` DB hata mesajı hâlâ "coin".
- Admin üst şeridindeki arama kutusu devre dışı.
- İstat taban hesabı her yazımda satır içi.
- `/gorevler`'de kategori filtresi yok.
- Seviye Yolu rozet taşları yalnız `xp_total` kriterli rozetlerde.
- Gerçek zamanlı topluluk sohbeti (30 s yoklama).
- Supabase'i Avrupa bölgesine taşımak (<400 ms TTFB).
- Belediye personeli `profiles` okuyamadığı için panelde adlar
  "Kullanıcı" görünüyor.
