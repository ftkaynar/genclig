# Gece Raporu 15 — DİLİM 34

**Token kimliği + şerit temizliği + XP/Token belirginlik + sıralama takım kapsamları**

Commit'ler: `36de833` (TK), `796effd` (XP), `4e10f6c` (SH), `98d4b8d` (BD),
`87ad46c` (ST), bu rapor (Z).

Dilimin ortak derdi tekti: **aynı şey birden çok yerde ayrı ayrı
yazılmıştı.** Token 60 yerde, ödül hapları 6 yerde, bildir çağrısı 1
yerde (olması gereken 2), takım filtresi hiç. Beş fazın dördü bir
"tek kaynak" bileşeni çıkardı.

---

## 1. FAZ TK — Token görsel kimliği

**Ölçülen sorun:** Token 29 dosyada 60 yerde gösteriliyordu ve hepsi
aynı soluk reçeteyi tekrarlıyordu — `bg-coin/15` + `text-coin` +
lucide'ın düz `coins` çizgi ikonu. Koyu zeminde %15 opak sarı dolgu ile
ince çizgili bir ikon, para birimi gibi değil **etiket** gibi
okunuyordu. Oyunun ekonomisi olan şey, ekranın en silik öğesiydi.

**Tek kaynak:** `src/components/ui/token.tsx`

| parça | ne yapıyor |
| --- | --- |
| `TokenIcon` | özel SVG jeton: dış altın halka, koyu iç yüz, parıltı yayı |
| `TokenAmount` | altın gradyanlı sayı, `tabular-nums` |
| `TokenPill` | altın kenar + iç ışıltı |

**Jeton neden lucide değil:** lucide'ın `coins` ikonu bir *çizgi*
ikonu; para birimi ağırlığı taşımıyor. Kabartma iki katmanla: dış
halkada dikey gradyan (üstte açık, altta koyu), iç yüzde ters yönlü.
Tek düz daire denendi ve elendi — 14px'te "sarı nokta" gibi
görünüyordu.

**Sayı neden gradyan:** düz `#f5b301` koyu zeminde hardal gibi okunuyor
ve metal hissi vermiyor. `background-clip` desteklenmeyen tarayıcıda
düz altına düşüyor; hiçbir yerde görünmez metin kalmıyor.

**`tabular-nums` şart:** bakiye sayacı artarken rakam genişliği
değişiyordu ve HUD'daki sayı her güncellemede zıplıyordu.

**Grep kanıtı:** `name="coins"` kullanımı **0** (token.tsx hariç).

Kalan dört `bg-coin/15` eşleşmesi **Token gösterimi değil** — seviye
tacı halkası, FUT kart rozet çipi, admin denetim log tonu. Altın orada
aksan, para birimi değil; onlara dokunulmadı.

---

## 2. FAZ XP — ödül hapları tek bileşen

**Ölçülen sorun:** aynı iki hap (XP + Token) **altı** ayrı yerde altı
ayrı reçeteyle yazılıyordu:

```
task-tile.tsx        bg-xp / bg-coin, text-[10px], px-1.5
spotlight-band.tsx   bg-xp / bg-coin, text-[11px], px-2
chain-strip.tsx      bg-xp / bg-coin, text-[10px], px-1.5
zincirler/[id]       bg-xp / bg-coin, text-[11px], px-2
featured-task.tsx    XpPill / CoinPill  (bambaşka görsel dil)
task-card.tsx        XpPill / CoinPill
```

Ana sayfadaki "önerilen" şeridinde ve `/gorevler` ızgarasında haplar
diğer ekranlardakinden **soluk ve küçük** kalıyordu; aynı görev iki
ekranda iki ayrı değerde görünüyordu.

**Tek kaynak:** `src/components/ui/task-reward.tsx` —
`XpReward` (cyan gradyan), `TokenReward` (altın jeton), `TaskReward`
(ikisi + `strikeXp`/`strikeCoin` ile 2x), `TokenText` (hap olmayan
yerler).

**XP de dolgunlaştı:** Token altın olunca XP'nin aynı ağırlıkta olması
gerekiyordu — yoksa iki ödül aynı satırda farklı ligde görünüyordu.

**Boyut değişiyor, kimlik değişmiyor:** `sm/md/lg` yalnız dolgu ve
punto ayarlıyor; renk, ikon ve gradyan sabit.

**Ölçüm — üç yüzeyde aynı sınıf, XP ve Token eşit sayıda:**

| yüzey | `token-solid` | `xp-solid` |
| --- | --- | --- |
| `/` | 14 | 14 |
| `/gorevler` | 20 | 20 |
| `/kesfet` | 10 | 10 |

`XpPill` hâlâ kullanılan tek yer arkadaş/takım listelerindeki **haftalık
XP**: o bir ödül değil istatistik ve ödül hapı kadar bağırmamalı —
bilinçli bırakıldı.

---

## 3. FAZ SH — şerit solma maskeleri kaldırıldı

**Önceki durum:** `HScroll`'un iki kenarında 48px genişliğinde gradyan
katman vardı (`from-surface via-surface/80 to-transparent`). Amaç
"kesilen kart devam ediyor" demekti ama sonuç tersiydi: kartın kenarı
zemine karışıyor, kart **yarım ve soluk** görünüyordu. Ana sayfadaki
"Bugün için önerilen" şeridinde en görünür haliyle — son kart her zaman
soluk bir hayalet gibi duruyordu.

Kenar algısını zaten **ok düğmesi** taşıyor: taşma varsa ok var, yoksa
yok (D32 FAZ H'de ölçülüp düzeltilmişti). İki sinyal aynı şeyi
söylüyordu ve biri içeriği bozuyordu.

**Yan düzeltme:** `/gorevler`'deki tip çipleri ham bir
`overflow-x-auto` kabıydı — masaüstünde tarayıcının gri kaydırma çubuğu
görünüyordu ve taşmada ok yoktu, oysa aynı ekrandaki kapsam çipleri
zaten `HScroll` kullanıyordu. Tip çipleri de ortak bileşene geçirildi.

**Kanıt:** üç yüzeyde `fade=0`. Kalan tek `to-transparent` eşleşmesi
yorum metni.

Ok butonları yerinde (`h-scroll.tsx:127` ve `:138`) ve istemci
paketinde `scroll-arrow` sınıfı mevcut. **Oklar istemci tarafında
ölçümden sonra çiziliyor** (D32 kararı), bu yüzden sunucu HTML'inde
görünmüyorlar — curl ile ölçülemez, bileşen ve paket üzerinden
doğrulandı.

---

## 4. FAZ BD — "Şehrin için bildir" /gorevler'e eklendi

Ana sayfadaki CTA ortak bileşene alındı
(`components/home/report-cta.tsx`) ve `/gorevler`'de filtrelerin hemen
altına kondu.

**Neden orada:** "yapacak iş" arayan kullanıcı `/gorevler`'e gidiyor
ama listede yalnız yayınlanmış görevler var. Bildirmek de bir katkı ve
aynı ödül ekonomisine bağlı; ayrı bir ekranda saklı kalması,
uygulamanın sivil amacının en görünür yerde olmaması demekti.

**Kanıt:** `/gorevler` HTML'inde sıra ölçüldü — filtre 63049, CTA
64060, zincir şeridi 69007. CTA filtrelerin altında, zincirlerin
üstünde.

---

## 5. FAZ ST — takım sıralaması kapsam ve dönem alıyor (M33)

**Ölçülen sorun:** Bireysel sekmesi dört kapsamda ve üç dönemde
çalışıyordu; Takım sekmesinde kapsam çipleri **hiç
gösterilmiyordu** çünkü `leaderboard_teams` yalnız dönem alıyordu.
Aynı ekranın iki sekmesi iki ayrı derinlikte değerlendiriliyordu.

### Takımın kapsamı = kaptanın profil konumu

Denenen ve elenen alternatif: **üyelerin çoğunluk konumu**. Doğru sonuç
veriyor ama her satırda üyeler üzerinden bir mod hesabı gerektiriyor ve
beraberlikte (iki ilden ikişer üye) keyfi bir seçim yapmak zorunda
kalıyordu. Kaptanın konumu tek satırlık, belirsizliği yok ve
kullanıcıya açıklanabilir: **takımı kuran kişi takımın yerini
belirler.**

Kaptanın konumu eksikse takım yalnız Türkiye kapsamında görünüyor —
daraltılmış bir kapsamda konumsuz takımı göstermek, o ilin sıralamasını
kirletirdi.

### Mod ve kapsam artık iki ayrı eksen

`?mod=takim` + `?kapsam=il`. Tek parametrede taşımak, `"takimlar"`
değerinin hem modu hem alanı işgal etmesi demekti ve ikinci bilgiye yer
kalmıyordu.

**Eski bağlantılar çalışmaya devam ediyor:** `?kapsam=takimlar` takım
moduna + Türkiye kapsamına çevriliyor. Paylaşılmış ya da yer imine
eklenmiş bir URL'i kırmak, temiz bir parametre şeması uğruna ödenecek
bir bedel değil.

**Mod değişirken kapsam ve dönem korunuyor:** "ilçemdeki
bireyler"den "ilçemdeki takımlar"a geçmek artık tek dokunuş (önceden
Türkiye'ye düşüyordu).

Eski **tek parametreli imza DROP edildi**: bırakılsaydı PostgREST iki
aday arasında kalır ve "could not choose the best candidate function"
hatası verirdi (aynı belirsizlik M26'da ölçülmüştü).

### Yan düzeltme — yanlış tavsiye

Takım modunda İl kapsamı seçili ve kullanıcının ili yoksa liste boş
dönüyor ama ekran **"bir takım kur ya da kodla katıl"** diyordu. Sebep
konum eksikliği, takımsızlık değil. Konum uyarısı artık iki modda da,
listelerden önce.

---

## 6. Test sonuçları

| suit | sonuç |
| --- | --- |
| `team_leaderboard_scope` | **8/8** (yeni) |
| `daily_spotlight` | 8/8 |
| `task_chains` | 8/8 |
| `referrals` | 11/11 |
| `seasons` | 7/7 |
| `province_community_audit` | 12/12 |
| `task_day_window` | 10/10 |
| `leaderboard_rewards` | 5/5 |
| `stat_decay` | 7/7 |
| **toplam** | **76/76, sıfır hata** |

`team_leaderboard_scope` senaryoları: Türkiye üçünü görüyor, İl
daraltıyor (İstanbul takımı 0), İlçe daraltıyor, konumsuz kaptan İl
kapsamında yok, **dönem sonucu değiştiriyor** (hafta 500 / yıl 9500),
geçersiz kapsam ve dönem reddediliyor, tek imza kaldı.

### RLS suiti — liste diff

D33 sonrası **33**, D34 sonrası **33**. `diff` çıktısı **boş** —
liste birebir aynı. Bu dilim RLS'e dokunmadı; `leaderboard_teams`
security definer ve politikalara bağlı değil.

### Derleme

`pnpm check:all` temiz (`tsc --noEmit`, `eslint .`, `next build`).

---

## 7. Bulut push — M33

```
Would push these migrations:
 • 20260930000000_team_leaderboard_scope.sql
```

`Applying migration ...` ile uygulandı, hata yok.

**Doğrulama (anon REST):**

| çağrı | sonuç |
| --- | --- |
| `leaderboard_teams` + `p_period` + `p_scope` | **401** — var, yetki istiyor |
| `leaderboard_teams` + uydurma parametre | **PGRST202** — eşleşme yok |

İkisi birlikte yeni imzanın canlı, eskisinin gitmiş olduğunu
gösteriyor.

---

## 8. Canlı kontroller

**Üretim (genclig.vercel.app), oturumsuz — tümü 200:**
`/`, `/giris`, `/gorevler`, `/siralama`,
`/siralama?mod=takim&kapsam=il`, `/siralama?kapsam=takimlar` (eski),
`/arkadaslar`, `/profil`, `/oduller`.

**Yerel, giriş yapmış kullanıcı — beş tespitin beşi:**

| tespit | ölçüm |
| --- | --- |
| 1. Şerit | ana sayfa fade katmanı **0** |
| 2. Token | eski soluk stil **0**, altın hap **14** |
| 3. Sıralama | takım modunda alan filtresi **var** |
| 4. Bildir | `/gorevler` CTA **var** |
| 5. XP/Token | `/gorevler` xp=20, token=20 (eşit) |

Takım modu kapsam davranışı:

| URL | sonuç |
| --- | --- |
| `mod=takim&kapsam=turkiye` | takım görünüyor |
| `mod=takim&kapsam=il` | takım görünüyor (kullanıcının ili Ankara) |
| `mod=takim&kapsam=mahalle` | **"Konumun eksik"** uyarısı (mahalle yok) |
| `?kapsam=takimlar` (eski) | takım moduna düşüyor, alan filtresi var |

---

## 9. Sabah turu — neye bakmalı

1. **Ana sayfa:** Token bakiyesi HUD'da artık altın jetonlu ve gradyan
   sayılı. Hero altındaki Günün Görevi bandında ödüller dolgun altın/cyan.
2. **"Bugün için önerilen" şeridi:** kenarlardaki soluk perde gitti —
   son kart artık tam renkli. Taşma varsa yuvarlak ok görünüyor.
3. **`/gorevler`:** filtrelerin hemen altında "Şehrin için bildir"
   çağrısı. Kartlardaki XP/Token hapları diğer ekranlarla aynı ağırlıkta.
   Tip çipleri artık ok düğmeli şerit.
4. **`/siralama` → Takım:** kapsam çipleri (Türkiye/İl/İlçe/Mahalle) ve
   dönem hapları artık **çalışıyor**. Bireyselden takıma geçerken seçtiğin
   il korunuyor.
5. **Ödüller, profil, kuponlar:** Token her yerde aynı altın jeton.

---

## 10. Borçlar

### Bu dilimde eklenen

- `task-card.tsx` içindeki `TaskCard` ve `task-card-compact.tsx` **ölü
  kod** (yalnız bir yorumda adı geçiyor). Bu dilim görsel olduğu için
  silinmedi; bir sonraki temizlik diliminde gitmeli.
- `ReportCta`'daki ödül metni (`+25 XP • +10 Token`) **sabit**:
  `problem_reports` akışında değerler koda gömülü, ayar tablosundan
  gelmiyor. Değer değişirse tek yer o bileşen.
- Takım sıralamasında `RewardStrip` hâlâ **bireysel** ödül ayarlarını
  gösteriyor; takıma özel ödül ayarı yok.

### Devreden

Davet anti-abuse (cihaz/IP kontrolü yok), belediye zincirleri, sezon
bazlı sıralama dönemi ve sezon sonu büyük ödülleri, 52 ham `<button>`,
rozet kutlamasında rozet adı, SQL kaynaklı yazımlarda push atılmaması,
`redeem_reward` mesajındaki "coin", panel arama kutusu, istatistik taban
değeri, `/gorevler` kategori filtresi, gerçek zamanlı topluluk sohbeti,
Supabase bölge taşıma, panelde "Kullanıcı" yazması,
`rls_isolation.sql`'in yerel veritabanına satır bırakması.

### Güvenlik — açık kaldı

`docs/NIGHT-REPORT-2.md` içindeki veritabanı şifresi D33'te maskelendi
ama **git geçmişinde duruyor** ve depo GitHub'da. Şifrenin
döndürülmesi hâlâ şart (Supabase Dashboard → Project Settings →
Database → Reset database password).
