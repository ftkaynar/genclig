# Gece Raporu 13 — DİLİM 32

**Görsel düzeltmeler v2 + sınırların kaldırılması + sürekli görev ritmi + görev görselleri**

Commit'ler: `801907d` (D), `29d405c` (H), `e4f167a` (SR2), `a2c96bb` (KE),
`f4d8bc8` (G3), `631e910` (B2), `c68ed52` (NAV2), bu rapor (Z).

---

## 1. Üç teşhis (FAZ D)

### Teşhis 1 — `/gorevler`'de "içerik birden büyüyor"

Kök sebep animasyon değildi. `genclig-rise` yalnız `opacity` ve
`translateY` oynatıyor, düzen kaydırmıyor.

Sebep **kapsayıcı genişliği uyuşmazlığı**ydı:

- iskelet: `max-w-md` (448px)
- sayfa: `max-w-md sm:max-w-3xl lg:max-w-5xl` (448 / 768 / 1024px)

Mobilde ikisi aynı olduğu için sorun yalnız geniş ekranda görünüyordu.
Veri gelince kap 448'den 1024'e atlıyordu. Ayrıca iskelet dikey liste,
sayfa 2-4 sütun kare ızgara çiziyordu.

Sekiz kullanıcı sayfasının kap genişlikleri karşılaştırıldı; uyuşmayan
tek sayfa buydu. İskelet artık kapsayıcıyı ve ızgarayı birebir taklit
ediyor.

### Teşhis 2 — seviye atlama pop-up'ı hiç görünmedi

Dört sebep bulundu; en önemlisi benim hatamdı:

1. **Asıl sebep:** `Arrival` bileşeni D30'da yazıldı ama hiçbir sayfaya
   bağlanmamıştı. D30'da bağlama betiğini koştum, çıktısını doğrulamadım
   ve commit'e girmedi. Bileşen hiçbir yerde render edilmiyordu.
2. Bağlanmış olsa bile çalışmayacaktı: "son görülen durum" modül
   düzeyinde bir kez önbelleğe alınıyordu; istemci tarafı gezinmede ve
   `router.refresh()`'te hiçbir şey görünmüyordu.
3. `Arrival` yalnız ana sayfadaydı; görevi tamamlayıp profile giden
   kullanıcı hiç görmüyordu.
4. İlk ziyaret referans değeri yazıp hiçbir şey göstermiyor (tasarım
   gereği doğru) ama 2 ile birleşince ilk atlama da kaçıyordu.

Düzeltme sonrası ölçüm (beş senaryo):

| senaryo | sonuç |
| --- | --- |
| tam yenileme ile atlama | SEVİYE POPUP (1 → 2) |
| istemci tarafı gezinme ile atlama | SEVİYE POPUP (1 → 2) — kırıktı |
| yalnız XP kazancı | KAZANÇ ŞERİDİ (+250 XP) |
| yeni rozet | ROZET POPUP |
| delta yok | hiçbir şey |

### Teşhis 3 — push uçtan uca

- service worker kaydı: var, ama yalnız kullanıcı anahtara basınca
- `/ayarlar`: anahtar var
- ana sayfa: teşvik kartı **yoktu** → eklendi (kapatılabilir, kapatma
  kalıcı; izin zaten verilmiş ya da reddedilmişse hiç çıkmıyor)
- VAPID env yoksa: sessizce kapalıydı ve hiç uyarı yoktu → tek seferlik
  `console.warn` eklendi

---

## 2. Bölgesel sınırlar kalktı (FAZ KE)

### Tarama listesi — nerede bölge kısıtı var?

| yer | kural | bölgesel kısıt |
| --- | --- | --- |
| Görev akışı (`tasks_select_active`) | `status = 'active'` | **yok** |
| Ödüller (`rewards_select_active`) | `status = 'active'` | **yok** |
| Sıralama kapsamları | Türkiye / il / ilçe / mahalle | kısıt değil, kasıtlı görünüm |
| Keşfet ilçe istatistik kartı | kullanıcının ilçesi | **kaldırıldı** |
| Topluluk kanalı | kullanıcının ili | **kaldırıldı (M30)** |

Tek gerçek bölgesel kilit topluluk kanalıydı. Görev ve ödül akışında
bölge koşulu hiç yoktu — yani "gençler kendi bölgelerine hapsolmuş"
hissi tek bir yerden geliyordu.

### Ne değişti

Kullanıcı artık istediği ilin kanalını okuyup oraya yazabiliyor.
`/topluluk` üstünde arama kutulu il seçici var (varsayılan profil ili,
seçim `?il=` ile URL'de taşınıyor). Kanal çözümü: URL > profil ili >
listenin ilki — ili ayarlı olmayan kullanıcıya artık "önce ilini ayarla"
duvarı çıkmıyor.

**Güvenlik kuralları aynen duruyor:** oran sınırı, susturma, raporlama,
18-altı uyarısı. Oran sınırı **kullanıcı bazlı** (kanal bazlı değil) —
kanal bazlı olsaydı 81 il × 5 mesaj = dakikada 405 mesajlık bir spam
kapısı açılırdı.

Kanıt: `province_community_audit` senaryo 3, izolasyonu sınamaktan
serbest erişimi sınamaya çevrildi ve 3d (il değiştirerek oran sınırı
aşma denemesi) eklendi. 12/12 geçti.

---

## 3. Sürekli görev ritmi ve 06:00 görev günü (FAZ G3)

### Neden 06:00?

Sürekli görevler gündelik alışkanlık kurmak için var. Gece yarısı sınırı
ritmi iki yerden bozuyordu:

1. Gece 00:30'da görev yapan genç, aslında "dünkü" gününü kapatırken yeni
   günün hakkını harcamış oluyordu; sabah kalktığında sayaç zaten dolu
   görünüyordu.
2. Tamamlanma tiki gece yarısı, kimse bakmazken sıfırlanıyordu. Ritim
   hissi için sıfırlamanın kullanıcının **gördüğü** bir anda olması
   gerekiyor: sabah uygulamayı açtığında kart "Tekrar yap" olarak
   karşılıyor.

04:00 denenip elendi: gece çalışan ya da geç yatan kullanıcı için hâlâ
"aynı gün" hissi veriyordu.

Günlük teslim sayacı (`daily_submission_count`) da aynı pencereye
taşındı. İki farklı sınır, "Tekrar yap" yazan karta basıp "bugün için
yeterince gönderdin" hatası almak demekti.

### Kart durumları

| durum | mühür | ne zaman |
| --- | --- | --- |
| Tamamlandı | yeşil tik | bu gün onaylandı |
| İncelemede | turuncu saat | teslim beklemede |
| Tekrar yap | turuncu alev | sürekli görev, gün yenilendi |

Sağ kenardaki 9 punto "Tamamlandı" kurdelesi kalktı; yerine kapak
alanının sol üstünde büyük yuvarlak mühür geldi. Mührü kapakla içeriğin
sınırına oturtmak denendi ve elendi — oradan ödül haplarının üstüne
taşıyordu (ekran görüntüsünde `+80` hapı yarısına kadar kapanıyordu).

Sürekli görev günü yenilendiğinde kart **ana sayfa önerilerine geri
geliyor**. Önceden bir kez gönderilen görev ana sayfadan sonsuza kadar
düşüyordu.

Kanıt: `task_day_window` 10/10 geçti (sınır saatleri, ay/yıl devri, dünkü
teslim, gece 01:00, reddedilen teslim, günlük sınır). TypeScript
tarafındaki `taskDayStart` 8/8 aynı sonucu verdi.

---

## 4. GÖRSEL ŞARTNAMESİ — 20 anime tarzı görev kapağı

**Bu bölüm görsel sipariş ederken kullanılacak.** Yer tutucular şu an
`public/task-art/` altında; gerçek görseller **aynı adla** üzerine
kopyalandığında kodda hiçbir değişiklik gerekmiyor.

### Teknik

| alan | değer |
| --- | --- |
| Adet | 20 |
| En-boy oranı | **3:4 (dikey)** — görev kartının kapak alanıyla aynı |
| Üretim boyutu | **1200 × 1600 px** (2× retina) |
| Teslim boyutu | **600 × 800 px** |
| Biçim | **WEBP**, kalite 80 |
| Dosya başına ağırlık | **≤ 60 KB** (20 dosya toplam ≤ 1.2 MB) |
| Ad | `art-01.webp` … `art-20.webp` (iki haneli, sıfır dolgulu) |
| Konum | `public/task-art/` |
| Şeffaflık | **yok** — tam kaplayan opak görsel |

### Kompozisyon kuralları

1. **Güvenli alan:** kartta görselin **sol üst köşesinde 44 × 44 px**
   (600px genişlikte) durum mührü, **sağ üstünde** zorluk rozeti, **sağ
   altında** kategori ikonu basılıyor. Bu üç köşede önemli detay
   (yüz, metin) olmasın.
2. **Odak merkezde ve hafif altta:** kart `bg-cover bg-center` ile
   kırpıyor; dar ekranda kenarlardan pay gidiyor.
3. **Metin yok.** Görselin içinde hiçbir yazı olmasın — uygulama Türkçe
   ve metin görselden değil koddan geliyor.
4. **Üst yarı koyulaşabilir olmalı:** mühür ve rozetler beyaz metinli;
   üst şerit çok açık tonda olursa okunmuyor.
5. **Palet v2 ile uyum:** mor `#7c3aed`, indigo `#6366f1`, cyan
   `#22d3ee`, magenta `#ec4899`, altın `#f5b301`, yeşil `#22c55e`.
   Görseller bu aileden çıkmasın.

### Üslup

Anime / modern illüstrasyon; 13-25 yaş hedef kitle. Gerçekçi fotoğraf
değil. Türkiye'den tanınabilir ögeler (mahalle dokusu, minibüs, çay
bardağı, apartman cepheleri) serbest ve tercih edilir.

### Konu listesi

| anahtar | konu |
| --- | --- |
| `art-01` | Çevre · ağaç dikimi |
| `art-02` | Toplum · dayanışma |
| `art-03` | Spor · koşu |
| `art-04` | Kültür · sahne |
| `art-05` | Eğitim · kitap |
| `art-06` | Yurttaşlık · meydan |
| `art-07` | Geri dönüşüm |
| `art-08` | Bağış |
| `art-09` | Su ve tasarruf |
| `art-10` | Müzik |
| `art-11` | Bisiklet |
| `art-12` | Tarım · fide |
| `art-13` | Sahil temizliği |
| `art-14` | Tiyatro |
| `art-15` | Kütüphane |
| `art-16` | Kodlama |
| `art-17` | Hayvan barınağı |
| `art-18` | Yaşlı ziyareti |
| `art-19` | Festival |
| `art-20` | Doğa yürüyüşü |

### Görselleri yerine koyma

1. WEBP dosyalarını `public/task-art/` altına kopyala (SVG'lerin üzerine
   yazma, yanına koy).
2. `src/lib/tasks/art.ts` içinde **tek satır**: `taskArtUrl` fonksiyonundaki
   `.svg` uzantısını `.webp` yap.
3. `public/task-art/manifest.json` içindeki `file` alanlarını güncelle
   (ya da `node scripts/generate-task-art.mjs` çalıştırmadan elle düzelt —
   betik yer tutucuları yeniden üretir, gerçek görselleri siler**mez** ama
   manifest'i SVG'ye geri çevirir).
4. Eski `.svg` yer tutucuları sil.

Panel → Görevler → görev formundaki ızgaradan görsel seçiliyor; seçim
`tasks.art_key` alanına **anahtar** olarak yazılıyor (yol değil), yani
dosya düzeni değişirse DB'deki satırlara dokunmak gerekmiyor.

---

## 5. Buton renk kimliği (FAZ B2)

Her ekranın tek bir rengi var; o renk hem butonda, hem ikon chip'inde,
hem kısayol kutucuğunda aynı.

| hedef | renk |
| --- | --- |
| Ödüller | altın |
| Takım | mor |
| Arkadaşlar | cyan |
| Topluluk | magenta |
| Destek | yeşil |
| Görevler / Görevlerim | indigo |

Tek kaynak: `src/lib/ui/accents.ts`. Önceden Takımım ana sayfada magenta,
profilde mor gradyandı; Görevlerim altındı ve Ödüllerle çakışıyordu;
profildeki altı kutucuğun hepsi aynı mor gradyandı ve ızgara tek blok
gibi okunuyordu.

**Yan bulgu — CSS onarımı:** `@keyframes genclig-glow` kapanmıyordu;
`@keyframes genclig-shimmer` ve `.skeleton` kuralı onun **içinde**
kalıyordu. Yani `.skeleton` hiçbir zaman uygulanmıyordu ve tüm yükleme
iskeletleri hareketsizdi. Tek eksik süslü parantez. Kanıt: derlenmiş
CSS'te artık `.skeleton{background-size:200% 100%;animation:1.4s linear
infinite genclig-shimmer}` var, önceki derlemede yoktu.

---

## 6. Alt gezinme v3 (FAZ NAV2)

- **Cam taban:** %88 opak kart + `blur(20px)`. Bulanıklık desteklenmeyen
  tarayıcıda `@supports` ile tam opak karta düşülüyor.
- **Kubbe:** orta düğme artık şeridin üst kenarını kesmiyor; kenar
  düğmenin altında yukarı bükülüyor.
- **Orta düğme her zaman büyük** (h-14 → h-16). Önceden yalnız aktifken
  büyüyordu, yani "ana eylem" vurgusu ancak zaten o ekrandayken
  görünüyordu.
- **Aktif sekme üç sinyal veriyor:** kalın çizgili ikon + renkli chip,
  2px yukarı kayma, altında minik nokta. Noktanın yeri her zaman ayrılı
  (pasifte saydam) — açıp kapamak sekme yüksekliğini değiştiriyor ve
  gezinme her geçişte zıplıyordu.

### Ölçülen düzeltme

Headless Chrome ekran görüntüsünde piksel taramasıyla ölçüldü:

| sabit | eski | ölçülen | yeni |
| --- | --- | --- | --- |
| `has-bottom-nav` | 57px | şerit **74px** | 78px |
| `above-bottom-nav` | 85px | kadran tepesi **95px** | 100px |

Her iki sabit de tahminle yazılmıştı. `has-bottom-nav` 17px eksikti:
listelerin **son kartı ve butonu** gezinme şeridinin altında kalıyordu.

---

## 7. KULLANICI TARAFI PUSH KONTROL LİSTESİ

Push bildirimleri yayına almak için proje sahibinin yapması gerekenler:

1. **Vercel ortam değişkenleri.** VAPID anahtar çifti D30'da üretildi ve
   sohbet mesajında verildi (repoya ve bu rapora yazılmadı). Vercel →
   Project → Settings → Environment Variables:
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (Production + Preview)
   - `VAPID_PRIVATE_KEY` (Production + Preview, **Sensitive** işaretle)
   - `VAPID_SUBJECT` (`mailto:` ile başlayan bir e-posta)
2. **Yeniden dağıt.** `NEXT_PUBLIC_` ile başlayan değişken derleme anında
   gömülüyor; env eklemek tek başına yetmiyor, yeni bir deploy gerekiyor.
3. **Telefonda dene.** Uygulamayı **ana ekrana ekle** (iOS'ta push yalnız
   ana ekrana eklenmiş PWA'da çalışıyor), ana sayfadaki teşvik kartından
   ya da `/ayarlar` → Bildirimler anahtarından izin ver.
4. **Doğrula.** Bir görev teslimini panelden onayla; telefona bildirim
   düşmeli.
5. **Env yoksa ne olur:** uygulama çökmüyor, push sessizce kapalı kalıyor
   ve sunucu log'una tek seferlik bir uyarı düşüyor.

### Bilinen sınır

SQL'den (pg_cron, trigger) doğrulanan yazımlarda push **atılmıyor** —
gönderim Node tarafında. Dönem ödülleri gece cron'la dağıtıldığı için o
bildirimler uygulamaya girince görünüyor, anlık push gelmiyor.

---

## 8. Kanıtlar

### Testler

| suit | sonuç |
| --- | --- |
| `rls_isolation` | 30 beklenen hata — D31 listesiyle **birebir aynı**, fark yok |
| `province_community_audit` | 12/12 geçti |
| `task_day_window` | 10/10 geçti |
| `leaderboard_rewards` | 5/5 geçti |
| `stat_decay` | 7/7 geçti |

`task_day_window` senaryo 6 hata **mesajını** da sınıyor: "herhangi bir
hata" yeşil sayılsaydı, takıma katılmamış kullanıcı hatası da testi
geçirirdi (aynı sınıf yanlış-geçiş D30'da ölçülmüştü).

`province_community_audit` senaryo 3c önce kanaldaki **toplam** mesaj
sayısına bakıyordu ve `rls_isolation` suitinden kalan bir satır yüzünden
kırıldı; artık yalnız testin kendi ürettiği iki mesajı arıyor.

### Derleme

`pnpm check:all` → `tsc --noEmit` temiz, `eslint .` temiz, `next build`
başarılı.

### Canlı sayfa kontrolleri (dev sunucu)

Tümü HTTP 200: `/`, `/giris`, `/gorevler`, `/topluluk`, `/topluluk?il=34`,
`/topluluk?il=9999` (geçersiz il sessizce varsayılana düşüyor),
`/siralama`, `/siralama?donem=year`, `/profil`, `/oduller`, `/kesfet`,
`/panel`, `/task-art/art-01.svg`, `/task-art/manifest.json`.

### Görsel doğrulama

Görev kartı durumları, kimlik butonları, kimlik chip'leri ve alt gezinme
headless Chrome ile gerçek derlenmiş CSS üzerinde render edilip gözle
kontrol edildi. Mührün ödül haplarının üstüne taşması bu yolla bulundu ve
düzeltildi.

---

## 9. AÇIK İŞ — buluttaki veritabanı güncellenmedi

> **Sonradan eklendi (`0b04851`) — bu dilim üretimi kırdı.**
>
> Bu dilimde yazdığım kod, koşmamış migration'lara **sıkı bağımlıydı**.
> Beş kırılma ölçüldü:
>
> 1. `tasks.art_key` yok → `42703` → `listFeedTasks` throw ediyordu;
>    **ana sayfa ve `/gorevler` 500**.
> 2. `getTask` hatayı yutuyordu → her görev detayı sessizce 404.
> 3. `channel_info` yok → `PGRST202` → null → `/topluluk` kendine
>    redirect ediyordu: **sonsuz yönlendirme döngüsü**.
> 4. Panel görev kaydı `art_key` yazıyordu → hiçbir görev
>    kaydedilemiyordu.
> 5. `leaderboard_top`/`leaderboard_teams` `'year'` reddediyor ve hata
>    yutuluyordu → "Bu Yıl" hatasız ama bomboş.
>
> `src/lib/supabase/schema-guard.ts` eklendi: yeni şemayı önce dener,
> "yok" hatasında (`42703` / `PGRST202`) eski yola düşer ve hatırlar.
> İzin, kısıt ve ağ hataları gerçek hata sayılıp yutulmuyor.
> Uygulama artık şema geride kalsa da **ayakta** — ama aşağıdaki
> migration'lar uygulanmadan yeni özellikler **çalışmaz**.
>
> **Ders:** dağıtım sırası bir kuraldır, tercih değil. Yeni sütun ya da
> RPC kullanan kod, o nesne yokken de çalışabilmeli; yoksa migration
> ile deploy arasındaki her an bir kesinti penceresidir.

**İki migration yerelde uygulandı ve test edildi, buluta İTİLEMEDİ:**

- `20260927000000_year_period_and_task_art.sql` (M30)
- `20260928000000_task_day_window.sql` (M31)

Sebep: bu oturumda Supabase erişim anahtarı yok.

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

Bu iki migration uygulanmadan canlıda:

- Sıralamadaki **"Bu Yıl"** sekmesi hata veriyor (`period_start` 'year'
  tanımıyor)
- **İl kanal gezgini** çalışmıyor (`post_message_to`, `channel_info`,
  `list_channel_messages_of` yok)
- Panel görev formundaki **görsel seçici** kaydedemiyor (`tasks.art_key`
  sütunu yok)
- Sürekli görev **06:00 penceresi** yok; eski gece yarısı sınırı geçerli

---

## 10. Sabah turu — neye bakmalı

1. **Ana sayfa:** kısayol ızgarasındaki dört kutucuk artık farklı
   renklerde. Alt gezinmede orta düğme büyük ve kubbenin içinde; aktif
   sekmenin altında minik nokta var.
2. **Görevler:** tamamladığın bir görevin kartında büyük yeşil tik.
   Sürekli bir görevi dün yaptıysan kart bugün "Bugün tekrar yap" diyor
   ve ana sayfa önerilerine geri gelmiş olmalı.
3. **Topluluk:** üstteki il kutusuna bas, arama kutusuna "van" yaz, Van
   kanalına gir ve mesaj yaz. (**Bulut migration'ı uygulanmadan
   çalışmaz** — bkz. bölüm 9.)
4. **Sıralama:** dönem satırında "Tümü" yerine "Bu Yıl" var. (Aynı not.)
5. **Profil:** altı kutucuk artık altı farklı renkte; seviye yolu her
   zaman altı düğüm gösteriyor ve mevcut seviye ortada.
6. **Panel → Görevler → yeni görev:** ikon seçicinin altında kapak
   görseli ızgarası. (Aynı not.)

---

## 11. Devreden borçlar

- 52 ham `<button>` (yapısal/anahtar; bilinçli bırakıldı)
- Rozet kutlamasında rozet adı görünmüyor
- SQL kaynaklı yazımlarda push atılmıyor
- `redeem_reward` DB mesajı hâlâ "coin" diyor
- Panel arama kutusu devre dışı
- İstatistik taban değeri satır içinde yeniden hesaplanıyor
- `/gorevler`'de kategori filtresi yok
- Seviye yolu rozet kilometre taşları yalnız `xp_total` için
- Gerçek zamanlı topluluk sohbeti yok (30 sn yoklama)
- Supabase bölge taşıma (<400ms TTFB hedefi) yapılmadı
- Panel "Kullanıcı" yazıyor: personel `profiles` okuyamıyor
- `rls_isolation.sql` yerel veritabanına kalıcı satır bırakıyor
  (bu dilimde bir testi kırdı; suitin kendisi bu dilimin kapsamı dışıydı)
