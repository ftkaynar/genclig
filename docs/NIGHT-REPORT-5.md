# Gece Vardiyası 5 — DİLİM 24

## FAZ T — Teşhis: süper admin inceleme görünürlüğü

### Ölçüm (düzeltmeden önce)

`/admin/incelemeler` → `listPendingReviews(null)`
`/panel/incelemeler` → `listPendingReviews(context.municipalityId)`

`listPendingReviews` içinde:

```ts
query = municipalityId === null
  ? query.is("tasks.municipality_id", null)   // ← yalnızca GLOBAL görevler
  : query.eq("tasks.municipality_id", municipalityId);
```

**Hata bu satırdaydı.** Süper admin ekranı `null` geçiyordu, yani
`municipality_id is null` olan global görevlerin teslimlerini listeliyordu.
Bir belediye görevine gönderilen fotoğraf süper adminin kuyruğunda **hiç
görünmüyordu**.

### Yetki katmanları zaten doğruymuş

Ölçüldü, ikisi de yerindeydi:

- `review_submission` → `if not (public.is_super_admin() or (...belediye
  rolü...))` — süper admin **tüm** görevler için yetkili.
- `task_submissions_select_super` politikası →
  `using (public.is_super_admin())` — satırlar zaten görünüyor.

Yani eksik olan tek şey listeleme filtresiydi; ne RPC ne RLS
değiştirilmesi gerekti.

### Düzeltme

`listPendingReviews` parametresi üç değerli oldu:
belediye kimliği (panel), `"all"` (süper admin — filtre yok, kararı RLS
veriyor), `null` (yalnızca global). `/admin/incelemeler` artık `"all"`
çağırıyor.

Kuyruk kartına **belediye adı rozeti** eklendi (global görevde "Genel") —
süper admin hangi belediyeye ait olduğunu görmeden karar veremezdi.

### Kanıtlar (yerel psql)

Bir belediye görevine pending fotoğraf teslimi açıldı:

- Belediye personeli görüyor: **1**
- Süper admin RLS altında görüyor: **2** (belediye + global)
- **Eski filtre** (`municipality_id is null`) kaç satır verirdi: **1**
- **Yeni filtre** (filtre yok): **2**
- Süper admin belediye görevini onayladı → teslim `approved`,
  XP 40 + rozet 20, kullanıcıya bildirim gitti
- Yetkisiz kullanıcı inceleme denemesi → "Bu teslimi inceleme yetkin yok."
