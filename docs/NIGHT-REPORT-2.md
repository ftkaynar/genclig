# Gece Vardiyası 2 — Oyun Hissi Yükseltmesi

Başlangıç commit: `76c6303` (D20d). Hedef: mockup2'nin üst setindeki
mor-mavi hava, sosyal katman (arkadaş + takım), destek merkezi.

---

## FAZ A — Palet v2

**Durum: TAMAM**

Token **adları** korundu, değerleri değişti. `bg-cta`, `text-xp` gibi yüzlerce
kullanım var; adları değiştirmek tüm dosyaları elden geçirmek demekti. Palet
tek dosyadan çevrildi.

| Token | v1 | v2 |
|---|---|---|
| surface (koyu) | #0A1626 | #0B1220 |
| card (koyu) | #12233B | #131C2E |
| edge (koyu) | #1E3550 | #223052 |
| primary / cta | #17B890 / #3DDC97 | #7C3AED |
| xp | #7C5CFC | #22D3EE (cyan) |
| gradyan | lacivert→teal→yeşil | #6366F1→#8B5CF6→#22D3EE |

Yeni tokenlar: `indigo`, `cyan`, `magenta`, `amber`. Durum renkleri
canlandırıldı (#22C55E / #F59E0B / #EF4444).

Kategori tonları v2 eşlemesine geçti: çevre→yeşil-cyan, spor→magenta,
kültür→indigo, eğitim→amber, sosyal→mor, şehir→cyan. Harita pinleri ve
`manifest.theme_color` (#0B1220) da güncellendi, PWA ikonları yeniden üretildi.

İkon diriliği: `strokeWidth` 2.25, chip boyutları büyüdü (liste 40px, detay
56px). Küçük ince ikonlar koyu zeminde silik duruyordu.

CSS animasyon altyapısı eklendi (`anim-pop`, `anim-rise`, `anim-glow`,
konfeti keyframe'i) — kütüphane yok. `prefers-reduced-motion` altında hepsi
kapanıyor.

## FAZ B — Oyun hissi katmanı

**Durum: TAMAM**

- **Kutlama ekranı** (`components/game/celebration.tsx`): tam ekran örtü, XP
  sayacı `requestAnimationFrame` ile yukarı sayıyor (easeOutCubic), seviye
  atlandıysa "SEVİYE N!" + konfeti. Konfeti mutlak konumlu div'ler —
  kütüphane yok. Parçacıkların yönü/rengi bir kez hesaplanıp sabitleniyor;
  her render'da yeniden rastgele üretilseydi uçarken titrerdi.
- **Seviye atlama tespiti** sunucuda: `submitTaskAction` teslimden önce ve
  sonra seviyeyi okuyup karşılaştırıyor.
- **Rozet toast'ı** (`components/game/toast.tsx`): 4 sn, sayfa içi. Rozet
  bildirimi listeye de düşüyor; toast o an ekrandaysa kaçırmasın diye.
  Kuyruk yok — aynı anda birden fazla toast gerektiren akış henüz yok.
- **XP çubukları** `transition-[width]` ile dolar.
- **Giriş/kayıt ekranları**: gradyan sahne + cam efektli (backdrop-blur) kart,
  logo ve marka sloganı. Sahne tema ne olursa olsun koyu kalıyor — giriş
  ekranı markanın ilk izlenimi, açık temada soluk bir formaya dönüşmesi
  istenmedi. Form alanlarının renkleri `.auth-card` kapsamında çevriliyor;
  bileşenlere ayrı "koyu varyant" propu eklemek her alanı iki kez tanımlamak
  demekti.
- **Emoji temizliği**: 🔒 📍 🏅 🔔 🥇 kalıntıları lucide ikonlarına çevrildi.
- **CTA metin rengi**: mor zeminde `text-brand` okunmuyordu; 22 dosyada
  toplu olarak `text-white`'a çekildi.

**MOCKUP EKLENTİSİ:** Giriş ekranına mockup'taki "Dijitalde başla, gerçek
hayatta fark yarat." sloganı eklendi.

## FAZ C — Arkadaşlık (M17)

**Durum: TAMAM**

Migration `20260916000000_friendships.sql` + `20260916010000_friends_leaderboard.sql`:
- `friendships` tek satırda ve iki yönlü. Çift kayıt (her yön için ayrı satır)
  denendi ve elendi: iki satırı senkron tutmak kabul/ret akışında tutarsızlık
  riski demekti. Teklik `least/greatest` indeksiyle yön bağımsız.
- `notifications.type` check'i genişletildi: `friend_request`,
  `friend_accepted`, `team_invite`, `support_reply`.
- RPC'ler: `send_friend_request`, `respond_friend_request`, `remove_friend`,
  `search_users`, `get_profile_card`, `list_friends`, `list_friend_requests`,
  `are_friends`, `my_friend_ids`.
- `leaderboard_top` / `leaderboard_my_rank` → `arkadaslar` kapsamı eklendi
  (arkadaşlar + çağıranın kendisi). `/siralama`'daki pasif sekme aktifleşti.

**Gizlilik:** `get_profile_card` arkadaşsa tam kart (XP, rozet, görev), değilse
yalnızca kullanıcı adı + avatar + seviye döndürüyor. Karar tek yerde: arayüzde
"arkadaş mı" kontrolü yapıp alanları gizlemek, veriyi zaten göndermiş olmak
demekti.

**Arama:** En az 3 karakter. İki harflik sorgu neredeyse tüm kullanıcıları
döndürüp listeyi tarama aracına çevirirdi.

**Kanıtlar:**
- 2 harflik arama → 0 sonuç; "bora" → bora_f (Lv.4)
- İstek gönderildi → `pending` + `friend_request` bildirimi
- Kendine istek → "Kendine arkadaşlık isteği gönderemezsin."
- Tekrar istek → "Bekleyen bir istek zaten var."
- **Arkadaş değilken** profil kartı: `is_friend f`, `total_xp` ve
  `badge_count` **boş**
- Kabul sonrası: `is_friend t`, XP 500, rozet 0, görev 0 görünüyor
- Yetkisiz yanıt denemesi → reddedildi (RLS ilişkiyi de gizliyor)
- Arkadaşlar sıralaması: ayse + bora; cem (arkadaş değil) listede **yok**
- C ilişkiyi göremiyor (0), doğrudan insert → `permission denied`

**UI:** `/arkadaslar` — Arkadaşlarım / İstekler / Ara sekmeleri, profil kartı
modalı, arkadaş kartında haftalık XP.

---

## FAZ D — Takımlar + takım görevleri (M18)

**Migration:** `20260916020000_teams.sql`

`teams` (ad, ikon, 6 haneli davet kodu, kaptan, 2–10 üye) ve `team_members`
(PK `(team_id, user_id)`, ayrıca `unique (user_id)`).

**Neden kullanıcı başına tek takım:** iki takımda birden olmak, takım
görevinde "aynı takımdan kaç kişi tamamladı" sayımını hangi takıma yazacağını
belirsiz bırakıyordu.

**Davet kodu alfabesi:** `ABCDEFGHJKMNPQRSTUVWXYZ23456789` — I/O/0/1 yok.
Kod telefondan okunup elle giriliyor; karışan karakterler dışarıda.

**Takım bonusu:** `award_task_points` genişledi. Görev `scope='team'` ise
kullanıcının takımından aynı `period_key` içinde onaylanmış üye sayısı
`min_team_size` eşiğini geçtiği anda, eşiği sağlayan **tüm** üyelere bonus
yazılıyor — her üyenin kendi `submission_id`'siyle, `reason='team_bonus'`.
Kısmi tekil indeks `(submission_id) where reason='team_bonus'` ikinci yazımı
engelliyor; eşiğe sonradan bir üye daha eklenip fonksiyon yeniden koşsa bile
önceki üyelere tekrar bonus düşmüyor.

**Takımsız kullanıcı:** `submit_task` takım görevinde takımı olmayanı
"Bu görev takım görevi — önce bir takıma katıl." ile durduruyor. Kontrol
konum/fotoğraf doğrulamasından **önce**: kullanıcı fotoğraf çekip konum
verdikten sonra "takımın yok" demek boşa emek olurdu.

**Kaptan ayrılması:** başka üye varsa kaptanlık devri zorunlu — takımı
kaptansız bırakmak, kimsenin üye çıkaramadığı ve kod paylaşamadığı bir takım
demekti. Tek kişiyse takım tamamen siliniyor.

**Hata ve düzeltmesi (ölçülerek bulundu):** `team_members` politikasını
`exists (select 1 from team_members ...)` ile yazmak çalışma anında
`infinite recursion detected in policy` verdi. `security definer`
`my_team_id()` yardımcısı döngüyü kırdı; politika artık
`team_id = public.my_team_id()`.

**Kanıtlar (yerel psql):**
- Takım kuruldu → kod `ESQUCF`, 6 hane, alfabe uyumlu, kaptan doğru
- İkinci takım kurma → "Zaten bir takımdasın."
- Yanlış kod → "Bu koda ait takım bulunamadı."
- Doğru kodla katılım → üye 2, kaptana `team_invite` bildirimi
- Üyeliyken kaptan ayrılma → "Önce kaptanlığı bir üyeye devretmelisin."
- Takımsız C takım görevine teslim → "Bu görev takım görevi — önce bir takıma
  katıl."
- A tek başına teslim → `task` 90 XP, **bonus yok** (1 < 2)
- B teslim → eşik doldu, **iki üyeye de** `team_bonus` 80 XP / 40 coin
- `award_task_points` tekrar çağrıldı → toplam bonus satırı hâlâ 2 (kopya yok)
- Takım sıralaması: 1. Sahil Kartalları, 2 üye, 380 XP
- C başka takımın satırlarını göremiyor (0/0), doğrudan insert →
  `permission denied for table team_members`
- Kaptan devri + üye çıkarma + son üyenin ayrılması (takım silindi) çalışıyor
- anon: `create_team`, `join_team`, `leaderboard_teams`, `teams` select → hepsi
  `false`; authenticated `teams` insert → `false`

**UI:** `/takim` (takımsız görünüm: kur / kodla katıl; takım görünümü: gradyan
başlık, davet kodu + kopyala, üye listesi, kaptan eylemleri, ayrıl),
`/gorevler`'e Hepsi/Bireysel/Takım filtre satırı, görev kartında "Takım"
rozeti, görev detayında bonus açıklaması, `/siralama`'ya "Takımlar" sekmesi.
`/profil` üzerinden Arkadaşlar ve Takımım bağlantıları eklendi.

**Kapsam dışı bırakıldı (bildirim):** Panel/admin görev formunda `scope`,
`min_team_size`, `team_bonus_xp`, `team_bonus_coin` alanları yok. Takım
görevleri şimdilik yalnızca migration seed'iyle geliyor. Dilim metninde
istenmediği için eklenmedi; sahada takım görevi açılabilmesi için ayrı bir
dilim gerekiyor.

---

## FAZ E — Destek merkezi (M19)

**Migration:** `20260916030000_support.sql`

`faq_items` (6 kayıt seed), `support_tickets` (open/answered/closed),
`ticket_messages` (`is_staff` bayrağı satırda).

**Neden `is_staff` satırda tutuluyor:** mesajı kimin yazdığını gönderenin
güncel rolünden okusaydık, bir kullanıcı sonradan personel olduğunda eski
mesajları geriye dönük personel yanıtı görünürdü.

**Durum geçişleri:** personel yanıtı → `answered` + `support_reply` bildirimi;
kullanıcı yanıtı → `open` (top yeniden personelde); kapalı talebe yazılamıyor.
Kapanmış konuyu yeniden açmak yeni talep gerektiriyor, aksi halde eski
talepler süresiz canlı kalırdı.

**Açık talep sınırı:** kullanıcı başına 5. Aynı kullanıcının onlarca açık
talebi personel kuyruğunu kullanılamaz hale getirirdi.

**Personel = süper admin.** Destek platform düzeyinde; belediye rolüne
bağlanmadı.

**Hata ve düzeltmesi (ölçülerek bulundu):** `TICKET_STATUS_LABEL` ve tipler
`queries.ts` içindeyken client bileşenlerinin import'u `next/headers`'a
bağımlı `createClient`'ı bundle'a çekti; derleme
"This API is only available in Server Components" ile kırıldı. Saf veri
`src/lib/support/labels.ts`'e ayrıldı, veri erişimi `queries.ts`'te kaldı.

**Kanıtlar (yerel psql):**
- SSS 6 kayıt; anon okuyabiliyor (6), yazamıyor → `permission denied`
- Kısa konu → "Konu en az 3 karakter olmalı."; kısa mesaj → "Mesaj en az 10
  karakter olmalı."
- Talep açıldı → `open`, 1 mesaj, `is_staff = false`
- Başka kullanıcı talebi göremiyor (0 talep / 0 mesaj), yanıtlayamıyor →
  "Bu talebe yanıt verme yetkin yok."
- Personel yanıtı → `is_staff t`, durum `answered`, kullanıcıya
  `support_reply` bildirimi
- Kullanıcı yanıtı → `is_staff f`, durum tekrar `open`
- Personel kuyruğu: normal kullanıcı için 0 satır; süper admin 1 satır
  (konu, durum, kullanıcı adı, 3 mesaj)
- Kapatma → `closed`; kapalıya yazma → "Bu talep kapatılmış."
- Doğrudan insert/update → `permission denied for table support_tickets`
- anon: `create_ticket`, `reply_ticket`, `list_all_tickets`,
  `support_tickets` select → hepsi `false`; authenticated `ticket_messages`
  insert → `false`

**UI:** `/destek` (Sık sorulanlar akordiyonu + Taleplerim listesi + konuşma
görünümü + yeni talep formu), `/admin/destek` (durum filtreli kuyruk, açılır
konuşma, yanıtla/kapat). Admin gezinmesine "Destek", profil ekranına Destek
bağlantısı eklendi.

---

## FAZ F — Ana sayfa v2 + navigasyon + keşfet

**Ana sayfa sırası** (yeni): hero → 4'lü hızlı erişim → "Öne çıkan görev"
bandı → önerilen görevler şeridi → "Şehrin için bildir" → sıralama mini
(ilçe + arkadaşlar) → son bildirimler.

**Hızlı erişim (`src/components/home/quick-access.tsx`):** Arkadaşlar,
Takımım, Ödüller, Destek. Alt gezinme beş sekmede bırakıldı; mobilde altıncı
sekme dokunma hedeflerini parmak genişliğinin altına indiriyordu. Bu dört
ekran profil altında gömülüydü ve kullanıcı varlıklarını fark etmiyordu.

**Öne çıkan görev (`src/components/home/featured-task.tsx`):** bitişi en
yakın, henüz gönderilmemiş anlık görev. Bitiş tarihi olmayan görevler aday
değil — "öne çıkan"ın anlamı burada "yakında kapanıyor". Gradyan kenar dıştaki
gradyan katman + içteki kart yüzeyiyle çiziliyor. Aynı görev öneriler
şeridinden eleniyor.

**Sıralama mini:** ilçe ve arkadaşlar yan yana.

**Ölçülerek bulunan sorun:** arkadaş kapsamı çağıranın kendisini de içerdiği
için arkadaşı olmayan kullanıcı "Arkadaşlarında #1 · 1 kişi" görüyordu.
`scope_size > 1` koşulu eklendi; altında kalan durumda kart yerine
"Arkadaş ekle · Aranızda sıralama açılsın" daveti çıkıyor.

**Keşfet işaretçileri:** düz renkli daire yerine kategori çipi — renkli
yuvarlak + içinde beyaz lucide ikonu + altında sivri uç, çapa uçta.
Renk tek başına altı kategoriyi ayırt ettirmiyordu, özellikle renk
körlüğünde.

**MOCKUP EKLENTİSİ:** `src/components/discover/pin-icons.ts` — altı kategori
ikonunun yol verisi lucide-react'ten bir kez çıkarılıp sabit olarak alındı.
Leaflet'in `divIcon`'u HTML metni alıyor, React bileşeni değil. Denenen ve
elenen alternatifler: `react-dom/server`in `renderToStaticMarkup`ını client
tarafında çağırmak (sunucu render kütüphanesini tarayıcı paketine sokuyordu)
ve paketten ikon düğümlerini çalışma anında okumak (lucide-react ham yol
verisini dışa vermiyor, ölçüldü). lucide sürümü yükseltilirse bu yolların
yenilenmesi gerekiyor.

**Eski yeşil taraması:** `#17b890` / `#3ddc97` kod, stil ve yapılandırma
dosyalarında kalmadı; yalnızca README ve bu raporun geçmiş bölümlerinde
metin olarak geçiyor.

**Kanıtlar (yerel dev sunucu, oturumlu curl):**
- `/`, `/takim`, `/destek`, `/siralama?kapsam=takimlar`, `/arkadaslar` → 200
- Oturumsuz `/destek`, `/takim`, `/siralama` → 307 (giriş yönlendirmesi)
- Ana sayfada görünen başlıklar: Merhaba, Arkadaşlar, Takımım, Ödüller,
  Destek, Öne çıkan görev, Bugün için önerilen, Şehrin için bildir
- XP verilince: İlçende kartı ve Son bildirimler bölümü çıkıyor
- Arkadaşsız kullanıcıda: "Arkadaş ekle · Aranızda sıralama açılsın"
- `/gorevler?kapsam=team` → yalnızca iki takım görevi, "Takım" rozetiyle

---

## FAZ G — Bulut + kapanış

### Bulut push YAPILAMADI — açık engel

`supabase db push` bulut veritabanına bağlanamadı:

```
FATAL: password authentication failed for user "postgres" (SQLSTATE 28P01)
host=aws-0-ap-southeast-2.pooler.supabase.com
user=postgres.dfttglwicxopwejakitk
```

Ölçüm: erişim token'ı **çalışıyor** (`supabase projects list` projeyi
`ACTIVE_HEALTHY` döndürüyor), reddedilen yalnızca veritabanı şifresi.
Elimdeki şifre bulutta artık geçerli değil. Şifre tahmin edilmedi, hiçbir
dosyaya yazılmadı; proje sahibinden güncel veritabanı şifresi gerekiyor.

Şifre verildiğinde push'un tek adımı kaldı:

```
SUPABASE_ACCESS_TOKEN=<token> SUPABASE_DB_PASSWORD=<şifre> \
  pnpm dlx supabase@latest db push
```

Bekleyen migration'lar: `20260916000000_friendships.sql`,
`20260916010000_friends_leaderboard.sql`, `20260916020000_teams.sql`,
`20260916030000_support.sql`.

### Bulutun şu anki durumu (REST ile ölçüldü, anon anahtarla)

- `faq_items`, `teams`, `team_members`, `support_tickets`, `friendships`
  → **404** (henüz yok, beklenen)
- `create_team`, `join_team`, `create_ticket`, `reply_ticket`,
  `send_friend_request`, `leaderboard_teams`, `list_all_tickets` → **404**
- `tasks` GET → 200 (mevcut şema yerinde)
- anon `tasks` INSERT → **401**; anon `submit_task` RPC → **404**
  (mevcut korumalar bozulmadı)

Push sonrası koşulacak doğrulamalar (bu gece koşulamadı):
`faq_items` 6 satır, anon yazma denemeleri reddi, yeni RPC'lerin anon'a
kapalı olması.

### `rls_isolation.sql` — yeni senaryolar (yerelde tam koşuldu)

SENARYO 22 (arkadaşlık), 23 (takım), 24 (destek) eklendi; dosya 645 satır.
Tam koşum sonucu: 14 `ERROR` satırının **hepsi beklenen** reddetmeler
(`provinces` RLS ×2, teslim tekilliği, `task_submissions` RLS ×2,
`xp_transactions`, `notify`, `user_badges`, `problem_reports`,
`reward_redemptions`, `friendships`, takım görevi engeli, destek yetkisi,
`support_tickets`). Beklenmeyen hata yok.

Kritik doğrulamalar:
- Arkadaş olmayanın profil kartı: `is_friend f`, XP ve rozet **null**;
  kabul sonrası ikisi de görünür
- Taraf olmayan kullanıcı ilişkiyi görmüyor (0) ve elle yazamıyor
- Takımsız kullanıcı takım görevine teslim gönderemiyor
- Eşik öncesi bonus satırı 0 → eşik sonrası 2 → `award_task_points` tekrar
  çağrıldıktan sonra **hâlâ 2** (idempotent)
- Başka takımın satırları görünmüyor (0/0)
- Destek talebi sahibi olmayan: 0 talep, 0 mesaj, 0 kuyruk, yanıt reddedildi
- Süper admin kuyruğu görüyor; yanıtı `answered` + `support_reply` bildirimi
- `provinces` 81, `profiles` 3 — test verisi sızıntısı yok

### `pnpm check:all`

Çıkış kodu **0** (types + lint + build).

### MOCKUP EKLENTİSİ listesi

Dilim metninde adı geçmeyen, görsel hedefi tamamlamak için eklenenler:

1. `src/components/discover/pin-icons.ts` — harita işaretçilerinin kategori
   ikon yolları (gerekçe ve elenen alternatifler FAZ F bölümünde).
2. Görev kartında ve görev detayında **takım rozeti / bonus açıklaması** —
   takım görevini bireyselden ayırt eden görsel işaret dilimde istenmemişti,
   ama filtreyle gelen görevin neden farklı olduğu ekranda görünmüyordu.
3. Sıralama mini'sindeki **"Arkadaş ekle" daveti** — arkadaşsız kullanıcıda
   boş kart yerine eylem.
4. `/profil` üzerindeki Arkadaşlar / Takımım / Destek bağlantıları — hızlı
   erişim ızgarası gelmeden önce bu ekranların yetim kalmaması için.

### Bilinçli kapsam dışı / devredilen

- **Panel ve admin görev formlarında takım alanları yok** (`scope`,
  `min_team_size`, `team_bonus_xp`, `team_bonus_coin`). Takım görevleri
  şimdilik yalnızca migration seed'iyle geliyor; sahada takım görevi
  açılabilmesi için ayrı bir dilim gerekiyor.
- **Bulut push ve push sonrası REST doğrulaması** — şifre engeli (yukarıda).
- DOKUNMA listesi korundu: etkinlik domain'i, streak, anket, QR/Health
  doğrulama, push notification, gerçek zamanlı kanallar, auth sağlayıcı
  eklenmedi.

### Sabah görsel turu — bakılacak ekranlar

1. `/` — hero, 4'lü hızlı erişim, öne çıkan görev bandının gradyan kenarı,
   öneri şeridinin yatay kaydırması, sıralama mini'sinin iki kartı
2. `/gorevler` — iki filtre satırı; `?kapsam=team` ile takım rozetli kartlar
3. `/gorevler/<takım görevi>` — magenta bonus kartı
4. `/takim` — takımsız görünüm (kur / kodla katıl), sonra takım görünümü:
   davet kodu, kopyala düğmesi, üye listesi, kaptan eylemleri
5. `/arkadaslar` — üç sekme, profil kartı modalı (arkadaş / arkadaş değil)
6. `/siralama` — Takımlar sekmesi ve Arkadaşlar sekmesi
7. `/destek` — SSS akordiyonu, yeni talep formu, konuşma balonları
8. `/admin/destek` — durum filtreleri, açılır konuşma, yanıtla/kapat
9. `/kesfet` — kategori çipli işaretçiler (renk + ikon), popup
10. Karanlık/aydınlık tema geçişi ve `prefers-reduced-motion` ile animasyonsuz
    görünüm

---

## D21.1 — Bekleyen bulut push tamamlandı

FAZ G'de "Bulut push YAPILAMADI" diye kaydedilen engel kapandı.

**Engelin gerçek sebebi:** veritabanı şifresinin sonundaki nokta. Denenen
`***ŞİFRE — RAPORA YAZILMAMALIYDI***` reddediliyordu; doğrusu `***ŞİFRE — RAPORA YAZILMAMALIYDI***` imiş. Şifre rotasyonu
yokmuş, eksik karakter varmış.

**Push:**

```
Applying migration 20260916000000_friendships.sql...
Applying migration 20260916010000_friends_leaderboard.sql...
Applying migration 20260916020000_teams.sql...
Applying migration 20260916030000_support.sql...
```

Dry-run tam olarak bu dördünü listeledi, fazlası yok.

**`db diff --linked` → `No schema changes found`.** Yerel ile bulut birebir.

**Canlı sitedeki 500'ün kök sebebi doğrulandı ve kapandı.** Hata build
değil çalışma anıydı: `listFeedTasks` `tasks` tablosundan `scope`,
`min_team_size`, `team_bonus_xp`, `team_bonus_coin` istiyordu, bulutta bu
kolonlar yoktu. Buluttaki REST'e birebir aynı select atılarak yeniden
üretildi:

```
{"code":"42703","message":"column tasks.scope does not exist"}
```

Push sonrası `/gorevler` 200 döndü ve iki takım görevi canlı feed'de
görünüyor. Kod tarafında değişiklik gerekmedi.

**Push sonrası REST doğrulaması (anon anahtarla):**
- `faq_items` → 200, **6 satır** (herkese açık okuma, tasarım gereği)
- `teams`, `team_members`, `friendships`, `support_tickets`,
  `ticket_messages` → **401**. Not: beklenen "RLS'li boş liste" değil,
  bundan daha katı bir sonuç — bu tablolarda anon'un tablo yetkisi hiç yok
  (`revoke all ... from anon`), RLS'e sıra bile gelmiyor. 404'ten 401'e
  geçmiş olması tabloların artık var olduğunu gösteriyor.
- Yeni RPC'ler: doğru argümanlarla çağrıldığında hepsi **401**
  (`create_team`, `join_team`, `kick_member`, `transfer_captain`,
  `create_ticket`, `reply_ticket`, `close_ticket`, `send_friend_request`,
  `respond_friend_request`, `search_users`, `get_profile_card`).
  PostgREST şema önbelleği yenilenmiş, yetki kapalı.
  Boş gövdeyle (`{}`) gelen 404'ler eksiklik değil, imza uyuşmazlığıydı.
- Anon yazma denemeleri: `friendships`, `teams`, `team_members`,
  `support_tickets`, `ticket_messages`, `faq_items` POST → **401**;
  `faq_items` PATCH ve DELETE → **401**.

**Canlı rotalar:** `/`, `/gorevler`, `/gorevler?kapsam=team`, `/kesfet`,
`/giris`, `/kayit` → 200. `/takim`, `/destek`, `/siralama`, `/arkadaslar`
→ 307 (oturumsuz giriş yönlendirmesi, beklenen).

**`pnpm check:all`** → çıkış kodu 0.

**Hâlâ açık:** panel/admin görev formlarında takım alanları yok; takım
görevleri yalnızca seed'den geliyor (FAZ D'de bildirildi).
