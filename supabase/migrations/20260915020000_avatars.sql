-- Avatar depolama.
--
-- task-proofs'tan farklı olarak bu bucket herkese açık okunabilir: avatarlar
-- profil ve sıralama ekranlarında başkalarına da görünüyor, her görüntü için
-- imzalı URL üretmek gereksiz tur demek olurdu.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

/*
  Yol düzeni <user_id>/<dosya>. Yazma, silme ve güncelleme yalnızca kendi
  klasöründe; okuma bucket public olduğu için politikaya bağlı değil.
*/
create policy avatars_insert_own on storage.objects
  for insert to authenticated with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy avatars_update_own on storage.objects
  for update to authenticated using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy avatars_delete_own on storage.objects
  for delete to authenticated using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
