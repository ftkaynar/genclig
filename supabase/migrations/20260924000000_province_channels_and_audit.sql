-- M28: İl bazlı topluluk + denetim izi + takım kapasitesi.
--
-- Üç iş bir migration'da çünkü üçü de aynı gece diliminde (D29) ve
-- ikisi (kanal taşıma, denetim izi) birbirine dokunuyor: kanal taşıma
-- sırasında yapılan değişiklikler de denetim izine düşmeli.

-- ===========================================================================
-- 1. TOPLULUK: ilçe -> il
-- ===========================================================================

/*
  NEDEN İL: ilçe kanalları çok ince bölündü. İstanbul'un 39 ilçesi 39 ayrı
  odaya bölününce her odada bir avuç kullanıcı kalıyor ve sohbet hiç
  başlamıyor. Topluluk hissi için eşik kalabalık; il ölçeği o eşiği
  geçiyor.

  Şema: district_id nullable oluyor, province_id ekleniyor. Eski sütun
  DÜŞÜRÜLMÜYOR — taşıma sırasında hangi mesajın hangi ilçeden geldiğini
  bilmek gerekiyor ve ileride mahalle/ilçe kanalı geri istenirse sütun
  yerinde duruyor.
*/

alter table public.channels
  add column if not exists province_id bigint references public.provinces (id) on delete cascade;

alter table public.channels alter column district_id drop not null;

alter table public.channels drop constraint if exists channels_scope_check;
alter table public.channels add constraint channels_scope_check
  check (scope in ('district', 'province'));

/*
  Kapsam başına tutarlılık: ilçe kanalında district_id, il kanalında
  province_id dolu olmak zorunda. Tek bir `unique (scope, district_id)`
  kısıtı il kanallarını hiç kapsamıyordu.
*/
alter table public.channels drop constraint if exists channels_scope_district_id_key;

alter table public.channels drop constraint if exists channels_scope_target_check;
alter table public.channels add constraint channels_scope_target_check check (
  (scope = 'district' and district_id is not null)
  or (scope = 'province' and province_id is not null)
);

create unique index if not exists channels_district_unique
  on public.channels (district_id) where scope = 'district';

create unique index if not exists channels_province_unique
  on public.channels (province_id) where scope = 'province';

-- 81 il için birer kanal.
insert into public.channels (scope, province_id, name)
select 'province', p.id, p.name || ' Topluluğu'
from public.provinces p
on conflict do nothing;

-- ===========================================================================
-- 2. DENETİM İZİ
-- ===========================================================================

/*
  Kim, neyi, ne zaman değiştirdi.

  actor_id null olabiliyor: sistem kaynaklı işlemler (otomatik gizleme,
  migration sırasında yapılan taşıma) gerçek bir kullanıcıya ait değil.
*/
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_idx
  on public.audit_logs (created_at desc);
create index if not exists audit_logs_action_idx
  on public.audit_logs (action, created_at desc);
create index if not exists audit_logs_actor_idx
  on public.audit_logs (actor_id, created_at desc);

alter table public.audit_logs enable row level security;

/*
  Okuma yalnızca süper admin. YAZMA POLİTİKASI YOK ve tabloya hiçbir
  role INSERT verilmiyor: kayıtlar yalnız security definer fonksiyondan
  ve tetikleyicilerden düşüyor. Client'a yazma açılsaydı denetim izi
  denetlenen tarafından yazılabilir olurdu — izin değeri sıfıra inerdi.
*/
revoke all on public.audit_logs from anon, authenticated;
grant select on public.audit_logs to authenticated;

drop policy if exists audit_logs_select_super on public.audit_logs;
create policy audit_logs_select_super on public.audit_logs
  for select to authenticated using (public.is_super_admin());

create or replace function public.log_audit(
  p_actor uuid,
  p_action text,
  p_target_type text,
  p_target_id text,
  p_meta jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs (actor_id, action, target_type, target_id, meta)
  values (p_actor, p_action, p_target_type, p_target_id, coalesce(p_meta, '{}'::jsonb));
end;
$$;

revoke all on function public.log_audit(uuid, text, text, text, jsonb)
  from public, anon, authenticated;

/*
  Kayıtlar TETİKLEYİCİLERLE düşüyor, RPC'lerin içine tek tek çağrı
  eklenerek değil.

  Denenen ve elenen alternatif: her kritik RPC'ye `perform log_audit(...)`
  satırı eklemek. İki sebeple elendi:
    1. On küsur fonksiyonun gövdesini yeniden yazmak gerekiyordu ve her
       biri ileride değiştiğinde denetim satırının korunacağının garantisi
       yoktu — sessizce düşen bir izleme, hiç olmamasından kötüdür.
    2. RPC dışı yazımlar (personelin doğrudan tablo güncellemesi, elle
       düzeltme) izlenmiyordu. Tetikleyici HER yazım yolunu kapsıyor.

  Aktör `auth.uid()`: security definer fonksiyon içinden çağrılsa bile
  JWT claim'i değişmiyor, yani gerçek kullanıcı kimliği okunuyor.
  auth.uid() null ise (migration, sistem) kayıt actor_id = null düşüyor.
*/

-- --------------------------------------------------------------- teslimler
create or replace function public.audit_submission() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status
     and new.status in ('approved', 'rejected') then
    perform public.log_audit(
      coalesce(new.reviewed_by, (select auth.uid())),
      'submission.' || new.status,
      'task_submission',
      new.id::text,
      jsonb_build_object(
        'task_id', new.task_id,
        'user_id', new.user_id,
        'reject_reason', new.reject_reason
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists audit_submission_trg on public.task_submissions;
create trigger audit_submission_trg after update on public.task_submissions
  for each row execute function public.audit_submission();

-- ----------------------------------------------------------------- sorunlar
create or replace function public.audit_problem() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    perform public.log_audit(
      (select auth.uid()), 'problem.status', 'problem_report', new.id::text,
      jsonb_build_object('from', old.status, 'to', new.status)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists audit_problem_trg on public.problem_reports;
create trigger audit_problem_trg after update on public.problem_reports
  for each row execute function public.audit_problem();

-- --------------------------------------------------------------- moderasyon
create or replace function public.audit_message() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.is_deleted is distinct from old.is_deleted then
    perform public.log_audit(
      coalesce(new.deleted_by, (select auth.uid())),
      case when new.is_deleted then 'message.delete' else 'message.restore' end,
      'channel_message', new.id::text,
      -- Gövde kaydediliyor: "kim ne sildi" sorusunun cevabı silinen
      -- metin olmadan eksik kalıyor.
      jsonb_build_object('channel_id', new.channel_id,
                         'author_id', new.user_id,
                         'body', new.body)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists audit_message_trg on public.channel_messages;
create trigger audit_message_trg after update on public.channel_messages
  for each row execute function public.audit_message();

create or replace function public.audit_mute() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.log_audit(
    coalesce(new.muted_by, (select auth.uid())),
    'user.mute', 'user', new.user_id::text,
    jsonb_build_object('channel_id', new.channel_id,
                       'until', new.until,
                       'reason', new.reason)
  );
  return new;
end;
$$;

drop trigger if exists audit_mute_trg on public.user_mutes;
create trigger audit_mute_trg after insert or update on public.user_mutes
  for each row execute function public.audit_mute();

create or replace function public.audit_report() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_audit(
      new.reporter_id, 'report.create', 'message_report', new.id::text,
      jsonb_build_object('message_id', new.message_id, 'reason', new.reason)
    );
  elsif new.status is distinct from old.status then
    perform public.log_audit(
      (select auth.uid()), 'report.' || new.status, 'message_report', new.id::text,
      jsonb_build_object('message_id', new.message_id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists audit_report_trg on public.message_reports;
create trigger audit_report_trg after insert or update on public.message_reports
  for each row execute function public.audit_report();

-- ----------------------------------------------------------------- duyurular
create or replace function public.audit_announcement() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.log_audit(
    coalesce(new.created_by, (select auth.uid())),
    'announcement.send', 'announcement', new.id::text,
    jsonb_build_object('audience', new.audience, 'title', new.title,
                       'sent_count', new.sent_count)
  );
  return new;
end;
$$;

drop trigger if exists audit_announcement_trg on public.announcements;
create trigger audit_announcement_trg after insert on public.announcements
  for each row execute function public.audit_announcement();

-- -------------------------------------------------------------------- roller
create or replace function public.audit_role() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_audit(
      (select auth.uid()), 'role.grant', 'user', new.user_id::text,
      jsonb_build_object('role', new.role, 'municipality_id', new.municipality_id)
    );
    return new;
  else
    perform public.log_audit(
      (select auth.uid()), 'role.revoke', 'user', old.user_id::text,
      jsonb_build_object('role', old.role, 'municipality_id', old.municipality_id)
    );
    return old;
  end if;
end;
$$;

drop trigger if exists audit_role_trg on public.user_roles;
create trigger audit_role_trg after insert or delete on public.user_roles
  for each row execute function public.audit_role();

-- ------------------------------------------------------------------ görevler
create or replace function public.audit_task() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_audit(
      coalesce(new.created_by, (select auth.uid())),
      'task.create', 'task', new.id::text,
      jsonb_build_object('title', new.title, 'municipality_id', new.municipality_id)
    );
  elsif new.status is distinct from old.status then
    perform public.log_audit(
      (select auth.uid()), 'task.status', 'task', new.id::text,
      jsonb_build_object('title', new.title, 'from', old.status, 'to', new.status)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists audit_task_trg on public.tasks;
create trigger audit_task_trg after insert or update on public.tasks
  for each row execute function public.audit_task();

-- -------------------------------------------------------------------- ödüller
create or replace function public.audit_redemption() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_audit(
      new.user_id, 'reward.redeem', 'reward_redemption', new.id::text,
      jsonb_build_object('reward_id', new.reward_id)
    );
  elsif new.status is distinct from old.status then
    perform public.log_audit(
      coalesce(new.used_by, (select auth.uid())),
      'reward.' || new.status, 'reward_redemption', new.id::text,
      jsonb_build_object('reward_id', new.reward_id, 'user_id', new.user_id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists audit_redemption_trg on public.reward_redemptions;
create trigger audit_redemption_trg after insert or update on public.reward_redemptions
  for each row execute function public.audit_redemption();

-- ------------------------------------------------------------------- destek
create or replace function public.audit_ticket() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    perform public.log_audit(
      (select auth.uid()), 'ticket.status', 'support_ticket', new.id::text,
      jsonb_build_object('from', old.status, 'to', new.status)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists audit_ticket_trg on public.support_tickets;
create trigger audit_ticket_trg after update on public.support_tickets
  for each row execute function public.audit_ticket();

-- ===========================================================================
-- 3. VERİ TAŞIMA: ilçe kanalları -> il kanalları
-- ===========================================================================

/*
  KAYIPSIZ taşıma sırası önemli:
    1. mesajları il kanalına taşı
    2. kanal bazlı susturmaları il kanalına taşı
    3. ancak ondan sonra ilçe kanallarını sil

  Ters sırada silmek, channel_messages ve user_mutes'taki
  `on delete cascade` yüzünden mesajları da susturmaları da SİLERDİ.

  İlçe kanallarını passive bırakmak yerine SİLMEK seçildi: pasif kanal
  hâlâ `channels_select_own` ve moderasyon sorgularında özel durum
  gerektiriyor, ve bayat bir my_channel_id ölü odaya düşebiliyordu. Boş
  ve erişilemez bir kayıt tutmanın hiçbir karşılığı yok — mesajlar zaten
  taşındı, kayıp yok.
*/
do $$
declare
  v_msgs integer := 0;
  v_mutes integer := 0;
  v_channels integer := 0;
begin
  -- 1) mesajlar
  with moved as (
    update public.channel_messages m
    set channel_id = pc.id
    from public.channels dc
    join public.districts d on d.id = dc.district_id
    join public.channels pc
      on pc.scope = 'province' and pc.province_id = d.province_id
    where dc.scope = 'district' and m.channel_id = dc.id
    returning m.id
  )
  select count(*) into v_msgs from moved;

  -- 2) kanal bazlı susturmalar
  with moved as (
    update public.user_mutes um
    set channel_id = pc.id
    from public.channels dc
    join public.districts d on d.id = dc.district_id
    join public.channels pc
      on pc.scope = 'province' and pc.province_id = d.province_id
    where dc.scope = 'district' and um.channel_id = dc.id
    returning um.user_id
  )
  select count(*) into v_mutes from moved;

  -- 3) ilçe kanalları
  with gone as (
    delete from public.channels where scope = 'district' returning id
  )
  select count(*) into v_channels from gone;

  perform public.log_audit(
    null, 'channel.migrate', 'channel', null,
    jsonb_build_object('moved_messages', v_msgs,
                       'moved_mutes', v_mutes,
                       'deleted_district_channels', v_channels)
  );

  raise notice 'TASIMA: % mesaj, % susturma, % ilce kanali silindi',
    v_msgs, v_mutes, v_channels;
end;
$$;

-- ===========================================================================
-- 4. Kanal fonksiyonları il bazına geçiyor
-- ===========================================================================

create or replace function public.my_channel_id()
returns uuid
language sql
security definer
stable
set search_path = ''
as $$
  select c.id
  from public.profiles p
  join public.channels c
    on c.scope = 'province' and c.province_id = p.province_id
  where p.id = (select auth.uid());
$$;

revoke all on function public.my_channel_id() from public, anon;
grant execute on function public.my_channel_id() to authenticated;

/*
  Moderatör = süper admin, ya da kanalın İLİNDEKİ bir belediyede yetkili
  personel. Belediye ilçeye bağlı, ilçe ile bağlı; zincir bir adım uzadı.
*/
create or replace function public.can_moderate_channel(p_channel uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select
    public.is_super_admin()
    or exists (
      select 1
      from public.channels c
      join public.districts d on d.province_id = c.province_id
      join public.municipalities m on m.district_id = d.id
      where c.id = p_channel
        and c.scope = 'province'
        and public.has_municipality_role(
          m.id, array['municipality_admin', 'municipality_operator', 'moderator']
        )
    );
$$;

revoke all on function public.can_moderate_channel(uuid) from public, anon;
grant execute on function public.can_moderate_channel(uuid) to authenticated;

/*
  Kanal başlığı. `district_name` OUT parametresi adı korunuyor ama artık
  İL adı dönüyor: adı değiştirmek fonksiyonun dönüş tipini değiştirir ve
  `create or replace` bunu yapamaz (M26'da ölçüldü). Arayüz bu alanı
  "il adı" olarak okuyor.
*/
create or replace function public.my_channel()
returns table (
  channel_id uuid,
  name text,
  district_name text,
  muted_until timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_channel uuid;
begin
  if v_uid is null then
    return;
  end if;

  v_channel := public.my_channel_id();
  if v_channel is null then
    return;
  end if;

  return query
  select
    c.id,
    c.name,
    pr.name,
    (select max(um.until) from public.user_mutes um
      where um.user_id = v_uid
        and um.until > now()
        and (um.channel_id is null or um.channel_id = c.id))
  from public.channels c
  join public.provinces pr on pr.id = c.province_id
  where c.id = v_channel;
end;
$$;

revoke all on function public.my_channel() from public, anon;
grant execute on function public.my_channel() to authenticated;

-- ===========================================================================
-- 5. Takım kapasitesi 5 -> 10
-- ===========================================================================

/*
  Varsayılan kapasite büyüdü: 5 kişilik takım, sınıf/okul grubu için çok
  küçüktü ve kullanıcılar ikinci takım kurmak zorunda kalıyordu.
  `check (max_members between 2 and 10)` zaten vardı, yalnız varsayılan
  değişiyor. MEVCUT takımlara dokunulmuyor — kurucunun seçtiği kapasiteyi
  geriye dönük değiştirmek, takımın kimliğine müdahale olurdu.
*/
alter table public.teams alter column max_members set default 10;
