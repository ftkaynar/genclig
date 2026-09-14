# Gece Vardiyası 3 — DİLİM 22

## FAZ P — Performans

### P1 Ölçüm (önce)

**Canlı TTFB, Türkiye'den, rota başına 3 istek** (`curl -w %{time_starttransfer}`):

Oturumsuz:

```
/          632  529  518   ort 559ms  (200)
/gorevler 1613  664  769   ort 1015ms (200)
/profil    432  476  401   ort  436ms (307 — yönlendirme, DB işi yok)
/siralama  412  403  541   ort  452ms (307)
/oduller   478  423  356   ort  419ms (307)
/panel     529  409  462   ort  466ms (200 — yetkisiz ekranı)
```

Oturumlu (bulutta test kullanıcısı, aşağıda not var) — **asıl tablo bu**:

```
/          2292 2389 2316   ort 2332ms
/gorevler  1677 3716 1674   ort 2355ms
/profil    1875 1782 1636   ort 1764ms
/siralama  1532 1788 1587   ort 1635ms
/oduller   1719 1744 1604   ort 1689ms
/panel     1443 1186 1179   ort 1269ms
```

Oturumsuz 307'ler yanıltıcı: yönlendirme veritabanına hiç gitmiyor. Gerçek
durumu oturumlu tablo gösteriyor — **1.2 ile 2.4 saniye arası**.

### Kök sebep: bölge uyumsuzluğu

- **Supabase bölgesi:** `ap-southeast-2` (Sydney) — `supabase projects list`
- **Vercel fonksiyon bölgesi:** `iad1` (Virginia) — yanıt header'ı
  `X-Vercel-Id: fra1::iad1::…`. İlk alan edge PoP'u (Frankfurt), ikincisi
  fonksiyonun gerçekten koştuğu bölge.

Yani her Supabase sorgusu Virginia ile Sydney arasında gidip geliyor;
tek tur yaklaşık 250 ms.

### Sayfa başına tur sayısı (kod okunarak, kritik yol derinliği)

Sayfalar zaten `Promise.all` kullanıyor; sorun **paralellik değil, sıralı
önek**. Her sayfa `auth.getUser()` ile başlıyor ve içerideki yardımcılar
`getUser()`'ı **yeniden** çağırıyor (`listNotifications`,
`getSubmissionMap`, `rewards`, `problems`, `panel/guard`).

`/` ana sayfa kritik yolu:

```
1. middleware auth.getUser()          (edge fra1 → Sydney)
2. loadViewer auth.getUser()          (iad1 → Sydney)
3. profiles select                    sıralı
4. Promise.all(6) — en derin dal:
   4a. getUserPoints: 2 paralel + level_from_xp   → 2 tur
   4b. listNotifications: getUser + select        → 2 tur
5. getSubmissionMap: getUser + select             → 2 tur
```

Kritik yolda **~6 sıralı tur × 250 ms ≈ 1.5 sn**, üstüne middleware turu ve
derleme/işleme. Ölçülen 2332 ms ile örtüşüyor.

`auth.getUser()` çağrısı kod tabanında **22 ayrı yerde**; bir istekte
aynı kullanıcı için 3–4 kez ağ turu atılıyor.

### Not: buluttaki test kullanıcısı

Oturumlu ölçüm için bulutta `perfd22test@genclig.com` kullanıcısı açıldı,
e-postası doğrulandı ve profili tamamlandı. Mevcut satırlara dokunulmadı.
Ölçümler bitince silinecek (FAZ Z).

### P2–P7 Yapılanlar

- **P2 Bölge hizalama:** `vercel.json` → `"regions": ["syd1"]`. Fonksiyon
  veritabanının yanına taşındı.
- **P3 Sorgu paralelleştirme:** `src/lib/auth/viewer.ts` — React `cache()`
  ile `getViewerUser()` ve `getViewerProfile()`. 22 çağrı yerindeki tekrar
  eden `auth.getUser()` istek başına tek ağ turuna indi. Ana sayfa ve
  sıralama profil okumasını da paylaşıyor.
- **P4 Referans önbelleği:** `src/lib/reference/queries.ts` —
  iller/ilçeler/mahalleler/görev ve sorun kategorileri/seviyeler/rozetler
  `unstable_cache` ile 1 saatlik. Yönetici CRUD'ları `revalidateTag(…, "max")`
  ile anında tazeliyor.
  **Yol boyunca çıkan sorun:** `unstable_cache` içinde `cookies()`
  okunamıyor, `createClient()` ise okuyor. Çözüm: çerezsiz
  `createPublicClient()`. Bu tabloların hepsinin anon'a açık olduğu REST
  ile doğrulandı (8/8 tablo okunabiliyor). Kullanıcıya özel hiçbir sorgu
  bu önbelleğe konmadı — önbellek istekler arası paylaşıldığı için
  kişisel satır sızdırırdı.
- **P5 Algılanan hız:** 8 rotaya `loading.tsx` + gradyan shimmer iskeleti
  (`.skeleton`, `prefers-reduced-motion` altında duruyor). Alt gezinme ve
  üst bar iskelette de gerçek bileşen — veri gelince sayfa zıplamasın.
- **P6 İndeksler:** `20260917000000_indexes.sql`, 12 indeks; yerelde 12/12
  doğrulandı, buluta push edildi.
- **P7 Middleware:** matcher daraltıldı (font/css/js/map/json/robots/sw ve
  `/api/health` eklendi). Daha önemlisi: middleware HER istekte
  `auth.getUser()` çağırıyordu. Artık token'ın bitiş zamanı çerezden
  **yerelde** okunuyor ve ağa yalnızca token dolmuşsa ya da 120 sn içinde
  dolacaksa çıkılıyor.

### P8 Son ölçüm

Oturumlu TTFB, rota başına 3 istek, Türkiye'den:

```
rota        önce     P2 sonrası   hepsi sonrası   değişim
/           2332ms   1174ms       1067ms          -54%
/gorevler   2355ms   1402ms        966ms          -59%
/profil     1764ms   1519ms       1023ms          -42%
/siralama   1635ms   1063ms        733ms          -55%
/oduller    1689ms   1141ms        819ms          -51%
/panel      1269ms   1104ms        802ms          -37%
```

### Hedef tutturuldu mu — dürüst cevap

Hedef "oturumlular < 800 ms" idi. **Kısmen tutturuldu:** `/siralama` 733 ms
ile altında, `/panel` 802 ms ve `/oduller` 819 ms sınırda, `/`, `/gorevler`
ve `/profil` ~1 sn.

Kalanın neredeyse tamamı uygulama değil, fizik. Ölçüldü:

```
statik varlık (edge'den, fonksiyon yok)        ~310 ms
/api/health (dinamik rota, DB'ye hiç gitmiyor) ~590 ms
```

`/api/health` hiçbir veritabanı işi yapmıyor ve yine de 590 ms. Yani
**fonksiyon çağrısının kendi tabanı 590 ms** (Türkiye → Frankfurt edge →
Sydney fonksiyon). Sayfalarımız bu tabanın 150–480 ms üstünde çalışıyor;
optimize edilecek asıl kısım burası ve zaten büyük ölçüde alındı.

**syd1 doğru seçim mi?** Ölçümle evet. Alternatif fra1 (kullanıcıya yakın,
veritabanına uzak) olsaydı: ~310 ms taban + kritik yoldaki ~4 sıralı sorgu
× ~280 ms ≈ 1430 ms. syd1'deki ölçülen 1067 ms bundan iyi.

**< 400 ms'e inmenin tek yolu Supabase projesini Avrupa bölgesine taşımak.**
O zaman fonksiyon fra1'e döner, taban ~310 ms olur ve sorgular yerelleşir.
Bu bir proje taşıma işi (yeni proje + veri aktarımı + anahtar değişimi);
dilim kapsamında olmadığı ve DOKUNMA sınırına yakın olduğu için
yapılmadı — proje sahibinin kararı.

---

## FAZ N — Navigasyon + HUD

**Alt gezinme v2** (`src/components/user-bottom-nav.tsx`): beş sekme,
ortada Görevler yükseltilmiş gradyan daire olarak. Uygulamanın asıl eylemi
görev yapmak ve beş eşit sekme arasında kaybolmuştu. Aktif sekmede
`nav-glow` (iki katmanlı box-shadow) ve hafif büyüme; basınca
`group-active:scale` ile yay hissi.

Aktif/pasif ayrımı ikon kalınlığıyla: aktifte `strokeWidth 2.6`, pasifte
`1.9`. Ayrı bir "dolu ikon" kümesi taşımadan dolu hissi veriyor — lucide'ın
outline setine ikinci bir set eklemek bundle'ı iki katına çıkarırdı.

Altıncı sekme denendi ve elendi: 360 px genişlikte dokunma hedefleri parmak
genişliğinin altına iniyordu.

**Kalıcı HUD** (`src/components/user-hud.tsx`): solda kompakt seviye halkası
+ avatar (rozet olarak seviye sayısı), ortada ad ve ince cyan XP çubuğu
("… XP kaldı"), sağda altın coin hapı + çan + tema düğmesi. Oturumsuzda
"Giriş yap" hapı.

Dokuz ana ekrana bağlandı; alt ekranlar (ayarlar, bildirimler, bildir,
kuponlarım) eski `UserHeader`'da kaldı — HUD her ekranda tekrarlanınca
derinlik hissi kayboluyordu.

`loading.tsx` için ayrı `UserHudSkeleton`: gerçek HUD veri bekleyen async
bir sunucu bileşeni, yükleme ekranının kendisini bekletirdi. İskelet aynı
yüksekliği kaplıyor, veri gelince üst bar zıplamıyor.

**Buton dili** (`.btn-chunky`): 2 px koyu alt kenar, basınca
`translateY(2px)` + kenar sıfırlanıyor — gerçek bir tuş gibi içeri çöküyor.
25 dosyada 36 birincil butona uygulandı. Denenen ve elenen alternatif:
yalnızca `scale` küçültmek — dokunma geri bildirimi veriyordu ama "tuş"
hissi vermiyordu. `prefers-reduced-motion` altında geçiş ve dönüşüm kapalı.
