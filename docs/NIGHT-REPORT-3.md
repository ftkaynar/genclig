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
