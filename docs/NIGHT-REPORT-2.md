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
