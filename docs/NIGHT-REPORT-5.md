# Gece Vardiyası 5 — DİLİM 24

## FAZ T — Teşhis: süper admin inceleme görünürlüğü

### Ölçüm (düzeltmeden önce)

`/admin/incelemeler` → `listPendingReviews(null)`
`/panel/incelemeler` → `listPendingReviews(context.municipalityId)`

`listPendingReviews` içinde:

```ts
query = municipalityId === null
  ? query.is("tasks.municipality_id", null)   // ← yalnızca GLOBAL görevler
  : query.eq("tasks.municipality_id", municipalityId);
```

**Hata bu satırdaydı.** Süper admin ekranı `null` geçiyordu, yani
`municipality_id is null` olan global görevlerin teslimlerini listeliyordu.
Bir belediye görevine gönderilen fotoğraf süper adminin kuyruğunda **hiç
görünmüyordu**.

### Yetki katmanları zaten doğruymuş

Ölçüldü, ikisi de yerindeydi:

- `review_submission` → `if not (public.is_super_admin() or (...belediye
  rolü...))` — süper admin **tüm** görevler için yetkili.
- `task_submissions_select_super` politikası →
  `using (public.is_super_admin())` — satırlar zaten görünüyor.

Yani eksik olan tek şey listeleme filtresiydi; ne RPC ne RLS
değiştirilmesi gerekti.

### Düzeltme

`listPendingReviews` parametresi üç değerli oldu:
belediye kimliği (panel), `"all"` (süper admin — filtre yok, kararı RLS
veriyor), `null` (yalnızca global). `/admin/incelemeler` artık `"all"`
çağırıyor.

Kuyruk kartına **belediye adı rozeti** eklendi (global görevde "Genel") —
süper admin hangi belediyeye ait olduğunu görmeden karar veremezdi.

### Kanıtlar (yerel psql)

Bir belediye görevine pending fotoğraf teslimi açıldı:

- Belediye personeli görüyor: **1**
- Süper admin RLS altında görüyor: **2** (belediye + global)
- **Eski filtre** (`municipality_id is null`) kaç satır verirdi: **1**
- **Yeni filtre** (filtre yok): **2**
- Süper admin belediye görevini onayladı → teslim `approved`,
  XP 40 + rozet 20, kullanıcıya bildirim gitti
- Yetkisiz kullanıcı inceleme denemesi → "Bu teslimi inceleme yetkin yok."

---

## FAZ Z1 — Görev zamanlama v2

**Zaman durumu** (`taskTimeState`): `upcoming` (now < starts_at),
`active`, `ended`. Sorgu katmanında hesaplanıyor — `Date.now()` render
içinde çağrılınca bileşen saf olmaktan çıkıyor ve lint hata veriyor (D07 ve
D23'te aynı kurala takılmıştık).

**`submit_task` mesajı zenginleşti:** "Görev henüz başlamadı" tek başına ne
zaman geleceğini söylemiyordu. Artık:
"Bu görev 16.09.2026 14:58 tarihinde başlıyor." (Europe/Istanbul).

**Görsel ayrışma** — her zaman durumu ikon + renk:
- Yaklaşan: `calendar-clock`, indigo→mor gradyan, **başlangıca** geri sayım
- Anlık (süreli aktif): `timer`, turuncu→magenta, **bitişe** geri sayım
- Sürekli: `activity`, cyan
- Kart sol üstünde yaklaşan görevde "Yakında" şeridi

İkisi aynı renkte olsaydı kullanıcı "2 saat" ifadesinin başlangıca mı
bitişe mi olduğunu ayırt edemezdi.

**Detay:** büyük başlangıç geri sayım bloğu + tam tarih; "Başlangıç" ve
"Bitiş" satırları. **Hatırlat butonu pasif** — planlanmış bildirim
altyapısı borçta; aktifmiş gibi göstermek tutulmayacak bir söz vermek
olurdu.

**CTA:** yaklaşan görevde "Başlamadı" (pasif). Sunucu zaten reddediyor ama
tıklanabilir buton kullanıcıya "dene" dedirtip hata aldırmak demekti.

**Feed:** yaklaşan görevler ayrı "Yaklaşan" bölümünde, başlangıç saatine
göre sıralı; altında "Şimdi açık". Aynı listede karışık dursalardı
kullanıcı aktif bir göreve dokunmak isterken başlamamış olana giriyordu.
Süresi dolmuş görevler feed'den düşüyor, **başlamamış olanlar düşmüyor**.

**Seed:** "STK buluşması: sahilde fidan dikimi" (now + 2 gün, photo_gps).

**Kanıt:** görev `henuz_baslamadi = t`; teslim denemesi →
"Bu görev 16.09.2026 14:58 tarihinde başlıyor."

---

## FAZ M — "Görevlerim" takip ekranı

`/gorevlerim` — İncelemede / Onaylanan / Reddedilen sekmeleri, her birinde
sayı rozeti. Kayıtta görev başlığı + ikonu, gönderim tarihi; onaylananda
kazanılan XP/Coin hapları, reddedilende sebep, bekleyende fotoğraf
önizlemesi (imzalı URL, bucket private).

Yeni RPC `list_my_submissions(p_status)` — `security definer` olmak
zorunda: görev başlığı ve ödülü `tasks`'tan geliyor ve teslim edilen bir
görev sonradan taslağa alınırsa RLS onu gizlediği için satır başlıksız
kalırdı. Fonksiyon yalnızca çağıranın kendi tesliminlerini döndürüyor.

Sayımlar için tüm teslimler bir kez çekiliyor; her sekme için ayrı sorgu
üç veritabanı turu demekti.

Bağlantılar: `/gorevler` üstünde "Görevlerim" düğmesi + ana sayfa hızlı
erişim ızgarası.

**Kanıt:** pending/approved/rejected üç kayıtla üç sekme doğru listeliyor;
filtreler tek tek çalışıyor; **başka kullanıcı 0 satır görüyor**.

---

## FAZ R2 — Sürekli görevde inceleme sürerken tekrar teslim

**Sorun:** `task_submissions_open_unique` indeksi
`(task_id, user_id, period_key)` üzerindeydi ve sürekli görevlerde
`period_key` her zaman `'once'`. Sonuç: bir teslim incelemedeyken aynı
sürekli göreve ikinci teslim gönderilemiyordu. Sürekli görev tanımı gereği
tekrarlanabilir olduğu için bu bir kısıtlama değil, hataydı.

**Seçilen yol:** `task_type` kolonunu teslim satırına denormalize edip
kısmi indeksin koşuluna katmak:

```sql
create unique index task_submissions_open_unique
  on public.task_submissions (task_id, user_id, period_key)
  where status in ('pending','approved') and task_type <> 'continuous';
```

Denormalizasyon bedava: `period_key`'i yazan tetikleyici zaten görevin
tipini okuyor, aynı sorgudan tek kolon daha yazılıyor.

**Denenen ve elenen alternatifler:**
- *Sürekli görevlerde `period_key`'i benzersizleştirmek* (zaman damgası ya
  da uuid): indeks çalışırdı ama `period_key`'in anlamı bozulurdu — takım
  bonusu ve dönem sorguları bu alanı "aynı dönem" karşılaştırması için
  kullanıyor ve her satır farklı olunca **takım eşiği hiç dolmazdı**.
- *İndeksi kaldırıp kontrolü tetikleyiciye taşımak*: eşzamanlı iki istek
  arasında yarış koşulu açardı; benzersiz indeks bunu veritabanı
  seviyesinde kapatıyor.

`submit_task` içindeki "zaten gönderdin" kontrolü de aynı kuralı izliyor;
ikisi ayrı kalsaydı kullanıcı fonksiyondan geçip indekse çarpar ve ham
veritabanı hatası görürdü.

**UI:** sürekli görevde bekleyen teslim varken gönderme yolu açık kalıyor,
üstte "Önceki teslimin incelemede. Bu görevi tekrar gönderebilirsin."
şeridi.

**Kanıtlar (izole ölçüm):**
- Sürekli görevde arka arkaya iki insert → **ikisi de geçiyor**
- Daily görevde ikinci insert → `duplicate key value violates unique
  constraint "task_submissions_open_unique"`
- İki sürekli teslim ayrı ayrı onaylanınca **iki kez** puan (2 satır,
  100 XP); `award_task_points` tekrar çağrılınca **hâlâ 2 satır**
- `task_type` denormalizasyonu dolu: continuous 2, daily 1

---

## FAZ F1 — Telefon zorunlu (doğrulamasız)

`profiles.phone` + kısmi tekil indeks (`where phone is not null`) + biçim
kısıtı `^\+905[0-9]{9}$`.

**Tek biçimde saklama gerekçesi:** kullanıcı "0532…", "532…",
"+90 532 …" gibi farklı yazımlarla giriyor. Olduğu gibi saklamak
benzersizlik kontrolünü işe yaramaz hâle getirirdi — aynı numara üç
farklı satır olarak geçebilirdi. Normalize etme `set_phone` içinde,
kısıt son savunma hattı.

`set_phone` `security definer`: benzersizlik ihlalini Türkçe mesajla
döndürmek için hata burada yakalanıyor; ham Postgres hatası
("duplicate key value violates unique constraint …") kullanıcıya
gösterilemezdi.

**SMS DOĞRULAMA YOK.** Ücretli sağlayıcı gerektiriyor ve bu dilimin
DOKUNMA listesinde. Şimdilik yalnızca zorunlu toplama, biçim ve
benzersizlik kontrolü var; **numaranın gerçekten kullanıcıya ait olduğu
doğrulanmıyor**.

**Onboarding:** telefon alanı zorunlu, maskeli ipucu (5XX XXX XX XX),
mobilde sayısal klavye (`inputMode`). Profil önce, telefon sonra
yazılıyor — telefon benzersizlik hatası verirse kullanıcı adı çoktan
kaydedilmiş oluyor ve kullanıcı yalnızca telefonu düzeltiyor; tersi
sırada kullanıcı adını her denemede yeniden girmesi gerekirdi.

**"Profil eksik" kuralına telefon eklendi.** Mevcut kullanıcıların
profilinde telefon yok, bu yüzden onlar da bir kez onboarding'e uğruyor —
telefonu yalnızca yeni kayıtlardan istemek alanı sahada işe yaramaz hâle
getirirdi. Onboarding formu kullanıcı adını dolu getiriyor.

**Ayarlar:** telefon güncellenebilir; boş bırakılırsa mevcut numara
korunuyor. Silme yolu bilerek yok — telefon zorunlu bir alan.

**Kanıtlar (yerel psql):**
- `0212 555 44 33` (sabit hat) → "Geçerli bir cep telefonu gir"
- Boş → "Telefon numarası zorunlu."
- `532 111 22 33`, `0532 111 22 33`, `+90 532 111 22 33` → **üçü de**
  `+905321112233`
- Aynı numara ikinci kullanıcıda → "Bu telefon zaten kayıtlı."
- Doğrudan `05321112233` yazma → `profiles_phone_format` kısıtı
- anon `set_phone` → `false`

---

## FAZ Z — Kapanış

### Bulut

```
20260919000000_phone_and_resubmit.sql  → uygulandı
db push --dry-run → {"upToDate":true,"migrations":[]}
db diff --linked  → No schema changes found
```

**Yol boyunca:** kapanış doğrulaması sırasında Supabase host'u bir süre
erişilemez oldu (`Connection timed out`, REST `000`). Ölçtüm: Vercel ve
GitHub aynı anda 200 dönüyordu, yani sorun ağımda değil o hosta özgüydü.
Erişim geri gelince doğrulama tekrarlandı ve temiz çıktı.

**Bulut REST (anon):** `set_phone` → 401, `list_my_submissions` → 401.
`profiles?select=phone` → **200 ama gövde `[]` ve
`Content-Range: */0`** — RLS her satırı eliyor, sızıntı yok. 200 kodu boş
sonuç kümesinin normal cevabı; yerelde `set role anon` ile de 0 satır
doğrulandı.

### `rls_isolation.sql` — 989 satır, SENARYO 28–30

**Ölçümle bulunan sessiz bozulma.** Tam koşumda toplam ERROR 23 çıktı,
oysa D23 tabanı 19 + D24'ün 5 yeni reddetmesi = **24** beklenmeliydi.
Eski ve yeni çıktıyı `diff` ile karşılaştırınca kaybolan hata bulundu:

`SENARYO 9` "dönemde tek teslim kuralı"nı **sürekli** bir görev
(`0000f1a5-…0001`, tipi `continuous`) üzerinde sınıyordu. R2 bu kısıtı
sürekli görevlerde bilerek kaldırdığı için insert artık başarılı oluyor,
ama senaryo hâlâ "(yukarıda unique ihlali bekleniyor)" yazıp **sessizce
geçiyordu**. Kod doğruydu, test yalan söylüyordu.

SENARYO 9 yeniden yazıldı: `period_key` ezme kontrolü korundu, üstüne
`task_type` denormalizasyonu doğrulaması, sürekli görevde ikinci teslimin
**açılabildiği** ve daily görevde **engellendiği** iki ayrı iddia kondu.
Düzeltmeden sonra toplam **24**.

İzole ölçümle de doğrulandı: sürekli görevde iki insert geçiyor, daily'de
ikincisi `task_submissions_open_unique` ile kırılıyor.

24 ERROR'un hepsi beklenen reddetme; `provinces` 81, `profiles` 3.

### `pnpm check:all`

Her fazın sonunda koşuldu, hepsinde çıkış kodu **0**.

### Rejim sapması (bildirim)

"Faz başına tek commit" kuralından bir sapma var: **M24 tek migration
dosyası** F1 (telefon), R2 (tekrar teslim), M (`list_my_submissions`) ve
Z1 (zamanlanmış görev seed'i) parçalarını birlikte taşıyor. Bir dosyayı
dört commit'e bölmek mümkün değildi. UI tarafı faz başına ayrı commit'lendi;
migration F1+R2 commit'ine kondu ve commit mesajında diğer iki fazın
parçalarını da taşıdığı yazıldı.

### Bilinçli kapsam dışı

DOKUNMA listesi korundu: SMS/telefon doğrulama entegrasyonu yok, SMTP
ayarı yok, realtime sohbet yok, push notification yok, çark/çekiliş yok,
Supabase bölge taşıma yapılmadı.

**Yeni borç — ölçülmedi ama işaret ediyorum:** sürekli görevde açık teslim
sınırı kalkınca, kullanıcı aynı sürekli görevi arka arkaya defalarca
gönderebiliyor. Her teslim insan incelemesinden geçtiği için puan
otomatik yazılmıyor, yani istismar personelin onayına bağlı — ama
inceleme kuyruğu tek kullanıcı tarafından doldurulabilir. Bir "sürekli
görevde günde en fazla N teslim" sınırı gerekebilir; dilimde istenmediği
için eklenmedi.

### Sabah görsel turu

1. **`/admin/incelemeler`** — artık belediye görevlerinin teslimleri de
   listeleniyor; her kartta belediye adı rozeti (global görevde "Genel")
2. Bir belediye görevine teslim gönderip hem `/panel/incelemeler` hem
   `/admin/incelemeler` kuyruğunda göründüğünü doğrulayın
3. **`/gorevler`** — "Yaklaşan" bölümü, "STK buluşması" kartında
   indigo başlangıç geri sayımı ve "Yakında" şeridi
4. **Yaklaşan görev detayı** — büyük geri sayım bloğu, Başlangıç/Bitiş
   satırları, pasif "Hatırlat (yakında)" ve pasif "Başlamadı" butonu
5. **Sürekli görev** — teslim gönderip incelemede iken sayfaya dönün;
   "Önceki teslimin incelemede. Bu görevi tekrar gönderebilirsin."
   şeridini ve açık gönderme yolunu görün
6. **`/gorevlerim`** — üç sekme, sayı rozetleri, onaylananda XP/Coin,
   reddedilende sebep, bekleyende fotoğraf önizlemesi
7. **Onboarding** — telefon alanı zorunlu; geçersiz format ve kayıtlı
   numara mesajlarını deneyin
8. **Mevcut hesapla giriş** — telefonu olmayan hesap onboarding'e
   yönleniyor ve kullanıcı adı dolu geliyor
9. **`/ayarlar`** — telefon alanı kayıtlı numarayla dolu (yerel yazımda),
   boş bırakınca korunuyor
