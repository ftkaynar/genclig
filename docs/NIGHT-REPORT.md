# Gece Vardiyası Raporu

Başlangıç: 2026-09-14 · Dönüş noktası: `git tag gece-basi` (commit 4be8b4e)

Bu rapor gece boyunca faz faz güncellenir. Her fazın durumu, kanıt özeti,
spec'ten sapmalar ve blokajlar burada toplanır.

---

## FAZ 0 — Hazırlık

**Durum: TAMAM**

- Repo temiz (`git status` boş), HEAD `4be8b4e`
- `git tag gece-basi` oluşturuldu — geri dönüş noktası
- `pnpm db:reset` M1–M8 sıfırdan temiz uyguladı (exit 0)
- `pnpm check:all` yeşil (exit 0)
- Yerel Supabase yığını ayakta (11 container; `supabase_vector` restart döngüsünde — D01'den beri bilinen, yalnızca log toplayıcı, işlevi etkilemiyor)

---

## FAZ 1 — Bildirim altyapısı + teslim inceleme motoru (M9)

**Durum: TAMAM**

Migration `20260915000000_notifications_review.sql`:
- `notifications` tablosu (6 tür), RLS: kullanıcı yalnızca kendi satırlarını okur
- `notify()` — client'a execute yetkisi VERİLMEDİ (sahte bildirim üretilemesin)
- `mark_notification_read(id)` / `mark_all_notifications_read()` — rpc, yalnızca kendi satırı
- `review_submission(id, action, reason)` — yetki kontrolü fonksiyon içinde

**Tasarım kararı:** Okundu işaretleme UPDATE politikası yerine rpc ile. Politika
hangi sütunun değiştiğini göremiyor; kullanıcı kendi bildiriminin başlığını da
düzenleyebilirdi.

**Kanıtlar:**
- Foto teslimi `pending` açıldı, ödül yazılmadı (0 satır) — doğru
- Rolsüz kullanıcı inceleme denemesi → "Bu teslimi inceleme yetkin yok."
- Başka belediyenin personeli → aynı hata
- Belediye personeli onayladı → `approved`, 120 XP + 60 Coin, bildirim:
  "Kadıköy sahilini temizle onaylandı / +120 XP • +60 Coin kazandın."
- İkinci onay → "Bu teslim zaten sonuçlanmış.", XP satırı hâlâ 1 (katlanmadı)
- Red akışı → `rejected` + sebep + bildirim
- Başkasının bildirimi görünmüyor (0), `mark_all` sonrası okunmamış 0
- `notify` doğrudan çağrısı → `permission denied for function notify`

**UI:** Header'a çan + okunmamış sayacı (`UserHeader` ortak bileşeni),
`/bildirimler` sayfası (liste, tümünü okundu işaretle, boş durum).

**SAPMA:** Yetkisiz kullanıcı testinde ilk denemede "Teslim bulunamadı." geldi —
teslim id'si RLS yüzünden subquery'de görünmediği için. Yetki kontrolü id açıkça
verilerek ayrıca doğrulandı. Fonksiyonun bu davranışı aslında doğru: yetkisiz
kişiye teslimin varlığını bile sızdırmıyor.
