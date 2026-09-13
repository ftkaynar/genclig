-- Rozet motoru.
--
-- Rozetler data-driven: kriter jsonb olarak tabloda duruyor, kod yalnızca
-- kriter tiplerini biliyor. Süper admin yeni rozet ekleyip kriterini
-- ayarlayabiliyor, dağıtım gerekmiyor.

create table public.badges (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null,
  icon text,
  /*
    Desteklenen kriter biçimleri:
      {"type":"total_tasks","count":25}
      {"type":"category_tasks","category":"environment","count":10}
      {"type":"problem_reports","count":5}
      {"type":"xp_total","amount":1000}
    Tanınmayan tip sessizce atlanır: yeni bir tip eklendiğinde eski sürüm
    çalışan sunucular rozeti dağıtmaz ama hata da vermez.
  */
  criteria jsonb not null,
  xp_bonus integer not null default 0 check (xp_bonus >= 0),
  coin_bonus integer not null default 0 check (coin_bonus >= 0),
  sort smallint not null default 0,
  status text not null default 'active' check (status in ('active', 'passive')),
  created_at timestamptz not null default now()
);

create table public.user_badges (
  user_id uuid not null references auth.users (id) on delete cascade,
  badge_id uuid not null references public.badges (id) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

-- Rozet bonusunun tek sefer yazılması için işlem tablolarına bağ.
alter table public.xp_transactions
  add column badge_id uuid references public.badges (id) on delete set null;
alter table public.coin_transactions
  add column badge_id uuid references public.badges (id) on delete set null;

create unique index xp_transactions_badge_unique
  on public.xp_transactions (user_id, badge_id)
  where reason = 'badge' and badge_id is not null;

create unique index coin_transactions_badge_unique
  on public.coin_transactions (user_id, badge_id)
  where reason = 'badge' and badge_id is not null;

-- ---------------------------------------------------------------------------
-- Seed
-- ---------------------------------------------------------------------------

insert into public.badges (slug, name, description, icon, criteria, xp_bonus, coin_bonus, sort)
values
  ('first-step', 'İlk Adım', 'İlk görevini tamamladın.', 'sparkles',
   '{"type":"total_tasks","count":1}'::jsonb, 20, 10, 10),
  ('green-hero', 'Çevre Kahramanı', 'Çevre kategorisinde 10 görev tamamladın.', 'leaf',
   '{"type":"category_tasks","category":"environment","count":10}'::jsonb, 100, 50, 20),
  ('culture-explorer', 'Kültür Kaşifi', 'Kültür kategorisinde 5 görev tamamladın.', 'landmark',
   '{"type":"category_tasks","category":"culture","count":5}'::jsonb, 60, 30, 30),
  ('social-starter', 'Sosyal Lider', 'Sosyal kategoride 10 görev tamamladın.', 'users',
   '{"type":"category_tasks","category":"social","count":10}'::jsonb, 100, 50, 40),
  ('knowledge-seeker', 'Bilgi Avcısı', 'Eğitim kategorisinde 5 görev tamamladın.', 'book-open',
   '{"type":"category_tasks","category":"education","count":5}'::jsonb, 60, 30, 50),
  ('city-voice', 'Şehrin Sesi', 'Şehrin için 5 bildirim gönderdin.', 'megaphone',
   '{"type":"problem_reports","count":5}'::jsonb, 80, 40, 60),
  ('city-maker', 'Şehir Yapıcı', '25 görev tamamladın.', 'award',
   '{"type":"total_tasks","count":25}'::jsonb, 250, 120, 70)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Rozet değerlendirme
-- ---------------------------------------------------------------------------

/*
  Kullanıcının hak ettiği ama henüz almadığı rozetleri verir.

  Her çağrıda tüm aktif rozetler yeniden değerlendiriliyor. Denenen ve elenen
  alternatif: yalnızca tetikleyen olaya bağlı rozetlere bakmak. Elendi, çünkü
  kriter tipleri tabloda değişebiliyor; hangi olayın hangi rozeti etkilediğini
  kodda tutmak, kriter düzenlendiğinde sessizce yanlış olurdu. Rozet sayısı
  küçük, tam tarama ucuz.

  Bonus işlemleri kısmi tekil indekse yaslanıyor, bu yüzden ikinci çağrı
  bonusu katlamıyor.

  problem_reports kriteri FAZ 4 öncesinde tablo yokken de çalışsın diye
  to_regclass ile kontrol ediliyor; tablo yoksa sayı sıfır kabul ediliyor.
*/
create or replace function public.check_and_award_badges(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_badge public.badges;
  v_type text;
  v_count integer;
  v_needed integer;
  v_earned boolean;
begin
  if p_user is null then
    return;
  end if;

  for v_badge in
    select * from public.badges where status = 'active' order by sort
  loop
    -- Zaten kazanılmışsa atla.
    if exists (
      select 1 from public.user_badges
      where user_id = p_user and badge_id = v_badge.id
    ) then
      continue;
    end if;

    v_type := v_badge.criteria ->> 'type';
    v_earned := false;

    if v_type = 'total_tasks' then
      v_needed := coalesce((v_badge.criteria ->> 'count')::integer, 0);
      select count(*) into v_count
      from public.task_submissions
      where user_id = p_user and status = 'approved';
      v_earned := v_count >= v_needed;

    elsif v_type = 'category_tasks' then
      v_needed := coalesce((v_badge.criteria ->> 'count')::integer, 0);
      select count(*) into v_count
      from public.task_submissions s
      join public.tasks t on t.id = s.task_id
      join public.task_categories c on c.id = t.category_id
      where s.user_id = p_user
        and s.status = 'approved'
        and c.slug = (v_badge.criteria ->> 'category');
      v_earned := v_count >= v_needed;

    elsif v_type = 'xp_total' then
      v_needed := coalesce((v_badge.criteria ->> 'amount')::integer, 0);
      select coalesce(sum(amount), 0) into v_count
      from public.xp_transactions
      where user_id = p_user;
      v_earned := v_count >= v_needed;

    elsif v_type = 'problem_reports' then
      v_needed := coalesce((v_badge.criteria ->> 'count')::integer, 0);
      if to_regclass('public.problem_reports') is null then
        v_count := 0;
      else
        execute 'select count(*) from public.problem_reports where user_id = $1'
          into v_count using p_user;
      end if;
      v_earned := v_count >= v_needed;

    else
      -- Tanınmayan kriter tipi: rozet dağıtılmıyor, hata da verilmiyor.
      continue;
    end if;

    if not v_earned then
      continue;
    end if;

    insert into public.user_badges (user_id, badge_id)
    values (p_user, v_badge.id)
    on conflict do nothing;

    if v_badge.xp_bonus > 0 then
      insert into public.xp_transactions (user_id, amount, reason, badge_id)
      values (p_user, v_badge.xp_bonus, 'badge', v_badge.id)
      on conflict do nothing;
    end if;

    if v_badge.coin_bonus > 0 then
      insert into public.coin_transactions (user_id, amount, reason, badge_id)
      values (p_user, v_badge.coin_bonus, 'badge', v_badge.id)
      on conflict do nothing;
    end if;

    perform public.notify(
      p_user,
      'badge_earned',
      v_badge.name || ' rozetini kazandın',
      v_badge.description,
      v_badge.id
    );
  end loop;
end;
$$;

revoke all on function public.check_and_award_badges(uuid) from public;
revoke all on function public.check_and_award_badges(uuid) from anon;
revoke all on function public.check_and_award_badges(uuid) from authenticated;

-- ---------------------------------------------------------------------------
-- award_task_points: ödül yazdıktan sonra rozetleri değerlendir
-- ---------------------------------------------------------------------------

create or replace function public.award_task_points(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_submission public.task_submissions;
  v_task public.tasks;
begin
  select * into v_submission
  from public.task_submissions
  where id = p_submission_id;

  if v_submission.id is null or v_submission.status <> 'approved' then
    return;
  end if;

  select * into v_task from public.tasks where id = v_submission.task_id;

  if v_task.id is null then
    return;
  end if;

  if v_task.xp > 0 then
    insert into public.xp_transactions (user_id, amount, reason, submission_id)
    values (v_submission.user_id, v_task.xp, 'task', v_submission.id)
    on conflict do nothing;
  end if;

  if v_task.coin > 0 then
    insert into public.coin_transactions (user_id, amount, reason, submission_id)
    values (v_submission.user_id, v_task.coin, 'task', v_submission.id)
    on conflict do nothing;
  end if;

  -- Rozet değerlendirmesi ödülden sonra: xp_total kriteri bu görevin XP'sini
  -- de saymalı.
  perform public.check_and_award_badges(v_submission.user_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.badges enable row level security;
alter table public.user_badges enable row level security;

-- Rozet tanımları gizli değil: kullanıcı neyi hedefleyeceğini görmeli.
create policy badges_select_public on public.badges
  for select to anon, authenticated using (true);
create policy badges_insert_super on public.badges
  for insert to authenticated with check (public.is_super_admin());
create policy badges_update_super on public.badges
  for update to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy badges_delete_super on public.badges
  for delete to authenticated using (public.is_super_admin());

create policy user_badges_select_own on public.user_badges
  for select to authenticated using (user_id = (select auth.uid()));
create policy user_badges_select_super on public.user_badges
  for select to authenticated using (public.is_super_admin());

-- Kazanım yazımı yalnızca check_and_award_badges içinden; politika yok.

revoke all on public.badges from anon, authenticated;
grant select on public.badges to anon, authenticated;
grant insert, update, delete on public.badges to authenticated;

revoke all on public.user_badges from anon, authenticated;
grant select on public.user_badges to authenticated;
