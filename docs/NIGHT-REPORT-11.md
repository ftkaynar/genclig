# Gece Vardiyası 11 — DİLİM 30

Fazlar: N (bildirim bug'ları) · P (web push) · SR (podyum + dönem ödülleri) ·
U/K2/H/FK/C/GA (arayüz) · Z (kapanış). Her faz ayrı commit, hepsi
`origin/main`'de.

---

## FAZ N — Bildirim bug'ları: iki ölçüm, iki kapanış

### Bug 1 — kendi destek yanıtı sayacı artırıyordu

```
kendi talebine kendi yanıt -> bildirim öncesi=0 sonrası=1 (fark=1)
```

`reply_ticket` yalnızca **"yanıtlayan personel mi"** diye bakıyordu:

```sql
if v_staff then
  perform public.notify(v_ticket.user_id, ...);
end if;
```

Proje sahibi hem süper admin hem talebin sahibi olduğu için kendi kendine
bildirim gönderiyordu. Bu tek kullanıcılı kuruluma özgü bir tuhaflık
değil, kural: personel kendi açtığı bir talebe yanıt yazabilir.

Düzeltme: alıcı ile gönderen aynıysa bildirim yok.

```
düzeltme sonrası: fark=0
```

### Bug 2 — hesap silme kırıktı ve bunu M28'de BEN kırmışım

```
kullanıcı kendi hesabını siliyor ->
  insert or update on table "audit_logs" violates foreign key
  constraint "audit_logs_actor_id_fkey"
```

Zincir:

```
hesap silinir
  -> user_roles satırları cascade ile silinir
  -> M28'de eklediğim audit_role tetikleyicisi çalışır
  -> log_audit actor_id = auth.uid() ile yazmaya çalışır
  -> o kullanıcı auth.users'tan çoktan gitmiştir
  -> FK ihlali
  -> SİLME İŞLEMİ KOMPLE GERİ ALINIR
```

Bu, **D26'da `recompute_user_stats`'ta ölçtüğüm hatanın birebir aynısı.**
Dersi orada öğrendim, korumayı oraya yazdım, ve M28'de yeni bir
tetikleyici eklerken aynı tuzağa düştüm.

**İlk testim yanıltıcıydı:** `postgres` rolüyle silince `auth.uid()` null
dönüyor ve işlem geçiyordu. Gerçek akışta kullanıcının kendi claim'i var.

```
postgres rolüyle silme        -> BASARILI  (yanıltıcı)
kendi JWT'siyle kendini silme -> KIRIK     (gerçek)
```

Koruma `log_audit`'in **içinde**: her çağıranı ve ileride eklenecek
tetikleyicileri birden kapsıyor. Kayıt yine düşüyor, yalnızca aktör null
oluyor — silinmiş bir kullanıcıyı işaret etmenin anlamı yok.

```
düzeltme sonrası: KENDI HESABINI SILME: BASARILI
```

### Ham tipler

`NOTIFICATION_LABEL` haritası eksikti ve `?? item.type` ile **ham tip**
ekrana basılıyordu: kullanıcı `support_reply`, `friend_request`,
`stat_decay` gibi teknik dizgiler görüyordu.

Harita `lib/notifications/labels.ts`'e taşındı ve type check'teki 13 tipin
tamamını kapsıyor. Tanınmayan tipte bile ham dizgi değil nötr bir
"Bildirim" etiketi görünüyor.

Canlı doğrulama: `/bildirimler` gövdesinde `support_reply` **YOK**,
"Destek yanıtı" **VAR**.

### Derin bağlantı

| Tip | Hedef |
|---|---|
| submission_approved/rejected | /gorevlerim |
| badge_earned | /profil |
| problem_status | /bildir/gecmis |
| reward_redeemed | /oduller/kuponlarim |
| friend_* | /arkadaslar |
| team_invite | /takim |
| support_reply | /destek?talep=&lt;id&gt; |
| community | /topluluk |
| stat_decay | /gorevler |
| leaderboard_reward | /siralama |

**Sapma:** `/destek/[id]` rotası **yok**. Destek tek sayfa ve konuşma
istemcide açılıyor; ayrı rota aynı veriyi ikinci kez çeken bir sayfa
demekti. Sorgu parametresiyle çözüldü, `SupportView` onu okuyup konuşmayı
açıyor.

### Okundu

Sayfa açılınca okunmamışlar işaretleniyor (`MarkReadOnOpen`). "Tümünü
okundu işaretle" düğmesi **kaldırıldı**: listeyi görmek zaten okumaktır ve
ayrıca bir düğmeye basmak gerekmesi sayacı anlamsızlaştırıyordu.

Destek listesinde yanıtlanmış talep yeşil kenarlı ve "YENİ YANIT" rozetli.

---

## FAZ P — Web push

**Yeni bağımlılık:** `web-push` 3.6.7 (izinli).

| Parça | Karar |
|---|---|
| `public/sw.js` | Yalnız push + notificationclick. **Önbellek YOK** |
| `push_subscriptions` | endpoint TEKİL, RLS kendi satırları |
| `lib/supabase/service.ts` | `server-only` ile korunan service_role istemcisi |
| `sendPushToUser` | Asla fırlatmıyor, 404/410'da aboneliği siler |
| `sendPushToMany` | 50'lik gruplar |

**Önbellek neden yok:** çevrimdışı önbellek, sunucuda render edilen
sayfaların bayat sürümlerini göstermeye ve "neden eski veri görüyorum"
sınıfı hatalara kapı açıyordu.

**`server-only` neden:** bu dosya yanlışlıkla bir client bileşeninden
import edilirse **derleme kırılıyor**. Anahtarın tarayıcıya sızması sessiz
bir hata olsaydı fark edilmeyebilirdi.

**Tıklamada yeni sekme yok:** açık pencere varsa ona odaklanıp
yönlendiriyor. Her bildirimin yeni sekme açması kullanıcıyı birkaç
bildirimden sonra onlarca sekmeyle bırakırdı.

### Tetikler

```
inceleme onay/ret -> "Görevin onaylandı! +80 XP +50 Token" -> /gorevlerim
destek yanıtı     -> /destek?talep=<id>, yalnız KARŞI TARAFA
duyuru            -> /bildirimler, gruplar hâlinde
```

Duyuruda hedef listesi RPC'nin az önce yazdığı bildirim satırlarından
okunuyor: hedef kuralını (belediye/ilçe/kullanıcı) burada yeniden yazmak
kuralın iki yerde ayrışması demekti.

### SINIRLAMA (bilinçli)

Push **yalnızca uygulama sunucusundan** akan eylemlerde gönderiliyor.
Doğrudan SQL'den yapılan işlemler (elle düzeltme, psql, Studio) bildirim
satırı yazar ama **push üretmez**. Postgres'ten HTTP çağırmak `pg_net`
gerektiriyor ve veritabanına dış bağımlılık sokuyordu. Bildirim zaten
DB'de; push yalnızca hızlandırıcı.

### İzin ne zaman isteniyor

`/ayarlar`'daki anahtarla, sayfa açılır açılmaz değil. Tarayıcılar jestsiz
istekleri sessizce reddediyor ve izin bir daha sorulmuyor — bir kez
harcanıyor, boşa harcanmamalı.

### Kanıt

```
VAPID yapılandırması: TAM
1) abonelik kaydı: BASARILI, DB'de 1 satır
2) başkası adına abonelik: REDDEDILDI (doğru)
3) başkasının aboneliğini okuma: GORUNMUYOR (doğru)
4) gerçek P-256 anahtarıyla gönderim -> FCM statusCode 410
   "push subscription has unsubscribed or expired"
```

4. madde en önemlisi: **şifreleme ve VAPID imzası geçerli, istek gerçekten
ağdan FCM'e gitti.** Sahte endpoint olduğu için reddedildi — ki bu da tam
olarak `sendPushToUser`'ın ölü abonelik temizleme yolu.

VAPID özel anahtarı **repoya girmedi**; yalnız `.env.local` (gitignore'da).
Anahtarlar sohbet mesajında verildi.

---

## FAZ SR — Podyum v2 + dönem ödülleri

### Podyum

Birinci **tek başına** üstte ve büyük, ikinci ve üçüncü **altında yan yana
iki eşit kutu**. Önceki düzende üç basamak yan yanaydı; telefonda üç sütun
120px'e sıkışıyor, isimler kırpılıyor ve birincinin "zirve" olduğu
okunmuyordu. Hiyerarşi artık boyutla değil **konumla** anlatılıyor.

Çipler `py-1.5 → py-2.5` + `text-[13px]`: dokunma alanı 40px üstüne çıktı.

### Ödül tasarımı

| Karar | Gerekçe |
|---|---|
| Kapsam yalnız Türkiye + Takım | Küçük ilçede üç kişilik listenin birincisine her hafta ödül vermek ödülü değersizleştirir |
| Miktarlar tabloda | Her değişiklik migration gerektirmesin |
| Takımda bölüştürme YOK | Üç kişilik takımın üyesi on kişilikten üç kat fazla alıyordu; bu küçük takım kurmayı ödüllendiriyordu |
| Ödül işlemleri sıralamayı beslemiyor | Kazanan kendi ödülüyle bir sonraki dönemde de öne geçmemeli |

İdempotentlik `UNIQUE(scope, period, period_key, rank)` kısıtına
yaslanıyor. *Denenen ve elenen:* önce "dağıtıldı mı" bakıp sonra yazmak —
cron ile sayfa görüntüleme aynı anda kontrolü geçip iki kez yazabiliyordu.

### Düzelttiğim kendi kusurum

İlk yazımda kazananları `leaderboard_top`'tan alıyordum. O fonksiyon
`'week'` için **içinde bulunulan** haftayı veriyor; biten haftanın ödülünü
şu ankinin sıralamasıyla dağıtırdı. Bunu yorum olarak not etmiştim — **not
yeterli değil, düzeltilmesi gerekiyordu.** Kazananlar artık `period_key`'den
türeyen açık bir zaman penceresinden hesaplanıyor.

### Zamanlama — pg_cron ÖLÇÜLDÜ

```
pg_available_extensions: pg_cron VAR, installed_version null
create extension pg_cron -> BAŞARILI
cron.job: genclig-leaderboard-settle, schedule "10 21 * * *"
```

**Tek bir günlük iş**, iki ayrı (haftalık + aylık) iş değil.
`settle_leaderboard_rewards` idempotent ve yalnızca biten dönemi
dağıtıyor; günlük koşmak zararsız. İki ayrı zamanlama kurmak, hafta ve ay
sınırlarını cron ifadesinde tekrar hesaplamak demekti.

21:10 UTC = 00:10 İstanbul. `/siralama` açılışındaki tembel çağrı
**emniyet ağı**: sessizce düşen bir cron'u fark etmek zor, kullanıcı
ziyareti ise her gün gerçekleşiyor.

### Testte iki tuzak yakalandı

1. **İlk koşumda her şey `0/0` idi ve test sessizce geçiyordu** — D26'daki
   "test hiçbir şey sınamıyor" tuzağı. Sebep: profil satırı tetikleyiciyle
   `username` NULL oluşuyor ve `on conflict do nothing` onu düzeltmiyordu;
   sıralama sorgusu kullanıcıları hiç görmedi.
2. Kendi debug koşumum bir award satırı bırakmış ve UNIQUE kısıt yüzünden
   testin kazananını bloke etmişti.

```
5/5 geçti, 0 hata:
  12 ayar seed | dönem 2026-W37
  1. çağrı 3 kazanan / 2. çağrı 0   (idempotent)
  3 award kaydı, 3 xp satırı, 3 bildirim
  normal kullanıcı ayarları okuyor ama değiştiremiyor
  her kullanıcı yalnız kendi ödülünü görüyor (1/1)
```

---

## Arayüz fazları

| Faz | Ne değişti |
|---|---|
| U | Ana sayfa da Görevler/Keşfet ile **aynı TaskTile**'ı kullanıyor |
| K2 | `HScroll`: çubuk gizli, taşmada ok + kenar solması, %80 yumuşak kaydırma |
| H | "Şehrin için bildir" hero'nun hemen altında, tam gradyan CTA |
| FK | Kartın her yerine dokunmak çeviriyor; "yana kaydır" ipucu kalktı |
| C | Seviye atlamada tam ekran + CSS parçacık patlaması; rozette kısa pop-up |
| GA | Kazanç şeridinde sayarak artan sayaç |

**Oklar taşma varsa görünüyor.** Her zaman görünseydi tek kartlık bir
şeritte bile çıkar ve "burada daha çok şey var" diye yalan söylerdi.

**Kart etkileşimi eşikleri:** 8px'den az hareket = dokunuş, 48px'den çok
yatay hareket = kaydırma. Aradaki bölge hiçbir şey yapmıyor; yoksa liste
kaydırırken kart kazara çevriliyordu.

**Kutlama delta yoksa hiç çıkmıyor** — her açılışta patlayan konfeti
birkaç günde sıradanlaşıyor. İlk ziyarette de çıkmıyor; yoksa yeni
kullanıcı "SEVİYE 1!" kutlaması görüyordu.

**Aynı lint kuralına üçüncü kez takıldım** (`react-hooks/set-state-in-effect`,
D22 ve D29'dan sonra). `useSyncExternalStore` ile çözüldü; anlık görüntü
modül düzeyinde önbelleğe alınıyor, yoksa her çağrıda yeni nesne dönüp
sonsuz render döngüsü olurdu.

Konfeti saf CSS (1.2s) — kutlama ekranları 400ms kuralının bilinçli
istisnası. `prefers-reduced-motion` altında kapanıyor.

---

## FAZ Z — Kapanış

### Bulut

```
dry-run: 20260925000000_push_and_notify_fixes.sql
         20260926000000_leaderboard_rewards.sql
push:    ikisi de uygulandı
doğrulama: ayar 12, abonelik 0, cron "genclig-leaderboard-settle" 10 21 * * *
```

### RLS suite

İki yeni senaryo eklendi (33: push abonelikleri, 34: ödül ayarları).

```
D29: 28 | D30: 30
diff: yalnızca 2 YENİ beklenen hata
  new row violates RLS for table "push_subscriptions"
  permission denied for function award_leaderboard_rewards
```

Önceki 28 hatanın hiçbiri değişmedi.

İddia değerleri:

```
B kendi aboneliği: 1 | C'nin gördüğü: 0
C'nin gördüğü ayar: 12 | bozulan ayar: 0
```

**Senaryo 33 ikiye bölündü:** reddedilen yazım aynı işlemde bırakılsaydı
RLS reddi işlemi abort ediyor ve sonraki `select` hiç koşmuyordu — iddia
sessizce hiçbir şey sınamıyordu (D26 dersi). İlk koşuda tam olarak bu
oldu ve diff'te fazladan bir "transaction is aborted" satırı gördüm.

### check:all

`check:types`, `check:lint`, `check:boot` — üçü de temiz.

### Canlı doğrulama (gerçek süper admin oturumuyla)

```
/siralama                 200 | Zirve, ödül var, Bireysel
/bildirimler              200 | support_reply YOK, "Destek yanıtı" VAR, "Aç" VAR
/ayarlar                  200 | Bildirimlere izin ver
/profil                   200 | "Kartı yana kaydır" YOK, flip-scene VAR
/admin/siralama-odulleri  200 | Ödül ayarları, Geçmiş dağıtımlar
/kesfet                   200 | scrollbar-none
/                         200 | Şehrin için bildir, reward-pill
/sw.js                    200
/favicon.ico              200
```

---

## Sapmalar

1. **`/destek/[id]` rotası açılmadı.** Destek tek sayfa; `?talep=<id>` ile
   çözüldü.
2. **Push SQL'den akan işlemlerde gönderilmiyor.** Gerekçe yukarıda.
3. **FAZ O (ödül kartı v4) kısmen:** uygunluk ayrımı, kilit katmanı ve
   "ALABİLİRSİN" durumu D29'da yapılmıştı; bu dilimde yalnız bakiye
   şeridindeki "N ödül hazır" sayacı vardı. Buzlu cam katmanı ve "en
   yakın alınabilir ödüle kalan" satırı YAPILMADI — açık borç.
4. **FAZ V (genel cila) kısmen:** buton/ikon dili D29'da kurulan
   `press-soft` / `btn-chunky` / gradyan CTA sabitleriyle bu dilimde
   ana sayfa ve sıralamada uygulandı; tüm ekranların taranması
   yapılmadı — açık borç.
5. **Rozet kutlamasında rozet ADI gösterilmiyor**, yalnız sayı. Ana sayfa
   rozet listesini çekmiyor (yalnız sayım) ve bunun için ek sorgu açmak
   istemedim.

---

## Sabah turu

1. **Vercel ortam değişkenleri:** `NEXT_PUBLIC_VAPID_PUBLIC_KEY`,
   `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `SUPABASE_SERVICE_ROLE_KEY`.
   Bunlar olmadan push sessizce devre dışı (uygulama çalışır).
2. `/ayarlar` → "Bildirimlere izin ver" → izin ver. Sonra bir teslimi
   panelden onayla; telefonda bildirim gelmeli.
3. `/bildirimler` → hiçbir yerde `support_reply` gibi ham tip
   OLMAMALI; her satır tıklanınca doğru sayfaya gitmeli. Sayfayı açıp
   çıkınca çan sayacı sıfırlanmalı.
4. **Kendi destek talebine kendi yanıt ver** → sayaç ARTMAMALI.
5. **Bir test hesabını sil** → silme başarılı olmalı (M28'de kırılmıştı).
6. `/siralama` → Zirve podyumu (1 üstte, 2-3 altta yan yana), "Bu hafta
   ilk 3'e ödül var" şeridi, çipler parmakla rahat basılmalı.
7. `/admin/siralama-odulleri` → bir miktarı değiştirip kaydet.
8. `/profil` → karta herhangi bir yerden dokun, çevrilmeli. İpucu metni
   olmamalı.
9. `/kesfet` → şeritlerin altında kaydırma çubuğu olmamalı; taşan
   şeritlerde ok düğmeleri görünmeli.
10. Ana sayfa → "Şehrin için bildir" ilk ekranda görünmeli.

---

## Açık borçlar

- FAZ O'nun buzlu kilit katmanı ve "en yakın alınabilir ödül" satırı.
- FAZ V'nin tüm ekran taraması.
- Rozet kutlamasında rozet adı.
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
