# Gece Raporu 14 — DİLİM 33

**Dört yeni özellik: Günün Görevi + Görev Zincirleri + Davet Sistemi + Sezonlar**

Commit'ler: `a46b594` (GG), `9f15d85` (Z), `cd8d092` (DV), `e2eef1e` (SZ),
bu rapor (ZZ).

---

## 1. Ortak kural: idempotens deseni

Dört özelliğin dördü de puan yazıyor. Hiçbiri transaction tablosuna
kolon **eklemedi**. Her bonusun kendi **kapı tablosu** var:

```sql
insert into <kapı> (...) values (...) on conflict do nothing;
if not found then return; end if;   -- satır GERÇEKTEN girdiyse
<transaction yaz>
```

| özellik | kapı | birincil anahtar |
| --- | --- | --- |
| Günün Görevi | yok — mevcut tekil indeks | `submission_id` (tek satır, çift miktar) |
| Zincirler | `chain_awards` | `(chain_id, user_id)` |
| Davet | `referral_awards` | `invited_user_id` |
| Sezon rozeti | `user_badges` + `badge_awarded` | `(user_id, badge_id)` |

**Neden kolon değil kapı tablosu:** her yeni bonus için `xp_transactions`'a
kolon + kısmi tekil indeks eklemek tabloyu her özellikte genişletiyor ve
eski satırlarda `null` bırakıyordu. Kapı tablosu, "bu ödül bu kullanıcıya
verildi mi" sorusunu tek satırda ve birincil anahtarla cevaplıyor; iki
eşzamanlı tetik yarışsa bile yalnız biri geçiyor.

Ortak migration (`20260929000000_d33_common.sql`): `xp/coin_transactions`
reason check'lerine `'chain_bonus'` ve `'referral'`, `notifications.type`'a
`'chain_completed'` ve `'referral_reward'`, ve `istanbul_day()` yardımcısı.
Tek yerden — aynı check'i dört migration'da drop+recreate etmek, birinin
ötekini geri alması demekti (M20'de olmuştu).

---

## 2. FAZ GG — Günün Görevi

Günde bir görev vitrine çıkıyor ve o görevin **XP/Token ödülü iki katına**
çıkıyor.

- `daily_spotlight` (day birincil anahtar — bir günde tek görev, bunu şema
  garanti ediyor)
- Süper admin `/admin/gunun-gorevi`'nden bugün ya da yarın için sabitliyor
- Sabitlenmemiş gün: `pick_daily_spotlight()` **deterministik** seçiyor

**Çarpan teslimin TARİHİNE bakıyor, onayın tarihine değil.** Kullanıcı
görevi vitrin gününde yaptıysa hak ediyor; onayın üç gün sonra gelmesi
bunu değiştirmemeli.

**İdempotens değişmedi:** hâlâ tek satır yazılıyor, yalnız miktar iki
katı. Ayrı bir "spotlight bonusu" satırı yazmak, teslim başına tekillik
garantisini (`xp_transactions_task_submission_unique`) kaybettirirdi.

Denenen ve elenen:
- `random()` seçim → cron iki kez koşarsa günün görevi değişiyor ve 2x
  alan kullanıcı ile vitrinde görünen görev ayrışıyordu.
- Takım bonusunu da çarpmak → aynı gün takım görevi yapan ekibe dört kat
  avantaj (kişi başı 2x + bonus 2x).
- Belediyeye bağlı görevi vitrine almak → ülkenin geri kalanına
  erişilemez bir 2x vaadi.

---

## 3. FAZ Z — Görev Zincirleri

Zincir = birkaç görevlik seri. Hepsi tamamlanınca bonus, **bir kez**.

- `task_chains` + `chain_steps` + `chain_awards`
- `check_chain_completion` → `award_task_points`'in sonunda
- Örnek zincir: "Kültür Kaşifi" (3 adım, +150 XP / +100 Token)
- `/gorevler` üstünde şerit, `/zincirler/[id]` detay, `/admin/zincirler` CRUD

**Adım sırası zorunlu değil.** Kullanıcı adımları istediği sırayla
yapabiliyor. Zorunlu sıra denendi ve elendi — üçüncü adımı yanlışlıkla
önce yapanın ilerlemesi sayılmıyordu ve cezalandırıcı hissettiriyordu.
Arayüz yine de "Sıradaki" önerisi veriyor: üç eşit kart arasında karar
kullanıcıya kalırsa kimse karar vermiyor.

Adımsız zincir arayüzde **gizli** — "0/0" gösterip boş detay açmak,
yarım bir zincir sunmak olurdu.

---

## 4. FAZ DV — Davet Sistemi

- `profiles.invite_code` (8 karakter, tekil) + `referred_by`
- `referral_settings` (tek satır) + `referral_awards` (kapı)
- `apply_invite_code` + `check_referral_reward` → `award_task_points`

**Alfabe bilerek dar** (`ABCDEFGHJKLMNPQRTUVWXYZ2346789` — I/1, O/0, S/5
yok): kod sesli paylaşılıyor ve telefonda elle yazılıyor; karışan bir harf
desteğe düşen bir şikâyet demek.

**Ödül ilk onaylı görevde, kayıt anında değil.** Kayıt bedava, onaylı
görev değil.

**Kod akışta taşınıyor:** `/kayit?davet=KOD` → e-posta doğrulama →
`/onboarding`. Arada e-posta istemcisi olduğu için URL parametresi
kayboluyor; kod kayıt eyleminde **httpOnly çereze** yazılıyor (30 gün) ve
onboarding URL'de kod yoksa çerezden okuyor.

Denenen ve elenen: auth metadata (doğrulama öncesi kullanıcı yok),
`emailRedirectTo`'ya eklemek (Supabase yönlendirme beyaz listesi her
parametre kombinasyonunu kabul etmiyor).

Onboarding'de kod **isteğe bağlı** ve hatası akışı **kesmiyor**: yanlış
bir kod yüzünden kullanıcıyı kayıtta tutmak, asıl işi ikincil bir alana
rehin vermek olurdu. Hata sessizce yutulmuyor, günlüğe yazılıyor.

---

## 5. FAZ SZ — Sezonlar

- `seasons` + `active_season()` + `settle_season_badges()` + günlük cron
- Seed "Sezon 1": içinde bulunulan takvim çeyreği (Q3 2026)
- FUT kartın alt köşesinde ince şerit, sıralama başlığında ibare
- `/admin/sezonlar` CRUD

**Çeyrek seçildi:** ay çok kısa (rozet biriktirmeye vakit kalmıyor), yıl
çok uzun (sezon hissi kayboluyor). Üç ay, okul döneminin de doğal
uzunluğu.

**Aktif sezon TARİHE göre** çözülüyor, `status` etiketine göre değil:
status yöneticinin elle ayarladığı bir etiket ve unutulabiliyor.

**Rozet ölçütü düşük** (sezonda ≥1 onaylı teslim): bu bir başarı rozeti
değil **katılım** rozeti, "o sezonda buradaydım" diyor. Yüksek eşik
elendi — az kişide olan rozet koleksiyon hissi oluşturmuyor.

`criteria` tipi `'season'`: `check_and_award_badges` bu tipi tanımıyor ve
atlıyor, yani rozet yalnız sezon dağıtımından geliyor.

**VIP kart tasarımı bozulmadı:** 8 punto ince şerit, yalnız büyük kartta
(mini kartta 160px'te okunmuyor).

Sezon **silinemiyor** (bilerek): silmek, rozeti almış kullanıcıların
rozetini de yok ederdi.

---

## 6. İDEMPOTENS KANITLARI

Bu dilim bunlarsız kapanmıyordu.

| özellik | tetik sayısı | sonuç |
| --- | --- | --- |
| Günün Görevi | 2× `award_task_points` | 1 satır, 200 XP (tek miktar) |
| Zincir | 4 tetik (2× award + 2× doğrudan) | 1 satır, 150 XP, 1 kapı, 1 bildirim |
| Davet | 3 tetik (2× award + 1× doğrudan + 2. görev) | 1 satır, 100 XP, 1 kapı, 1 bildirim |
| Sezon rozeti | 3 koşu (biri bayrak **elle sıfırlanmış**) | 1 rozet, 1 bildirim |

Sezon testi iki savunma hattını da ayrı ayrı sınıyor: ikinci koşu
`badge_awarded` bayrağına takılıyor, üçüncüde bayrak elle sıfırlanıp
`user_badges` birincil anahtarının **tek başına** yettiği gösteriliyor.

---

## 7. Test sonuçları

| suit | sonuç |
| --- | --- |
| `daily_spotlight` | 8/8 |
| `task_chains` | 8/8 |
| `referrals` | 11/11 |
| `seasons` | 7/7 |
| `province_community_audit` | 12/12 |
| `task_day_window` | 10/10 |
| `leaderboard_rewards` | 5/5 |
| `stat_decay` | 7/7 |
| **toplam** | **68/68, sıfır hata** |

### RLS suiti — liste diff

D33 öncesi **30** beklenen hata, sonrası **33**. Fark tam olarak yeni
senaryoların beklenen hataları; **hiçbir eski satır kaybolmadı**:

```
> ERROR:  Bu işlem için yetkin yok.                                      (senaryo 37)
> ERROR:  new row violates row-level security policy for "chain_awards"  (senaryo 35)
> ERROR:  new row violates row-level security policy for "referral_awards" (senaryo 36)
```

Eklenen senaryolar:
- **35** — zincir kapısı: başkasının satırı gizli, client kapıya yazamıyor
- **36** — davet kapısı ve ayarları: ayar okunur/yazılamaz, kapıya yazılamaz
- **37** — vitrin ve sezon: okunur, yazılamaz; `set_daily_spotlight` yetki istiyor
- **38** — idempotens: üç kapının da birincil anahtarı ikinci satırı engelliyor

### Derleme ve canlı

`pnpm check:all` temiz (`tsc --noEmit`, `eslint .`, `next build`).

Canlı (giriş yapmış kullanıcı, dev sunucu) — tümü 200:
`/`, `/gorevler`, `/zincirler/[id]`, `/arkadaslar`, `/siralama`, `/profil`,
`/topluluk`, `/kesfet`, `/oduller`, `/onboarding`,
`/kayit?davet=KOD` (oturumsuz 200, oturumluda 307 — beklenen).

Süper admin — tümü 200: `/admin`, `/admin/gunun-gorevi`, `/admin/zincirler`,
`/admin/davet`, `/admin/sezonlar`, `/admin/gorevler`.
Yetkisiz kullanıcıda hepsi `NoAccess`.

---

## 8. Yol boyunca çıkan gerçek hatalar

Hepsi ölçümle bulundu, tahminle değil:

1. **Zincir seed'i iki adımda kalıyordu.** Yedek doldurma yalnız *hiç*
   adım yoksa çalışıyordu; iki kültür görevi olan bir veritabanında
   zincir 2 adımda kalıyordu. Artık üçe tamamlanıyor.
2. **Davet bloğu yanlış fonksiyona düştü.** `revalidatePath("/", "layout");
   redirect("/");` bitişi iki fonksiyonda aynı olduğu için yama
   `signOutAction`'a girdi. Derleme hatası yakaladı, taşındı.
3. **Senaryo 10 iddiam hatalıydı.** İşlem içinde `now()` sabit olduğu için
   `order by created_at desc limit 1` iki satırı ayırt etmiyordu ve 777
   yerine 100 dönüyordu. İddia "777'lik satır var mı" biçimine çevrildi.

---

## 9. AÇIK İŞ — bulut veritabanı hâlâ güncellenmedi

**Altı migration yerelde uygulandı ve test edildi, buluta itilemedi:**

| migration | içerik |
| --- | --- |
| `20260927000000_year_period_and_task_art.sql` | M30 (D32) |
| `20260928000000_task_day_window.sql` | M31 (D32) |
| `20260929000000_d33_common.sql` | reason/type check'leri |
| `20260929010000_daily_spotlight.sql` | Günün Görevi |
| `20260929020000_task_chains.sql` | Zincirler |
| `20260929030000_referrals.sql` | Davet |
| `20260929040000_seasons.sql` | Sezonlar |

Sebep, D32'dekiyle aynı: bu oturumda Supabase erişim anahtarı yok.

```
$ pnpm dlx supabase migration list --linked
Access token not provided. Supply an access token by running
`supabase login` or setting the SUPABASE_ACCESS_TOKEN environment variable.
```

**Yapılması gereken** (anahtar oturum ortam değişkeni olarak verilmeli,
repoya ya da `.env` dosyasına yazılmamalı):

```bash
export SUPABASE_ACCESS_TOKEN=...
pnpm dlx supabase migration list --linked   # önce farkı gör
pnpm dlx supabase db push                   # sonra uygula
```

**İyi haber:** D32'de eklenen `schema-guard` sayesinde uygulama bu
migration'lar olmadan **çökmüyor** — Günün Görevi bandı, zincir şeridi,
davet kartı ve sezon etiketi yalnızca **görünmüyor**. Kesinti yok,
özellik yok.

### pg_cron

Yerelde `pg_cron` kurulu değil (ölçüldü). Üç iş bulutta kurulacak:

| iş | saat (UTC) | Istanbul |
| --- | --- | --- |
| `genclig-daily-spotlight` | 21:05 | 00:05 |
| `genclig-season-settle` | 21:20 | 00:20 |
| `genclig-leaderboard-settle` | 21:10 | 00:10 |

Cron çalışmasa da sistem doğru işliyor: vitrin ana sayfa ilk açıldığında
tembel yolla seçiliyor, sezon rozeti `/admin/sezonlar`'daki düğmeyle elle
dağıtılabiliyor.

---

## 10. BORÇLAR

### Bu dilimde bilinçli bırakılanlar

- **Belediye zincirleri.** `task_chains.municipality_id` kolonu açıldı ama
  her zaman `null`. Belediye kullanıcı kümesi görev kümesinden farklı ve
  "kendi belediyemin zinciri" ile "ülke geneli zincir" aynı listede
  karışırdı. Kolon şimdiden duruyor ki o iş geldiğinde tabloya dokunmak
  gerekmesin.
- **Davet anti-abuse.** Cihaz/IP kontrolü **yok**. Tek fren, ödülün ilk
  onaylı göreve bağlı olması: sahte hesap açmak bedava ama onaylı görev
  yapmak değil. Sahada kötüye kullanım görülürse sıradaki adımlar:
  aynı IP'den gelen kayıtlarda gecikme, davet başına günlük tavan,
  şüpheli zincirlerin panelde işaretlenmesi.
- **Sezon bazlı sıralama dönemi ve sezon sonu büyük ödülleri.** Sezon şu
  an bir çerçeve; puan ekonomisine dokunmuyor. `PERIODS`'a `'season'`
  eklemek ve `period_start`'ı sezon tablosundan beslemek sonraki iş.

### D32'den devreden

52 ham `<button>` (yapısal), rozet kutlamasında rozet adı, SQL kaynaklı
yazımlarda push atılmaması, `redeem_reward` mesajındaki "coin", panel
arama kutusu, istatistik taban değeri, `/gorevler` kategori filtresi,
seviye yolu rozet kilometre taşları, gerçek zamanlı topluluk sohbeti,
Supabase bölge taşıma, panelde "Kullanıcı" yazması,
`rls_isolation.sql`'in yerel veritabanına satır bırakması.

---

## 11. Sabah turu — neye bakmalı

1. **Ana sayfa:** hero'nun altında altın çerçeveli **GÜNÜN GÖREVİ** bandı,
   "2X ÖDÜL" rozeti, gün sonuna geri sayım, ödül haplarında çift değer ve
   yanında üstü çizili normal değer.
2. **Görevler:** üstte **Zincirler** şeridi (ilerleme çubuğu + bonus
   rozeti). Vitrin görevinin kartında altın kurdele.
3. **Bir zincire gir:** ilerleme çubuğu, adım listesi, tamamlananda yeşil
   tik, sıradakinde mavi rozet. Üç adımı da bitirince kutlama pop-up'ı
   (bir kez).
4. **Arkadaşlar:** üstte davet kartı — büyük kod, kopyala düğmesi,
   paylaş düğmesi, ödül metni ayarlardan.
5. **Profil:** FUT kartın sağ alt köşesinde ince **SEZON 1** şeridi.
6. **Sıralama:** başlıkta Sezon 1 rozeti.
7. **Panel:** İçerik grubunda dört yeni giriş — Günün Görevi, Zincirler,
   Davet, Sezonlar.

**Not:** 1-7 arası maddelerin hepsi bulut migration'ı uygulanana kadar
**canlıda görünmez** (yerelde çalışıyor). Bkz. bölüm 9.
