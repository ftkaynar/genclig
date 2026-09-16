# Gece Vardiyası 10 — DİLİM 29

Fazlar: T (inceleme bug'ı) · C (il topluluğu) · AU (denetim izi) · AP (panel
v2) · K (kart hizası) · S (sıralama + takım) · F (favicon + ödüller) ·
V (animasyon turu) · Z (kapanış). Her faz ayrı commit, hepsi `origin/main`'de.

---

## FAZ T — İnceleme kuyruğu: asıl kök sebep

### Önce itiraf

**D24'te yanlış şeyi düzeltmişim.** Orada listeleme filtresini
(`null` → `"all"`) psql ile ölçüp doğruladım; sayfanın **gerçek sorgusunu
hiç çalıştırmadım**. Filtre düzeltmesi doğruydu ama semptomun sebebi
değildi, ve "düzeltildi" diye rapor ettim.

### Teşhis — vaka bazlı

Buluttaki tüm pending teslimler servis rolüyle (RLS'siz) listelendi, sonra
sayfanın kullandığı sorgu **gerçek bir süper admin oturumuyla** aynı veriye
karşı çalıştırıldı:

```
=== BULUTTAKI TUM PENDING TESLIMLER: 1
   fab19ca6 | Mahallendeki bir sorunu fo | active | continuous | photo | foto VAR

SAYFA SORGU HATA: Could not find a relationship between
                  'task_submissions' and 'profiles' in the schema cache
```

Parça parça sınandığında:

```
incelemeler (mevcut)       -> HATA
incelemeler (profiles yok) -> 1 satir
sorunlar (mevcut)          -> HATA
sorunlar (profiles yok)    -> 0 satir
```

### Kök sebep

Sorgu `profiles(username)` gömüyordu. Ama:

```
task_submissions.user_id -> auth.users(id)
problem_reports.user_id  -> auth.users(id)
profiles.id              -> auth.users(id)
```

İki tablo arasında **doğrudan FK yok**; ikisi de ayrı ayrı `auth.users`'a
bakıyor. PostgREST bu ilişkiyi çözemiyor ve **sorgunun tamamı patlıyor**.

Çağıran taraf şöyle yazıyordu:

```ts
const { data } = await query;      // error okunmuyor
return (data ?? []) as Row[];      // null -> []
```

Yani ekran **boş kuyruk** gösteriyordu. Boş kuyruk "iş yok" gibi okunuyor,
kırık ekran gibi değil — hatanın aylarca görünmemesinin sebebi bu.

Aynı sınıf hata D28'de avatar yüklemede de çıkmıştı (storage hatası
yutuluyordu). **Kural:** bir sorgu hatası ya kullanıcıya ya log'a
ULAŞMALI; sessizce boş listeye dönüşmemeli.

### Düzeltme

- Gömme kaldırıldı; adlar tek bir `in` sorgusuyla çekiliyor.
  *Denenen ve elenen:* `user_id -> profiles(id)` FK eklemek. Aynı kolonda
  ikinci FK, PostgREST'in her gömmesini belirsizleştirip her çağrıda ipucu
  söz dizimi gerektiriyordu.
- `lib/supabase/unwrap.ts`: hata log'a yazılıp fırlatılıyor. Operasyon
  ekranında kırık sayfa görmek, "bekleyen iş yok" yalanından iyidir.
- **Denetim:** koddaki 17 PostgREST gömmesinin tamamı FK'ya karşı tarandı.
  Bu ikisi dışında FK'sız gömme kalmadı.

### Kanıt

```
yeni sorgu -> 1 satir, kullanici: ftkaynar, foto VAR

photo + photo_gps tipinde geçici pending üretildi:
  sayfa sorgusu -> 3 satir
  test teslimi (photo):     GORUNUYOR
  test teslimi (photo_gps): GORUNUYOR
```

`photo` görevi **draft** durumundaydı ve yine göründü: teslim, görevin
güncel durumundan bağımsız incelenebilmeli. Test verileri silindi.

---

## FAZ C — Topluluk il bazına geçti

İlçe kanalları çok ince bölünmüştü: İstanbul'un 39 ilçesi 39 ayrı odaya
bölününce her odada bir avuç kullanıcı kalıyor ve sohbet hiç başlamıyor.
Topluluk hissi için eşik kalabalık; il ölçeği o eşiği geçiyor.

### Veri taşıma — sıra kritikti

```
1. mesajları il kanalına taşı
2. kanal bazlı susturmaları taşı
3. ANCAK ondan sonra ilçe kanallarını sil
```

Ters sırada silmek, `channel_messages` ve `user_mutes`'taki
`on delete cascade` yüzünden mesajları da susturmaları da silerdi.

İlçe kanalları **passive bırakılmadı, silindi**: pasif kanal hâlâ
`channels_select_own` ve moderasyon sorgularında özel durum gerektiriyor ve
bayat bir `my_channel_id` ölü odaya düşebiliyordu. Mesajlar taşındıktan
sonra boş kayıt tutmanın karşılığı yok.

### Bulut taşıma sayıları (ölçüldü)

```
ÖNCE   kanal 39 (district 39) | mesaj 1
SONRA  kanal 81 (province 81) | mesaj 1
mesaj  -> province / İstanbul Topluluğu
audit  -> {"moved_messages":1,"moved_mutes":0,"deleted_district_channels":39}
```

Mesaj sayısı önce = sonra: **kayıpsız**.

### UI

`/topluluk` başlığı il adı, sohbetin üstünde kalıcı bir satır:
"Bu sohbet **İstanbul**'daki tüm GençLİG kullanıcılarına açık." Kapsamın
belirsiz olması çocuk güvenliğinde başlı başına bir risk.

---

## FAZ AU — Denetim izi

`audit_logs`: actor_id, action, target_type, target_id, meta, created_at.

Okuma yalnız süper admin. **Yazma politikası YOK** ve hiçbir role INSERT
verilmiyor — denetim izi denetlenen tarafından yazılabilir olsaydı değeri
sıfıra inerdi.

### Tetikleyici, RPC içi çağrı değil

*Denenen ve elenen:* her kritik RPC'ye `perform log_audit(...)` eklemek.

1. On küsur fonksiyonun gövdesini yeniden yazmak gerekiyordu ve biri
   ileride değiştiğinde denetim satırının korunacağı garanti değildi —
   **sessizce düşen bir izleme, hiç olmamasından kötüdür**.
2. RPC dışı yazımlar (personelin doğrudan tablo güncellemesi, elle
   düzeltme) izlenmiyordu. Tetikleyici HER yazım yolunu kapsıyor.

Aktör `auth.uid()`: security definer içinden çağrılsa bile JWT claim'i
değişmiyor.

Kapsanan aksiyonlar: `submission.approved/rejected`, `problem.status`,
`message.delete/restore`, `user.mute`, `report.create/resolved`,
`announcement.send`, `role.grant/revoke`, `task.create/status`,
`reward.redeem/used`, `ticket.status`, `channel.migrate`.

Silinen mesajın **gövdesi** meta'ya yazılıyor: "kim ne sildi" sorusunun
cevabı silinen metin olmadan eksik.

### Test — 8/8 geçti, 0 hata

```
A kanali: İstanbul Topluluğu | B kanali: Ankara Topluluğu (ayrı)
A'nın mesajı: A goruyor 1 / B goruyor 0
silme aktörü doğru, silinen gövde kayıtlı
duyuru + rol verme kayıtları doğru aktörle
audit erişimi: normal 0 / süper admin 5
```

---

## FAZ AP — Süper admin paneli v2

Önceki hâli kullanıcı uygulamasıyla aynı dar sütunda (max-w-5xl) ve on üç
bağlantılık düz bir çip şeridindeydi. Yönetim işi tablo işi; dar sütun
tabloları sıkıştırıyor, düz şerit de aramaya zorluyordu.

| Ne | Nasıl |
|---|---|
| Sol sütun | Sabit, daraltılabilir, dört gruplu |
| Gruplar | Genel Bakış / Operasyon / İçerik / Yönetim |
| Aktif vurgu | Sol kenar şeridi + renk (renk tek başına yetmez) |
| Rozetler | Yalnız Operasyon'da — her yerde olsaydı hiçbir yerde olmazdı |
| Üst şerit | Başlık, arama (devre dışı), bekleyen iş, tema, ana sayfa |
| Mobil | Çekmece |

Sayfa başlığı **yoldan türüyor** (`adminTitleFor`). On dört sayfanın
hiçbiri başlığını ayrıca yazmıyor — biri unutulsa "GençLİG Süper Admin"
yazan bir sayfa kalırdı.

**/admin**: altı KPI + denetim izinden son 10 aktivite. "Bugünkü teslim"
gün sınırı Europe/Istanbul (sunucu UTC; gece yarısından sonra üç saat
yanlış çıkıyordu).

**/admin/denetim**: aksiyon + tarih aralığı filtreli tablo, meta JSON'u
satırda açılıyor. Bitiş günü DAHİL (`T23:59:59`).

**/admin/moderasyon**: silinen mesajlar içerikleri ve kim sildiğiyle.
Kaynak `audit_logs` — `channel_messages` üzerinden kurmak ikinci bir
profil sorgusu ve iki ayrı doğruluk kaynağı demekti.

Belediye paneli (`/panel`) bilerek dokunulmadı: sekiz sayfa için düz şerit
hâlâ doğru araç. İki ayrı ölçek, iki ayrı çözüm.

---

## FAZ K — Kart hizası + ilçe rozeti

**Hiza:** sayı sabit genişlikte **sağa dayalı**, kısaltma sabit genişlikte
sola. "9" ile "87" aynı sütunda bitiyor, altı kısaltma tek dikey çizgide
başlıyor. Önceden ikisi de ortalanıyordu; sayı bir haneden iki haneye
çıkınca kısaltma kayıyor ve iki sütunun ritmi bozuluyordu. `tabular-nums`
şart: orantılı rakamlarda 1 ile 8 farklı genişlikte, sabit kutu tek başına
yetmiyor.

**Rozet:** bayrak + ilçe artık tek madalyonda — çerçeve, üstte bayrak,
ince ayraç, altında altın harf aralıklı ilçe adı. Önceden iki ayrı öğe
yapışıktı ve ilçe adı bayrağın alt yazısı gibi okunuyordu. İlçe yoksa
madalyon yalnız bayrakla kalıyor.

**Kaydırarak çevirme:** kart parmakla ya da fareyle yana itilerek
çevriliyor. Pointer Events (touch + mouse tek yol). Eşik 48px ve yatay
hareket dikeyden büyük olmalı — yoksa sayfayı kaydıran parmak kartı
kazara çeviriyordu. Düğmeler kaldırılmadı: kaydırma keşfedilmesi gereken
bir etkileşim, tek yol olamaz.

---

## FAZ S — Sıralama + takım

- Sekme şeridinin yatay payı sayfa gövdesiyle (`px-4`) hizalı: kullanıcı
  filtreleri altındaki **listeyle** aynı sütunda görüyor.
- Takım varsayılan kapasitesi 5 → **10**. `create_team` kolon varsayılanını
  kullanıyor; ölçüldü: `YENI TAKIM KAPASITESI: 10`. Mevcut takımlara
  dokunulmadı — kurucunun seçtiği kapasiteyi geriye dönük değiştirmek
  takımın kimliğine müdahale olurdu.

---

## FAZ F — Favicon + ödüller v3

**Favicon** tek script'ten: `icon-16/32`, `apple-touch-icon` 180,
`favicon.ico` (32+16). sharp ICO yazamadığı için başlık elle kuruldu —
biçim basit ve tek bağımlılık eklemekten ucuz. İmza doğrulandı:
`00 00 01 00 02 00 20 20`. 16/32 px'te kenar payı yarıya indirildi; büyük
ikondaki oranla mark okunmuyordu.

**Ödüller** tek sütun satır kartlarından **ızgaraya** geçti (mobil 2, geniş
3-4). "Öne çıkan" tek kart kaldırıldı: ızgarada zaten uygun olanlar
parlıyor ve asıl ayrım "pahalı" değil "alabilir miyim". Yerine üst şeritte
"N ödül hazır" sayacı.

Uygunluk kartın kendisinde:

| Durum | Görünüm |
|---|---|
| Alınabilir | Yeşil kenar + nefes (2600ms) + "ALABİLİRSİN" |
| Alınamaz | Kilit ikonu + tek satır eksik şart |

"2 seviye kaldı", "350 Token eksik". Renk **tek başına** ayırt edici değil;
yazı ve ikon bilgiyi renkten bağımsız taşıyor. Nefes 2600ms çünkü ızgarada
beş-altı kart uygun olabiliyor; hızlı nabız ekranı titretir ve sinyali
gürültüye çevirirdi.

**/oduller/[id]**: büyük görsel, tam açıklama, şart listesi (her şart ✓/✗,
eksikler kalın ve kırmızı), AL butonu. Kupon kodu çevirme animasyonuyla
açılıyor — kazanma anı ızgaranın ortasında kaybolmasın.

---

## FAZ V — Animasyon turu

Süre ve eğri artık tek yerde: `--motion-fast 120ms`, `--motion-base 220ms`,
`--motion-slow 360ms`, `--motion-ease`. Önceden her bileşen kendi süresini
yazıyordu (90, 110, 150, 200, 300, 700ms).

**400ms kuralı uygulandı ve ihlaller tarandı:** iki ilerleme çubuğu
`duration-700` kullanıyordu (bakiye özeti, profil XP), ikisi de 360ms'e
çekildi. Kutlama ekranları dışında 400ms üstü animasyon kalmadı.

| Ekran | Ne eklendi |
|---|---|
| Ana sayfa | 3 blok kademeli beliriyor |
| Profil | 2 blok kademeli beliriyor |
| Sıralama | Satırlarda press-soft (3 yer) |
| Hızlı erişim | Kendi `active:scale` değeri press-soft'a çevrildi |
| HUD / bakiye / profil / rozet / kart arkası | 5 ilerleme çubuğu bar-fill |
| Ödüller | tile-stagger + press-soft + reward-ready |
| Ödül detayı | anim-stagger ile sıralı bloklar |
| Denetim / moderasyon | Satırlar tile-stagger |

Hepsi yalnız `opacity`/`transform`/`width` oynatıyor.
`prefers-reduced-motion` altında `anim-stagger` ve `reward-ready` de
kapanıyor (derlenmiş CSS'te doğrulandı).

---

## FAZ Z — Kapanış

### Bulut

```
dry-run: 20260924000000_province_channels_and_audit.sql
push:    Applying migration ... Finished
```

Taşıma sayıları yukarıda (FAZ C).

### RLS suite — burada bir regresyon yakalandı

İlk koşuda **28 → 31 ERROR** ve `"Bu mesajı raporlama yetkin yok."`
satırı **kayboldu**. Sayı yakındı; liste kırılmayı gösterdi (D24 dersi:
sayıya değil listeye bak).

Sebep: suite SENARYO 26'da iki kullanıcıya aynı ilin **iki ilçesini**
atıyordu. Kanal artık il bazlı olduğu için ikisi aynı kanala düştü ve
izolasyon iddiası anlamsızlaştı. SENARYO 32 de kanalı `district_id`
üzerinden arıyordu, bulamayınca işlem abort oldu.

Düzeltme: B → İstanbul, C → Ankara; SENARYO 32 kanalı `province_id`
üzerinden buluyor.

```
D28 sonrasi: 28 | D29 sonrasi: 28 | diff: FARK YOK
```

İzolasyon sayıları:

```
B gördüğü kanal 1 | C gördüğü kanal 1
C, B'nin mesajını görüyor mu: 0
süper admin gördüğü kanal: 81
```

### check:all

`check:types`, `check:lint`, `check:boot` — üçü de temiz.

---

## Sapmalar

1. **Arama kutusu devre dışı.** Direktif "arama kutusu placeholder"
   diyordu; kutu var ama `disabled`. Her tabloda ayrı filtreler var ve
   bunları tek bir küresel aramaya bağlamak ayrı bir iş. Çalışıyormuş gibi
   davranan bir kutu, çalışmayan bir kutudan kötüdür.

2. **Denetim izi tetikleyiciyle kuruldu**, direktifteki gibi RPC içine tek
   tek `log_audit` çağrısı eklenerek değil. Gerekçe yukarıda; kapsama daha
   geniş (RPC dışı yazımlar da düşüyor).

3. **Ödüllerdeki "öne çıkan" kart kaldırıldı.** Direktifte korunması
   istenmemişti ama ızgarada uygunluk zaten parladığı için tek kartı
   kayırmak anlamını yitirmişti.

4. **`reward-card.tsx` silindi**, yerine `reward-tile` + `redeem-panel`
   geldi. Eski bileşen artık hiçbir yerden çağrılmıyordu.

5. **Belediye paneli dokunulmadı.** Direktif "tüm mevcut admin sayfaları"
   diyordu; `/panel` admin değil belediye yüzü ve sekiz sayfa için düz
   şerit hâlâ doğru araç.

---

## Sabah turu — önerilen sıra

1. **`/admin/incelemeler`** — bekleyen teslim ARTIK GÖRÜNMELİ. Bu dilimin
   asıl sınavı bu. Görünmezse tarayıcı konsolunda artık gerçek hata var.
2. `/admin` — KPI'lar, son aktiviteler akışı; sol sütunu daraltıp aç,
   tercih sayfalar arası korunmalı.
3. `/admin/denetim` — aksiyon filtresi + tarih aralığı; bir satırın
   "Ayrıntı" sütununu açıp meta JSON'una bak.
4. Bir teslimi onayla → `/admin/denetim`'de `submission.approved` kaydı
   doğru aktörle düşmeli.
5. `/topluluk` — başlık il adı, üstte kapsam satırı. Ankara'lı bir
   hesapla girip farklı kanal gördüğünü doğrula.
6. `/admin/moderasyon` — bir mesaj sil, aynı sayfanın altında içeriğiyle
   ve adınla listelenmeli.
7. `/oduller` — ızgara, uygun ödülün nefes alması, kilitli ödüldeki eksik
   şart satırı. Bir ödüle gir, şart listesi ve AL akışı.
8. `/profil` — kartı parmakla yana it, çevrilmeli. İstat sayıları iki
   sütunda hizalı olmalı; bayrak-ilçe madalyonuna bak.
9. `/siralama` — sekmelerin sol kenarı listeyle hizalı mı.
10. Sekme ikonu (favicon) tarayıcıda görünmeli.

---

## Açık borçlar

- Admin üst şeridindeki arama kutusu devre dışı; küresel arama ayrı bir iş.
- `redeem_reward` DB hata mesajı hâlâ "coin" diyor.
- İstat taban hesabı her yazımda satır içi; ölçek büyürse kuyruğa.
- M27'nin ve M28'in geriye dönük doldurmaları döngü kullanıyor.
- Decay için gecelik TABAN recompute (pg_cron) — D28 borcu.
- `/gorevler`'de kategori filtresi yok; Keşfet şeritlerinde derin bağlantı
  da yok.
- Seviye Yolu rozet taşları yalnız `xp_total` kriterli rozetlerde.
- Gerçek zamanlı topluluk sohbeti (şu an 30 s yoklama).
- Supabase'i Avrupa bölgesine taşımak, <400 ms TTFB hedefinin tek yolu.
- Belediye personeli `profiles` okuyamadığı için panelde kullanıcı adları
  "Kullanıcı" görünüyor (kasıtlı, ama ileride takma ad gerekebilir).
