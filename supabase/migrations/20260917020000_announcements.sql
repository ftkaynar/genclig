-- Duyurular (M20).
--
-- Duyuru kullanıcıya bildirim olarak ulaşıyor; announcements tablosu
-- gönderim kaydı tutuyor (kim, kime, kaç kişiye). Kullanıcının bu tabloya
-- select yetkisi yok: duyuruyu çanından okuyor, gönderim kayıtlarını değil.

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  audience text not null check (audience in ('all', 'municipality', 'user')),
  municipality_id uuid references public.municipalities (id) on delete cascade,
  target_user_id uuid references auth.users (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  sent_count integer not null default 0,
  created_at timestamptz not null default now(),

  /*
    Hedef tutarlılığı kısıtı: audience ne diyorsa o alan dolu, diğerleri
    boş olmalı. Uygulama katmanında kontrol etmek yetmezdi — tek doğruluk
    kaynağı veritabanı.
  */
  constraint announcements_target_matches_audience check (
    (audience = 'all' and municipality_id is null and target_user_id is null)
    or (audience = 'municipality' and municipality_id is not null and target_user_id is null)
    or (audience = 'user' and target_user_id is not null and municipality_id is null)
  )
);

create index announcements_created_idx on public.announcements (created_at desc);
create index announcements_municipality_idx on public.announcements (municipality_id);

-- Bildirim tipine 'announcement' ekleniyor.
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'submission_approved', 'submission_rejected', 'badge_earned',
    'problem_status', 'reward_redeemed', 'system',
    'friend_request', 'friend_accepted', 'team_invite', 'support_reply',
    'announcement'
  ));

/*
  Duyuru gönderimi.

  Yetki kuralı:
  - super_admin: all / municipality / user, hepsi serbest.
  - belediye personeli: yalnızca kendi belediyesi. audience='municipality'
    zorunlu ve hedef kendi municipality_id'si olmak zorunda. Personelin
    'all' göndermesi, tek bir belediyenin tüm ülkeye duyuru atması demekti.

  security definer: hedef kullanıcıları bulmak için profiles'ın tamamını
  okumak gerekiyor, oysa RLS kullanıcıya yalnızca kendi satırını gösteriyor.
  Fonksiyon dışarıya yalnızca gönderilen sayıyı veriyor, kullanıcı listesi
  sızmıyor.
*/
create or replace function public.send_announcement(
  p_title text,
  p_body text,
  p_audience text,
  p_municipality uuid default null,
  p_username text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_super boolean := public.is_super_admin();
  v_target uuid;
  v_municipality uuid := p_municipality;
  v_row public.announcements;
  v_count integer := 0;
begin
  if v_uid is null then
    raise exception 'Bu işlem için giriş yapmalısın.';
  end if;

  if p_title is null or length(trim(p_title)) < 3 then
    raise exception 'Başlık en az 3 karakter olmalı.';
  end if;

  if p_body is null or length(trim(p_body)) < 10 then
    raise exception 'Duyuru metni en az 10 karakter olmalı.';
  end if;

  if p_audience not in ('all', 'municipality', 'user') then
    raise exception 'Geçersiz hedef kitle.';
  end if;

  if not v_super then
    if p_audience <> 'municipality' then
      raise exception 'Yalnızca kendi belediyenin kullanıcılarına duyuru gönderebilirsin.';
    end if;

    if v_municipality is null
       or not public.has_municipality_role(
            v_municipality, array['municipality_admin', 'municipality_operator']
          ) then
      raise exception 'Bu belediye için duyuru gönderme yetkin yok.';
    end if;
  end if;

  if p_audience = 'municipality' and v_municipality is null then
    raise exception 'Belediye seçilmedi.';
  end if;

  if p_audience = 'user' then
    select id into v_target from public.profiles
     where username = p_username::extensions.citext;

    if v_target is null then
      raise exception 'Kullanıcı bulunamadı.';
    end if;
  end if;

  insert into public.announcements (
    title, body, audience, municipality_id, target_user_id, created_by
  )
  values (
    trim(p_title), trim(p_body), p_audience,
    case when p_audience = 'municipality' then v_municipality else null end,
    v_target,
    v_uid
  )
  returning * into v_row;

  -- Hedef kullanıcılara bildirim.
  if p_audience = 'user' then
    perform public.notify(v_target, 'announcement', v_row.title, v_row.body, v_row.id);
    v_count := 1;
  else
    insert into public.notifications (user_id, type, title, body, ref_id)
    select p.id, 'announcement', v_row.title, v_row.body, v_row.id
    from public.profiles p
    where p.username is not null
      and (
        p_audience = 'all'
        or (p_audience = 'municipality' and p.municipality_id = v_municipality)
      );

    get diagnostics v_count = row_count;
  end if;

  update public.announcements set sent_count = v_count where id = v_row.id;

  return v_count;
end;
$$;

revoke all on function public.send_announcement(text, text, text, uuid, text) from public;
revoke all on function public.send_announcement(text, text, text, uuid, text) from anon;
grant execute on function public.send_announcement(text, text, text, uuid, text) to authenticated;

/*
  Gönderim geçmişi.

  security definer: gönderenin kullanıcı adını ve belediye adını da
  gösteriyor; ikisi de RLS altında okunamıyor. Süper admin hepsini,
  personel yalnızca kendi belediyesininkileri görüyor.
*/
create or replace function public.list_announcements(p_municipality uuid default null)
returns table (
  id uuid,
  title text,
  body text,
  audience text,
  municipality_name text,
  sent_count integer,
  created_by_username text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_super boolean := public.is_super_admin();
begin
  if (select auth.uid()) is null then
    return;
  end if;

  if not v_super then
    if p_municipality is null
       or not public.has_municipality_role(
            p_municipality, array['municipality_admin', 'municipality_operator']
          ) then
      return;
    end if;
  end if;

  return query
  select
    a.id, a.title, a.body, a.audience,
    m.name,
    a.sent_count,
    p.username::text,
    a.created_at
  from public.announcements a
  left join public.municipalities m on m.id = a.municipality_id
  left join public.profiles p on p.id = a.created_by
  where p_municipality is null or a.municipality_id = p_municipality
  order by a.created_at desc
  limit 100;
end;
$$;

revoke all on function public.list_announcements(uuid) from public;
revoke all on function public.list_announcements(uuid) from anon;
grant execute on function public.list_announcements(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.announcements enable row level security;

create policy announcements_select_super on public.announcements
  for select to authenticated using (public.is_super_admin());

-- Personel yalnızca kendi belediyesinin duyurularını görüyor.
create policy announcements_select_staff on public.announcements
  for select to authenticated using (
    municipality_id is not null
    and public.has_municipality_role(
      municipality_id, array['municipality_admin', 'municipality_operator']
    )
  );

/*
  Kullanıcı için select politikası bilerek YOK: duyuruyu bildirim olarak
  alıyor, gönderim kaydını görmesine gerek yok. Yazma politikası da yok —
  tek yol send_announcement; yetki kuralı orada.
*/
revoke all on public.announcements from anon, authenticated;
grant select on public.announcements to authenticated;
