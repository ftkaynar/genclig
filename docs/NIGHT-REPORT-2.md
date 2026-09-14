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
