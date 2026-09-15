-- M28a — Avatar yükleme düzeltmesi.
--
-- SEMPTOM: kullanıcı avatar seçiyor, sıkıştırma çalışıyor ("32 KB → 21 KB"),
-- sonra "öğe yüklenemedi" hatası alıyor.
--
-- KÖK SEBEP (ölçüldü): `avatars` bucket'ında SELECT politikası yoktu.
-- Aşağıdaki doğal deney kök sebebi kanıtladı — aynı oturumla, aynı 160
-- baytlık JPEG ile:
--
--   avatars,        upsert: true   -> new row violates row-level security policy
--   avatars,        upsert: false  -> BAŞARILI
--   task-proofs,    upsert: true   -> BAŞARILI   (select politikası var)
--   problem-photos, upsert: true   -> BAŞARILI   (select politikası var)
--
-- Aşağıdaki politika eklendikten sonra `upsert: true` de BAŞARILI oldu,
-- yanlış klasöre yükleme ise hâlâ reddedildi.
--
-- Neden: storage-api `upsert` isteğini `insert ... on conflict do update`
-- olarak çalıştırıyor. PostgreSQL bu ifadede çakışan satırı OKUMAK zorunda,
-- yani SELECT politikası arıyor. Bucket'ın `public = true` olması yalnızca
-- imzasız HTTP okumasını açıyor; SQL düzeyindeki RLS'i etkilemiyor. Önceki
-- migration'daki "okuma bucket public olduğu için politikaya bağlı değil"
-- yorumu bu yüzden eksikti.
--
-- Denenen ve elenen alternatif: istemcide `upsert: true` bayrağını kaldırıp
-- bırakmak. Yalnız başına yeterli değil — yol zaten zaman damgalı olduğu
-- için upsert gereksizdi, ama bucket SELECT politikası olmadan kullanıcı
-- kendi dosyasını listeleyemiyor ve ileride üzerine yazma yine kırılırdı.
-- İstemci tarafındaki bayrak da ayrıca kaldırıldı (iki taraflı düzeltme).

/*
  Okuma yalnızca kendi klasöründe. Başkasının avatarını görmek için SQL
  gerekmiyor: bucket public, görüntüler doğrudan public URL ile çekiliyor.
*/
drop policy if exists avatars_select_own on storage.objects;

create policy avatars_select_own on storage.objects
  for select to authenticated using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

/*
  UPDATE politikasına açık `with check` ekleniyor.

  `with check` yazılmadığında PostgreSQL `using` ifadesini kontrol olarak
  kullanıyor, yani davranış bugün doğru. Açıkça yazmanın sebebi: üzerine
  yazma yolunda yeni satırın hangi kurala tabi olduğu okunurken belli
  olsun; politikalar büyüdüğünde örtük davranışa yaslanmak sessiz hata
  kaynağı oluyor.
*/
drop policy if exists avatars_update_own on storage.objects;

create policy avatars_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
