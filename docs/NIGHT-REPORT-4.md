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
