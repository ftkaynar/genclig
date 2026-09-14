# Gece Vardiyası 4 — DİLİM 23

## FAZ C — Bölge topluluğu (M22)

**Migration:** `20260918000000_community.sql`

`channels` (ilçe bazlı, `unique(scope, district_id)`), `channel_messages`
(1–500 karakter kısıtı, soft delete), `message_reports`
(`unique(message_id, reporter_id)`), `user_mutes` (global ya da kanal
bazlı). `notifications.type` check'ine `'community'`.

**Seed:** İstanbul'un **39 ilçesi** için birer kanal.

### Tasarım kararları ve gerekçeleri

**Salt metin.** Fotoğraf, bağlantı ve özel mesaj ilk sürümde bilerek yok —
dilimin DOKUNMA listesinde de öyle. Moderasyon kuyruğu ve susturma
sonradan eklenen değil, en baştan var.

**Soft delete.** Mesaj silinince satır kalıyor. Sert silme olsaydı "bu
kullanıcı ne yazmıştı" sorusuna cevap veremezdik ve tekrarlayan ihlalleri
göremezdik. Kullanıcı tarafında `is_deleted = false` filtresi var, personel
silinmişleri de görüyor.

**Otomatik gizleme eşiği 3.** Üç farklı kişi raporlayınca mesaj otomatik
gizleniyor. Neden otomatik: moderatör gece 3'te kuyruğa bakmıyor ve zararlı
bir mesajın saatlerce görünür kalması, yanlışlıkla gizlenmiş bir mesajdan
daha büyük zarar. Neden 3: bir ya da iki kişi anlaşıp masum bir mesajı
gizleyebilirdi. Yanlış gizleme geri alınabilir (`moderate_restore`).

**Hız sınırı iki katmanlı ve sunucuda:** son 10 saniyede mesaj varsa
reddediliyor (arka arkaya spam), son 1 dakikada 5 mesaj varsa reddediliyor
(yavaş ama sürekli spam). İstemci sayacı yetmezdi; istek doğrudan da
atılabilir.

**Global susturmayı yalnızca süper admin verebilir.** Belediye personeli
kendi kanalıyla sınırlı; aksi halde bir ilçenin moderatörü kullanıcıyı tüm
ülkede susturabilirdi.

**Başka ilçenin mesajı raporlanamıyor.** Raporlama kanal izolasyonunu
delmenin dolaylı yolu olurdu.

**18 yaş altı uyarı şeridi kapatılamıyor.** Kapatılabilir bir uyarı ilk gün
kapatılır ve bir daha görünmez. Doğum tarihi **boş** olan hesap da uyarı
alıyor: boş bir alandan "yetişkin" sonucu çıkarmak çocuk güvenliğinde
yanlış yöndeki varsayım; fazladan uyarı zarar vermiyor, eksik uyarı veriyor.

### Kanıtlar (yerel psql, 15 senaryo)

- İstanbul için **39 kanal** seed'lendi
- A yalnızca kendi ilçe kanalını görüyor (1 kanal: "Adalar Topluluğu")
- **Hız sınırı:** ikinci mesaj anında → "Biraz yavaş, birkaç saniye bekle."
- **Kanal izolasyonu:** başka ilçedeki D, A'nın mesajını görmüyor
  (ham tablo 0, RPC listesi 0); aynı ilçedeki B görüyor
- Kendi mesajını raporlayamıyor; başka ilçenin mesajını raporlayamıyor
- **Otomatik gizleme:** 1 rapor → `f`, 2 rapor → `f`, **3 rapor → `t`**
- Gizlenen mesaj kullanıcı listesinde yok (0), moderatör kuyruğunda var
  (3 rapor, `is_deleted t`)
- Normal kullanıcı kuyruğu göremiyor (0) ve silemiyor
- Moderatör susturunca kullanıcıya `community` bildirimi gidiyor ve
  yazma reddediliyor
- Personel **global** susturma yapamıyor
- Moderatör geri açabiliyor; açık rapor 0'a düşüyor
- Doğrudan insert → `permission denied`; anon post/list/select ve
  authenticated insert → hepsi `false`
- İlçesi olmayan kullanıcı → "Önce ilçeni ayarla."

### UI

`/topluluk` — sohbet düzeni (en yeni altta, otomatik kaydırma), kendi
mesajın sağda gradyan baloncuk, diğerleri solda kart; kullanıcı adına
dokununca profil kartı modalı ve **Arkadaş ekle**. 500 karakter sayacı,
⋯ menüsünde Rapor et / Sil. 30 saniyelik yoklama (gerçek zamanlı kanal
DOKUNMA listesinde).

`/panel/moderasyon` ve `/admin/moderasyon` — açık rapor kuyruğu; Sil /
Geri aç / Kullanıcıyı sustur (süre seçimi) / Raporu kapat. "Sil" ile
"raporu kapat" bilerek ayrı: haksız yere raporlanmış bir mesajda doğru
karar silmek değil raporu kapatmak.

Ana sayfa hızlı erişim ızgarasında **Destek'in yerini Topluluk aldı** —
sohbet günlük kullanılan bir ekran, destek yalnızca sorun çıkınca
aranıyor. Destek `/profil` üzerinden erişilebilir durumda.

### Yol boyunca çıkan hata

`react-hooks/purity`: susturma durumunu `Date.now()` ile karşılaştırıyordum
(aynı kurala D07'de geri sayımda takılmıştık). Doğru çözüm karşılaştırmayı
sunucuya taşımak bile değildi — `my_channel` RPC'si `muted_until` alanını
zaten `until > now()` koşuluyla dolduruyor, yani dolu olması "şu an
susturulmuş" demek. Karşılaştırma tamamen gereksizmiş.

---

## FAZ Q — Quiz doğrulaması (M23)

**Migration:** `20260918010000_quiz.sql`

`task_quiz_questions` (soru, `options` jsonb 2–6 şık, `correct_key`, sort),
`get_task_quiz`, `submit_quiz`, `quiz_pass_ratio()`.

### Kritik güvenlik noktası: doğru cevap sızmıyor

`correct_key` hiçbir koşulda kullanıcıya gitmiyor:
- Ham tabloda kullanıcı için **select politikası yok**; okuyabilen tek
  kesim süper admin ve görevin belediyesindeki personel (soruyu onlar
  yazıyor).
- Sorular yalnızca `get_task_quiz` üzerinden geliyor ve fonksiyonun dönüş
  tipinde `correct_key` sütunu **hiç bulunmuyor**:
  ```
  get_task_quiz | TABLE(id uuid, question text, options jsonb, sort smallint)
  ```
- Karşılaştırma veritabanında yapılıyor; istemciye yalnızca kaç doğru
  yapıldığı dönüyor.

**Denenen ve elenen alternatif:** tabloya sütun bazlı select yetkisi verip
(`grant select (id, task_id, question, options, sort)`) politika yazmak.
Elendi, çünkü PostgREST sütun listesini `select=*` ile genişletebiliyor ve
tek bir yanlış yapılandırmada anahtar sızıyordu; fonksiyon sınırı daha dar
ve gözle denetlenebilir.

### Neden pending teslim açılmıyor

Quiz insan incelemesi gerektirmiyor; cevap ya doğru ya yanlış. Kalan
kullanıcı tekrar denemeli. `pending` bir satır açılsaydı
`task_submissions_open_unique` ikinci denemeyi engellerdi ve kullanıcı
görevi bir daha **hiç** yapamazdı. Bu yüzden yalnızca geçince `approved`
satır yazılıyor.

**Geçme eşiği %80**, şimdilik `quiz_pass_ratio()` fonksiyonunda sabit.
`tasks` tablosuna taşınabilir ama görev başına eşik ayarlamanın bir ihtiyaç
olduğu henüz ölçülmedi; hiç kullanılmayan bir kolon taşımaktansa sabitle
başlayıp gerekirse çevirmek daha iyi.

### Kanıtlar (yerel psql)

- `get_task_quiz` üç soruyu şıklarıyla döndürüyor, **doğru anahtar yok**
- Fonksiyon imzası: `TABLE(id, question, options, sort)` — `correct_key`
  yok
- Kullanıcı ham tablodan **0 satır** görüyor
- Hepsi yanlış (0/3) → `passed f`, teslim 0, XP satırı 0
- 2/3 doğru (%66) → `passed f`, teslim hâlâ 0 (eşik %80)
- 3/3 doğru → `passed t`, teslim `approved`, XP 70 + rozet 20,
  Coin 35 + rozet 10
- İkinci kez geçme denemesi → "Bu görevi zaten tamamladın."
- Quiz olmayan göreve `submit_quiz` → "Bu görev test görevi değil."
- anon: `get_task_quiz`, `submit_quiz`, ham tablo select → hepsi `false`

**Seed:** "Belediye tarih müzesini ziyaret et" görevi + 3 soru.

### UI

Görev detayında `verification = "quiz"` ise SubmitTask yerine
**QuizRunner**: "Testi çöz · N soru" → soru soru ilerleyen radyo ekranı
(ilerleme çubuğu, geri/ileri), sonuç ekranı (doğru/yanlış dağılımı, yüzde).
Geçince mevcut `Celebration` bileşeni açılıyor; kalınca "Tekrar dene".

Panel/admin görev formunda `verification = quiz` seçilince **QuizEditor**
görünüyor: soru + 2–6 şık, doğru şık yeşil tikle işaretleniyor, ekle/sil.
Şık silinince anahtarlar yeniden harfleniyor — aksi halde "a, c" gibi
boşluklu bir dizi kalıyor ve doğru şık işareti kayabiliyordu.

Sorular görev kaydından **sonra** yazılıyor: yeni görevde soruların
bağlanacağı id ancak kayıt dönünce belli oluyor. Kaydetme stratejisi
sil-ve-yeniden-yaz; teslimler soru satırlarına bağlı değil, bu yüzden
geçmiş veri bozulmuyor.

---

## FAZ L — Sıralama sekmeleri v2

`src/components/leaderboard/scope-tabs.tsx` — görev ekranıyla aynı dil:
üstte ikonlu kapsam çipleri (seçilide marka gradyanı), altında dönem
hapları (Hafta / Ay / Tümü).

**Görev ekranındaki segment anahtarı burada kullanılmadı.** Orada iki
seçenek vardı ve kayan gösterge okunuyordu; burada **altı** kapsam var ve
aynı bileşen 360 px genişlikte sıkışıp okunmaz hâle geliyordu. Bunun
yerine yatay kaydırmalı çip şeridi, seçili çip gradyanla dolduruluyor.

**Kapsam ikonları hiyerarşiyi anlatıyor:** Türkiye `globe`, İl `map-pin`,
İlçe `compass`, Mahalle `home` (giderek daralan konum katmanları),
Arkadaşlar `users`, Takımlar `shield`. Altı ikonun hepsi küratörlü kümede
mevcuttu, yeni ikon eklenmedi.

Kapsam ve dönem URL sorgusunda kalmaya devam ediyor; podyum ve "benim
sıram" kartı korundu.

**Boş durumlar birleştirildi:** üç ayrı metin ("Bu dönemde henüz puan
yok", "Bu dönemde takım puanı yok") tek bir dile getirildi —
**"Bu kategoride henüz sıralama yok"** — ve kapsama uygun eylem butonu
korundu (takımda "Takımıma git", konum eksikse "Konumunu ayarla").

---

## FAZ Z — Kapanış

### Bulut push

```
20260918000000_community.sql   (M22)
20260918010000_quiz.sql        (M23)
```

Kapanış kontrolü:

```
db push --dry-run  → {"upToDate":true,"migrations":[]}
db diff --linked   → No schema changes found
```

### Bulut REST doğrulaması (anon anahtarla)

Tablolar — hepsi **401** (anon'un tablo yetkisi hiç yok, RLS'e sıra
gelmiyor):
`channels`, `channel_messages`, `message_reports`, `user_mutes`,
`task_quiz_questions`.

RPC'ler doğru argümanlarla — hepsi **401** (PostgREST şemada görüyor,
yetki kapalı): `post_message`, `get_task_quiz`, `submit_quiz`,
`list_channel_messages`, `moderate_delete`, `mute_user`.

### `rls_isolation.sql` — SENARYO 26 ve 27

Dosya 815 satır. Tam koşumda **19 `ERROR` satırının hepsi beklenen
reddetme**; beklenmeyen hata yok.

**SENARYO 26 (topluluk izolasyonu):**
- B kendi kanalını (1) ve kendi mesajını (1) görüyor
- **C başka ilçede ve yetkisiz: mesaj listesi 0, ham tablo 0, kanal 1**
  (yalnızca kendi kanalı)
- C başka ilçenin mesajını raporlayamıyor
- Süper admin 39 kanalı görüyor (moderatör olarak, beklenen)
- Doğrudan insert → `permission denied`

**Yol boyunca çıkan hata (testte, kodda değil):** ilk yazdığım senaryoda
izolasyonu A kullanıcısıyla sınıyordum, oysa A SENARYO 6'dan beri
**süper admin**. 39 kanalı görmesi ve raporlayabilmesi doğru davranış,
izolasyon kanıtı değil. Senaryo yetkisiz C ile yeniden yazıldı; ilk hâli
kodda bir sızıntı varmış gibi görünüyordu, yoktu.

**SENARYO 27 (quiz gizliliği):**
- `get_task_quiz` dönüş tipi: `TABLE(id, question, options, sort)` —
  `correct_key` **yok**
- Kullanıcı 3 soruyu görüyor, ham tablodan **0 satır** görüyor
- Boş cevap → `passed f`, 0/3, teslim 0
- Doğru cevaplar → `passed t`, 3/3, teslim `approved`, XP 70
- anon: sorular, teslim, ham tablo → hepsi `false`

`provinces` 81, `profiles` 3 — test verisi sızıntısı yok.

### `pnpm check:all`

Her fazın sonunda koşuldu, hepsinde çıkış kodu **0**.

### Bilinçli kapsam dışı

DOKUNMA listesi korundu: sohbette **fotoğraf ve bağlantı yok** (ilk sürüm
salt metin), **özel mesajlaşma yok**, push notification yok, Supabase
bölge taşıma yapılmadı, çark/çekiliş yok.

Ayrıca borç olarak duruyor:
- **Gerçek zamanlı sohbet** — şu an 30 saniyelik yoklama var. Supabase
  realtime kanalları bu dilimin DOKUNMA listesindeydi.
- **Quiz geçme eşiği** `quiz_pass_ratio()` içinde sabit; görev başına
  ayarlanabilir olması istenirse `tasks` tablosuna kolon gerekiyor.
- **Kanal kapsamı** yalnızca ilçe ve yalnızca İstanbul için seed'li.
  `channels.scope` sütunu il/mahalle için yer tutuyor ama davranış yok.

### Sabah görsel turu

1. **`/topluluk`** — sohbet baloncukları (kendi mesajın sağda gradyan),
   kullanıcı adına dokununca profil kartı + Arkadaş ekle, 500 karakter
   sayacı, ⋯ menüsünde Rapor et / Sil
2. **18 yaş altı uyarı şeridi** — turuncu, kapatılamaz (doğum tarihi boş
   bir hesapla da görünmeli)
3. **İlçesiz kullanıcı** — "Önce ilçeni ayarla" boş durumu
4. **Hız sınırı** — arka arkaya iki mesaj gönderip "Biraz yavaş" uyarısını
   görün
5. **`/panel/moderasyon` ve `/admin/moderasyon`** — rapor kuyruğu; Sil /
   Geri aç / Sustur (süre seçimi) / Raporu kapat. Admin'de "Tüm kanallarda
   sustur" butonu görünür, panelde görünmez
6. **Quiz görevi** — "Belediye tarih müzesini ziyaret et" → Testi çöz,
   soru soru ilerleme çubuğu, yanlış cevapla sonuç ekranı ve "Tekrar dene",
   doğru cevapla kutlama
7. **Panel görev formu** — `verification = quiz` seçince soru editörünün
   açılması; şık ekleme/silme ve doğru şık tikinin kaymadığını doğrulayın
8. **`/siralama`** — ikonlu kapsam çipleri (globe → map-pin → compass →
   home → users → shield), seçili çipin gradyanı, altta dönem hapları
9. **Boş durum** — "Bu kategoride henüz sıralama yok"
10. Ana sayfa hızlı erişimde **Topluluk** (Destek'in yerini aldı; Destek
    `/profil` üzerinden)

### Dilim özeti

Dört faz, dört commit, hepsi push'landı. İki migration buluta gitti,
`db diff --linked` temiz, `check:all` her fazda 0.

**Bulunan ve düzeltilen hatalar:**
1. `react-hooks/purity` — susturma durumunu `Date.now()` ile
   karşılaştırıyordum. Doğru çözüm karşılaştırmayı taşımak değil,
   tamamen kaldırmaktı: `my_channel` RPC'si `muted_until` alanını zaten
   `until > now()` koşuluyla dolduruyor.
2. `ModerationRow` tipinde `channel_id` yoktu ama bileşende
   kullanıyordum; RPC'ye kolon eklendi.
3. RLS senaryosunda izolasyonu süper admin kullanıcıyla sınamıştım
   (yukarıda).
