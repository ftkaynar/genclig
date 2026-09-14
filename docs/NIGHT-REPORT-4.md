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
