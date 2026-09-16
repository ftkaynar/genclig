-- M28 testi: il bazlı topluluk izolasyonu + denetim izi.
--
-- Senaryolar:
--   1. İstanbul'lu A kendi il kanalını görüyor
--   2. Ankara'lı B farklı bir kanal görüyor (A'nınkini GÖRMÜYOR)
--   3. A'nın mesajını B okuyamıyor (RLS)
--   4. Mesaj silme denetim izine düşüyor, DOĞRU AKTÖRLE
--   5. Duyuru denetim izine düşüyor
--   6. Rol verme denetim izine düşüyor
--   7. Normal kullanıcı audit_logs okuyamıyor, süper admin okuyabiliyor
--
-- Çalıştırma:
--   docker exec -i supabase_db_genclig psql -U postgres -d postgres \
--     < supabase/tests/province_community_audit.sql

\set ON_ERROR_STOP off
\timing off

begin;

create temporary table t_result (senaryo text, sonuc text, deger text)
  on commit drop;

create temporary table t_ids (k text primary key, v uuid) on commit drop;

-- ---------------------------------------------------------------------------
-- Hazırlık: iki ilden iki kullanıcı + bir süper admin
-- ---------------------------------------------------------------------------

do $$
declare
  v_a uuid := gen_random_uuid();
  v_b uuid := gen_random_uuid();
  v_s uuid := gen_random_uuid();
  v_ist bigint;
  v_ank bigint;
begin
  select id into v_ist from public.provinces where name = 'İstanbul';
  select id into v_ank from public.provinces where name = 'Ankara';

  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at)
  values
    (v_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'prov-a@example.com', '', now(), now(), now()),
    (v_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'prov-b@example.com', '', now(), now(), now()),
    (v_s, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'prov-s@example.com', '', now(), now(), now());

  insert into public.profiles (id, username, province_id)
  values (v_a, 'prova', v_ist), (v_b, 'provb', v_ank), (v_s, 'provs', v_ist)
  on conflict (id) do update set province_id = excluded.province_id;

  insert into public.user_roles (user_id, role) values (v_s, 'super_admin');

  insert into t_ids values ('a', v_a), ('b', v_b), ('s', v_s);
end;
$$;

-- ---------------------------------------------------------------------------
-- SENARYO 1-2 — kanal çözümü il bazlı
-- ---------------------------------------------------------------------------

do $$
declare
  v_a uuid := (select v from t_ids where k = 'a');
  v_b uuid := (select v from t_ids where k = 'b');
  v_ca uuid;
  v_cb uuid;
  v_na text;
  v_nb text;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_a::text, 'role', 'authenticated')::text, true);
  v_ca := public.my_channel_id();

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_b::text, 'role', 'authenticated')::text, true);
  v_cb := public.my_channel_id();

  select name into v_na from public.channels where id = v_ca;
  select name into v_nb from public.channels where id = v_cb;

  insert into t_result values ('1-kanal', 'A kanali', coalesce(v_na, 'YOK'));
  insert into t_result values ('2-kanal', 'B kanali', coalesce(v_nb, 'YOK'));
  insert into t_result values (
    '2-kanal',
    case when v_ca is not null and v_cb is not null and v_ca <> v_cb
         then 'GECTI: iki il iki ayri kanal'
         else 'HATA: kanallar ayrilmadi' end,
    ''
  );
  insert into t_result values (
    '1-kanal',
    case when v_na = 'İstanbul Topluluğu' then 'GECTI: il adi dogru'
         else 'HATA: ' || coalesce(v_na, 'null') end,
    ''
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- SENARYO 3 — A'nın mesajını B göremiyor
-- ---------------------------------------------------------------------------

do $$
declare
  v_a uuid := (select v from t_ids where k = 'a');
  v_b uuid := (select v from t_ids where k = 'b');
  v_msg uuid;
  v_seen_by_a integer;
  v_seen_by_b integer;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_a::text, 'role', 'authenticated')::text, true);

  insert into public.channel_messages (channel_id, user_id, body)
  values (public.my_channel_id(), v_a, 'Merhaba Istanbul')
  returning id into v_msg;

  insert into t_ids values ('msg', v_msg);

  perform set_config('role', 'authenticated', true);

  select count(*) into v_seen_by_a
  from public.channel_messages where id = v_msg;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_b::text, 'role', 'authenticated')::text, true);

  select count(*) into v_seen_by_b
  from public.channel_messages where id = v_msg;

  perform set_config('role', 'postgres', true);

  insert into t_result values ('3-izolasyon', 'A goruyor / B goruyor',
    v_seen_by_a || ' / ' || v_seen_by_b);
  insert into t_result values ('3-izolasyon',
    case when v_seen_by_a = 1 and v_seen_by_b = 0
         then 'GECTI: baska ilin mesaji gorunmuyor'
         else 'HATA: izolasyon kirik' end, '');
end;
$$;

-- ---------------------------------------------------------------------------
-- SENARYO 4 — mesaj silme denetim izine düşüyor, doğru aktörle
-- ---------------------------------------------------------------------------

do $$
declare
  v_s uuid := (select v from t_ids where k = 's');
  v_msg uuid := (select v from t_ids where k = 'msg');
  v_actor uuid;
  v_body text;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_s::text, 'role', 'authenticated')::text, true);

  update public.channel_messages
  set is_deleted = true, deleted_by = v_s
  where id = v_msg;

  perform set_config('role', 'postgres', true);

  select actor_id, meta->>'body' into v_actor, v_body
  from public.audit_logs
  where action = 'message.delete' and target_id = v_msg::text;

  insert into t_result values ('4-denetim', 'silme aktoru dogru mu',
    case when v_actor = v_s then 'GECTI' else 'HATA: ' || coalesce(v_actor::text, 'null') end);
  insert into t_result values ('4-denetim', 'silinen govde kayitli mi',
    case when v_body = 'Merhaba Istanbul' then 'GECTI' else 'HATA: ' || coalesce(v_body, 'null') end);
end;
$$;

-- ---------------------------------------------------------------------------
-- SENARYO 5 — duyuru denetim izine düşüyor
-- ---------------------------------------------------------------------------

do $$
declare
  v_s uuid := (select v from t_ids where k = 's');
  v_ann uuid;
  v_n integer;
begin
  insert into public.announcements (title, body, audience, created_by)
  values ('Test duyurusu', 'gövde', 'all', v_s)
  returning id into v_ann;

  select count(*) into v_n from public.audit_logs
  where action = 'announcement.send' and target_id = v_ann::text and actor_id = v_s;

  insert into t_result values ('5-denetim', 'duyuru kaydi',
    case when v_n = 1 then 'GECTI' else 'HATA: ' || v_n end);
end;
$$;

-- ---------------------------------------------------------------------------
-- SENARYO 6 — rol verme denetim izine düşüyor
-- ---------------------------------------------------------------------------

do $$
declare
  v_a uuid := (select v from t_ids where k = 'a');
  v_s uuid := (select v from t_ids where k = 's');
  v_n integer;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_s::text, 'role', 'authenticated')::text, true);

  insert into public.user_roles (user_id, role) values (v_a, 'moderator');

  perform set_config('role', 'postgres', true);

  select count(*) into v_n from public.audit_logs
  where action = 'role.grant' and target_id = v_a::text and actor_id = v_s;

  insert into t_result values ('6-denetim', 'rol verme kaydi',
    case when v_n = 1 then 'GECTI' else 'HATA: ' || v_n end);
end;
$$;

-- ---------------------------------------------------------------------------
-- SENARYO 7 — audit erişimi yalnız süper admin
-- ---------------------------------------------------------------------------

do $$
declare
  v_a uuid := (select v from t_ids where k = 'a');
  v_s uuid := (select v from t_ids where k = 's');
  v_normal integer;
  v_super integer;
begin
  perform set_config('role', 'authenticated', true);

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_a::text, 'role', 'authenticated')::text, true);
  select count(*) into v_normal from public.audit_logs;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_s::text, 'role', 'authenticated')::text, true);
  select count(*) into v_super from public.audit_logs;

  perform set_config('role', 'postgres', true);

  insert into t_result values ('7-erisim', 'normal / super gorunen kayit',
    v_normal || ' / ' || v_super);
  insert into t_result values ('7-erisim',
    case when v_normal = 0 and v_super > 0
         then 'GECTI: audit yalniz super admine acik'
         else 'HATA: erisim sinir kirik' end, '');
end;
$$;

-- ---------------------------------------------------------------------------
-- Sonuç
-- ---------------------------------------------------------------------------

select senaryo, sonuc, deger from t_result order by senaryo, sonuc;

select
  count(*) filter (where sonuc like 'HATA%' or deger like 'HATA%') as hata,
  count(*) filter (where sonuc like 'GECTI%' or deger like 'GECTI%') as gecti
from t_result;

rollback;
