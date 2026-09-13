-- Ödül havuzu: coin harcama tarafı.

create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  -- null ise platform geneli ödül, doluysa o belediyenin.
  municipality_id uuid references public.municipalities (id) on delete cascade,
  title text not null,
  description text not null,
  image_url text,
  coin_cost integer not null check (coin_cost > 0),
  min_level integer not null default 1 check (min_level >= 1),
  required_badge_id uuid references public.badges (id) on delete set null,
  -- null = sınırsız.
  stock integer check (stock is null or stock >= 0),
  status text not null default 'active' check (status in ('active', 'passive', 'archived')),
  created_at timestamptz not null default now()
);

create index rewards_status_idx on public.rewards (status);
create index rewards_municipality_idx on public.rewards (municipality_id);

create table public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  reward_id uuid not null references public.rewards (id) on delete restrict,
  user_id uuid not null references auth.users (id) on delete cascade,
  code text not null unique,
  status text not null default 'active' check (status in ('active', 'used', 'cancelled')),
  created_at timestamptz not null default now(),
  used_at timestamptz,
  used_by uuid references auth.users (id) on delete set null
);

create index reward_redemptions_user_idx on public.reward_redemptions (user_id, created_at desc);
create index reward_redemptions_reward_idx on public.reward_redemptions (reward_id, status);

alter table public.coin_transactions
  add column redemption_id uuid references public.reward_redemptions (id) on delete set null;

create unique index coin_transactions_redemption_unique
  on public.coin_transactions (redemption_id)
  where reason = 'reward_spend' and redemption_id is not null;

-- ---------------------------------------------------------------------------
-- Kod üretimi
-- ---------------------------------------------------------------------------

/*
  8 haneli kupon kodu.

  Alfabeden karışan karakterler çıkarıldı (0/O, 1/I/L). Kod telefonda okunup
  kasada elle giriliyor; okunma hatası kullanıcıyı ödülünden ediyordu.
*/
create or replace function public.generate_redemption_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
  v_i integer;
begin
  loop
    v_code := '';
    for v_i in 1..8 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::integer, 1);
    end loop;

    exit when not exists (
      select 1 from public.reward_redemptions where code = v_code
    );
  end loop;

  return v_code;
end;
$$;

revoke all on function public.generate_redemption_code() from public;
revoke all on function public.generate_redemption_code() from anon;
revoke all on function public.generate_redemption_code() from authenticated;

-- ---------------------------------------------------------------------------
-- Ödül alma
-- ---------------------------------------------------------------------------

/*
  Ödülü coin karşılığı alır.

  Bakiye kontrolü burada yapılıyor, tabloda check kısıtıyla değil: korunması
  gereken şey satırların toplamı, tek satır değil. Harcama her zaman negatif
  amount ile yazılıyor.

  Stok ve bakiye kontrolü ile insert arasında kilit yok: iki eşzamanlı istek
  son stoğu alabilir ya da bakiyeyi bir kez fazla harcayabilir. MVP kabulü;
  kesin çözüm ödül satırını FOR UPDATE ile kilitlemek, bu ölçekte karşılığı yok.
*/
create or replace function public.redeem_reward(p_reward_id uuid)
returns public.reward_redemptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_reward public.rewards;
  v_balance integer;
  v_level integer;
  v_taken integer;
  v_code text;
  v_row public.reward_redemptions;
begin
  if v_uid is null then
    raise exception 'Bu işlem için giriş yapmalısın.';
  end if;

  select * into v_reward from public.rewards where id = p_reward_id;

  if v_reward.id is null or v_reward.status <> 'active' then
    raise exception 'Bu ödül şu an alınamıyor.';
  end if;

  if v_reward.stock is not null then
    select count(*) into v_taken
    from public.reward_redemptions
    where reward_id = p_reward_id and status in ('active', 'used');

    if v_taken >= v_reward.stock then
      raise exception 'Bu ödül tükendi.';
    end if;
  end if;

  select coalesce(sum(amount), 0) into v_balance
  from public.coin_transactions where user_id = v_uid;

  select coalesce(sum(amount), 0) into v_level
  from public.xp_transactions where user_id = v_uid;

  select l.level into v_level from public.level_from_xp(v_level) l;

  if v_level < v_reward.min_level then
    raise exception 'Bu ödül için en az %. seviyeye ulaşmalısın.', v_reward.min_level;
  end if;

  if v_reward.required_badge_id is not null then
    if not exists (
      select 1 from public.user_badges
      where user_id = v_uid and badge_id = v_reward.required_badge_id
    ) then
      raise exception 'Bu ödül için gereken rozete sahip değilsin.';
    end if;
  end if;

  if v_balance < v_reward.coin_cost then
    raise exception 'Yeterli coin''in yok. Gereken: %, bakiyen: %.',
      v_reward.coin_cost, v_balance;
  end if;

  v_code := public.generate_redemption_code();

  insert into public.reward_redemptions (reward_id, user_id, code)
  values (p_reward_id, v_uid, v_code)
  returning * into v_row;

  -- Harcama negatif yazılıyor: bakiye işlemlerin toplamı.
  insert into public.coin_transactions (user_id, amount, reason, redemption_id)
  values (v_uid, -v_reward.coin_cost, 'reward_spend', v_row.id);

  perform public.notify(
    v_uid,
    'reward_redeemed',
    v_reward.title || ' ödülünü aldın',
    'Kupon kodun: ' || v_code,
    v_row.id
  );

  return v_row;
end;
$$;

revoke all on function public.redeem_reward(uuid) from public;
revoke all on function public.redeem_reward(uuid) from anon;
grant execute on function public.redeem_reward(uuid) to authenticated;

/*
  Kupon kodunu kullanılmış olarak işaretler.
  Yalnızca ödülün ait olduğu belediyenin personeli ya da süper admin.
*/
create or replace function public.use_redemption_code(p_code text)
returns public.reward_redemptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_redemption public.reward_redemptions;
  v_reward public.rewards;
  v_row public.reward_redemptions;
begin
  if v_uid is null then
    raise exception 'Bu işlem için giriş yapmalısın.';
  end if;

  select * into v_redemption
  from public.reward_redemptions
  where code = upper(trim(p_code));

  if v_redemption.id is null then
    raise exception 'Kod bulunamadı.';
  end if;

  select * into v_reward from public.rewards where id = v_redemption.reward_id;

  if not (
    public.is_super_admin()
    or (
      v_reward.municipality_id is not null
      and public.has_municipality_role(
        v_reward.municipality_id,
        array['municipality_admin', 'municipality_operator']
      )
    )
  ) then
    raise exception 'Bu kodu kullanma yetkin yok.';
  end if;

  if v_redemption.status = 'used' then
    raise exception 'Bu kod daha önce kullanılmış.';
  end if;

  if v_redemption.status = 'cancelled' then
    raise exception 'Bu kod iptal edilmiş.';
  end if;

  update public.reward_redemptions
  set status = 'used', used_at = now(), used_by = v_uid
  where id = v_redemption.id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.use_redemption_code(text) from public;
revoke all on function public.use_redemption_code(text) from anon;
grant execute on function public.use_redemption_code(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Seed
-- ---------------------------------------------------------------------------

insert into public.rewards (id, municipality_id, title, description, coin_cost, min_level, required_badge_id, stock, status)
values
  ('0000ded0-0000-4000-8000-000000000001', null, 'Rozet Paketi — Dijital',
   'Profilinde görünen özel bir dijital rozet paketi.', 200, 2, null, null, 'active'),
  ('0000ded0-0000-4000-8000-000000000002', null, 'Kahve Kuponu (örnek)',
   'Anlaşmalı kafelerde geçerli örnek kupon.', 500, 3, null, 50, 'active')
on conflict do nothing;

insert into public.rewards (id, municipality_id, title, description, coin_cost, min_level, required_badge_id, stock, status)
select '0000ded0-0000-4000-8000-000000000003', null, 'Etkinlik Kontenjanı (örnek)',
       'Sınırlı kontenjanlı örnek etkinlik katılım hakkı.', 800, 4, b.id, 20, 'active'
from public.badges b where b.slug = 'first-step'
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.rewards enable row level security;
alter table public.reward_redemptions enable row level security;

create policy rewards_select_active on public.rewards
  for select to anon, authenticated using (status = 'active');

create policy rewards_select_staff on public.rewards
  for select to authenticated using (
    municipality_id is not null
    and public.has_municipality_role(
      municipality_id,
      array['municipality_admin', 'municipality_operator']
    )
  );

create policy rewards_select_super on public.rewards
  for select to authenticated using (public.is_super_admin());

create policy rewards_insert_staff on public.rewards
  for insert to authenticated with check (
    public.is_super_admin()
    or (
      municipality_id is not null
      and public.has_municipality_role(
        municipality_id,
        array['municipality_admin', 'municipality_operator']
      )
    )
  );

create policy rewards_update_staff on public.rewards
  for update to authenticated
  using (
    public.is_super_admin()
    or (
      municipality_id is not null
      and public.has_municipality_role(
        municipality_id,
        array['municipality_admin', 'municipality_operator']
      )
    )
  )
  with check (
    public.is_super_admin()
    or (
      municipality_id is not null
      and public.has_municipality_role(
        municipality_id,
        array['municipality_admin', 'municipality_operator']
      )
    )
  );

create policy rewards_delete_super on public.rewards
  for delete to authenticated using (public.is_super_admin());

create policy reward_redemptions_select_own on public.reward_redemptions
  for select to authenticated using (user_id = (select auth.uid()));

create policy reward_redemptions_select_staff on public.reward_redemptions
  for select to authenticated using (
    exists (
      select 1 from public.rewards r
      where r.id = reward_redemptions.reward_id
        and r.municipality_id is not null
        and public.has_municipality_role(
          r.municipality_id,
          array['municipality_admin', 'municipality_operator']
        )
    )
  );

create policy reward_redemptions_select_super on public.reward_redemptions
  for select to authenticated using (public.is_super_admin());

-- Kupon yazımı yalnızca redeem_reward / use_redemption_code içinden.

revoke all on public.rewards from anon, authenticated;
grant select on public.rewards to anon, authenticated;
grant insert, update, delete on public.rewards to authenticated;

revoke all on public.reward_redemptions from anon, authenticated;
grant select on public.reward_redemptions to authenticated;
