-- M32c (D33 FAZ DV): Davet Sistemi — kod, bağ ve çift taraflı ödül.

-- ===========================================================================
-- 1. Davet kodu
-- ===========================================================================

alter table public.profiles
  add column if not exists invite_code text;

alter table public.profiles
  add column if not exists referred_by uuid references auth.users(id)
    on delete set null;

/*
  Kod üretimi.

  ALFABE bilerek dar: I/1, O/0, S/5 gibi karışan karakterler YOK. Kod
  sesli olarak paylaşılıyor ("kodum X7K...") ve telefonda elle
  yazılıyor; karışan bir harf desteğe düşen bir şikâyet demek.

  8 karakter: 32^8 ≈ 1.1 trilyon. Çakışma olasılığı milyon kullanıcıda
  bile ihmal edilebilir, ama yine de tekil indeks + yeniden deneme var.
*/
create or replace function public.generate_invite_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alphabet text := 'ABCDEFGHJKLMNPQRTUVWXYZ2346789';
  v_code text;
  v_i integer;
begin
  for v_try in 1..10 loop
    v_code := '';
    for v_i in 1..8 loop
      v_code := v_code || substr(
        v_alphabet,
        1 + floor(random() * length(v_alphabet))::integer,
        1
      );
    end loop;

    if not exists (
      select 1 from public.profiles where invite_code = v_code
    ) then
      return v_code;
    end if;
  end loop;

  -- On denemede de çakıştıysa kod üretilemiyor; çağıran karar versin.
  return null;
end;
$$;

revoke all on function public.generate_invite_code() from public, anon;

/*
  Mevcut kullanıcılara geri doldurma.

  Tekil indeks BU DOLDURMADAN SONRA kuruluyor: null'lar tekil indeksi
  bozmuyor ama kısmi indeksi baştan koymak, doldurma sırasında her
  satırda indeks bakımı demekti.
*/
do $$
declare
  v_row record;
  v_code text;
begin
  for v_row in select id from public.profiles where invite_code is null loop
    v_code := public.generate_invite_code();
    if v_code is not null then
      update public.profiles set invite_code = v_code where id = v_row.id;
    end if;
  end loop;
end;
$$;

create unique index if not exists profiles_invite_code_key
  on public.profiles (invite_code)
  where invite_code is not null;

/*
  Yeni profillerde kod otomatik.

  Trigger, onboarding'e bırakmaktan güvenli: profil satırını auth
  tetikleyicisi oluşturuyor ve onboarding'i hiç tamamlamayan bir
  kullanıcının da kodu olmalı (arkadaşı onu davet etmiş olabilir ve
  o bağ profil üzerinden kuruluyor).
*/
create or replace function public.set_invite_code_on_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.invite_code is null then
    new.invite_code := public.generate_invite_code();
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_invite_code on public.profiles;
create trigger profiles_invite_code
  before insert on public.profiles
  for each row execute function public.set_invite_code_on_insert();

-- ===========================================================================
-- 2. Ayarlar ve kapı tablosu
-- ===========================================================================

/*
  Ödül miktarları TABLODA, kodda değil: yönetici migration beklemeden
  ayarlayabilsin. Tek satır (id = 1) — birden fazla ayar seti diye bir
  şey yok ve check kısıtı bunu şemadan garanti ediyor.
*/
create table if not exists public.referral_settings (
  id smallint primary key default 1 check (id = 1),
  inviter_xp integer not null default 100 check (inviter_xp >= 0),
  inviter_token integer not null default 100 check (inviter_token >= 0),
  invited_xp integer not null default 50 check (invited_xp >= 0),
  invited_token integer not null default 50 check (invited_token >= 0),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.referral_settings (id) values (1)
on conflict (id) do nothing;

/*
  KAPI TABLOSU (D33 ortak idempotens deseni).

  Birincil anahtar DAVET EDİLEN kullanıcı: bir kullanıcı ömründe bir
  kez "ilk onaylı görevini yaptı" olabiliyor, yani ödül bir kez
  veriliyor. (inviter_id, invited_user_id) ikilisi denendi ve elendi —
  davet eden değişebilseydi aynı davetli iki kez ödül üretirdi.
*/
create table if not exists public.referral_awards (
  invited_user_id uuid primary key references auth.users(id) on delete cascade,
  inviter_id uuid not null references auth.users(id) on delete cascade,
  awarded_at timestamptz not null default now()
);

create index if not exists referral_awards_inviter_idx
  on public.referral_awards (inviter_id);

-- ===========================================================================
-- 3. RLS
-- ===========================================================================

alter table public.referral_settings enable row level security;
alter table public.referral_awards enable row level security;

drop policy if exists referral_settings_select on public.referral_settings;
create policy referral_settings_select on public.referral_settings
  for select to authenticated using (true);

drop policy if exists referral_settings_write on public.referral_settings;
create policy referral_settings_write on public.referral_settings
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

/*
  Kullanıcı yalnız KENDİSİNİ ilgilendiren satırı görüyor: ya davet
  edilen ya da davet eden. Yazma politikası YOK — tabloya yalnızca
  security definer fonksiyon yazıyor.
*/
drop policy if exists referral_awards_select_own on public.referral_awards;
create policy referral_awards_select_own on public.referral_awards
  for select to authenticated
  using (
    invited_user_id = (select auth.uid())
    or inviter_id = (select auth.uid())
  );

-- ===========================================================================
-- 4. Kod bağlama
-- ===========================================================================

/*
  Davet kodunu profile bağlar.

  Kurallar:
    - Kendi kodunu kullanamaz (kendi kendini davet etmek).
    - referred_by BİR KEZ yazılır; sonradan değiştirilemez.
    - Geçersiz kod hata veriyor, sessizce yok sayılmıyor: kullanıcı
      kodu yanlış yazdıysa bunu öğrenmeli.

  security definer: çağıran, davet edenin profil satırını okuyamıyor
  (RLS kendi satırıyla sınırlı) ama kodu doğrulamak için okumak
  gerekiyor.
*/
create or replace function public.apply_invite_code(p_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_code text := upper(trim(coalesce(p_code, '')));
  v_inviter uuid;
  v_current uuid;
begin
  if v_uid is null then
    raise exception 'Bu işlem için giriş yapmalısın.';
  end if;

  if v_code = '' then
    return;
  end if;

  select referred_by into v_current from public.profiles where id = v_uid;

  if v_current is not null then
    raise exception 'Davet kodun zaten tanımlı.';
  end if;

  select id into v_inviter
  from public.profiles where invite_code = v_code;

  if v_inviter is null then
    raise exception 'Davet kodu bulunamadı.';
  end if;

  if v_inviter = v_uid then
    raise exception 'Kendi davet kodunu kullanamazsın.';
  end if;

  update public.profiles set referred_by = v_inviter where id = v_uid;
end;
$$;

revoke all on function public.apply_invite_code(text) from public, anon;
grant execute on function public.apply_invite_code(text) to authenticated;

/** Davet kartı için: kendi kodum, davet ettiklerimin sayısı ve ayarlar. */
create or replace function public.my_invite()
returns table (
  invite_code text,
  invited_count integer,
  rewarded_count integer,
  inviter_xp integer,
  inviter_token integer,
  invited_xp integer,
  invited_token integer,
  active boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.invite_code,
    (select count(*)::integer from public.profiles q
      where q.referred_by = p.id),
    (select count(*)::integer from public.referral_awards a
      where a.inviter_id = p.id),
    s.inviter_xp,
    s.inviter_token,
    s.invited_xp,
    s.invited_token,
    s.active
  from public.profiles p
  cross join public.referral_settings s
  where p.id = (select auth.uid()) and s.id = 1;
$$;

revoke all on function public.my_invite() from public, anon;
grant execute on function public.my_invite() to authenticated;

-- ===========================================================================
-- 5. Ödül tetiği
-- ===========================================================================

/*
  Davet ödülü, davet edilenin İLK ONAYLI teslimi ile veriliyor.

  Neden kayıt anında değil: kayıt bedava, onaylı görev değil. Ödülü
  ilk gerçek katkıya bağlamak, sahte hesapla kod toplamanın önündeki
  temel fren (anti-abuse notu rapora yazıldı: cihaz/IP kontrolü YOK).

  KAPI: referral_awards'a insert ... on conflict do nothing; satır
  gerçekten girdiyse İKİ TARAFA da ödül yazılıyor. Tek kapı iki ödülü
  birden koruyor — ayrı kapılar, birinin yazıp diğerinin yazmaması
  demekti.
*/
create or replace function public.check_referral_reward(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inviter uuid;
  v_settings public.referral_settings;
  v_approved integer;
  v_invited_name text;
begin
  if p_user is null then
    return;
  end if;

  select referred_by, username into v_inviter, v_invited_name
  from public.profiles where id = p_user;

  if v_inviter is null then
    return;
  end if;

  select * into v_settings from public.referral_settings where id = 1;

  if v_settings.id is null or not v_settings.active then
    return;
  end if;

  -- Zaten ödüllendirilmişse hiç hesaplama.
  if exists (
    select 1 from public.referral_awards where invited_user_id = p_user
  ) then
    return;
  end if;

  select count(*) into v_approved
  from public.task_submissions
  where user_id = p_user and status = 'approved';

  if v_approved < 1 then
    return;
  end if;

  insert into public.referral_awards (invited_user_id, inviter_id)
  values (p_user, v_inviter)
  on conflict do nothing;

  if not found then
    return;
  end if;

  -- Davet eden
  if v_settings.inviter_xp > 0 then
    insert into public.xp_transactions (user_id, amount, reason)
    values (v_inviter, v_settings.inviter_xp, 'referral');
  end if;
  if v_settings.inviter_token > 0 then
    insert into public.coin_transactions (user_id, amount, reason)
    values (v_inviter, v_settings.inviter_token, 'referral');
  end if;

  perform public.notify(
    v_inviter,
    'referral_reward',
    'Davetin karşılığını buldu!',
    coalesce(v_invited_name, 'Davet ettiğin kişi')
      || ' ilk görevini tamamladı: +' || v_settings.inviter_xp
      || ' XP • +' || v_settings.inviter_token || ' Token',
    p_user
  );

  -- Davet edilen
  if v_settings.invited_xp > 0 then
    insert into public.xp_transactions (user_id, amount, reason)
    values (p_user, v_settings.invited_xp, 'referral');
  end if;
  if v_settings.invited_token > 0 then
    insert into public.coin_transactions (user_id, amount, reason)
    values (p_user, v_settings.invited_token, 'referral');
  end if;

  perform public.notify(
    p_user,
    'referral_reward',
    'Davet bonusun hazır!',
    'İlk görevini tamamladın: +' || v_settings.invited_xp
      || ' XP • +' || v_settings.invited_token || ' Token',
    v_inviter
  );

  -- İki tarafın da kartı tazeleniyor.
  perform public.recompute_user_stats(v_inviter);
end;
$$;

revoke all on function public.check_referral_reward(uuid) from public, anon;
grant execute on function public.check_referral_reward(uuid) to authenticated;

-- ===========================================================================
-- 6. award_task_points'e bağlama
-- ===========================================================================

create or replace function public.award_task_points(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_submission public.task_submissions;
  v_task public.tasks;
  v_team uuid;
  v_done integer;
  v_member record;
  v_multiplier integer := 1;
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

  -- Günün Görevi: teslim tarihinde vitrindeyse çarpan 2 (M32a).
  if v_task.id = public.spotlight_task_id(
       public.istanbul_day(v_submission.created_at)
     ) then
    v_multiplier := 2;
  end if;

  if v_task.xp > 0 then
    insert into public.xp_transactions (user_id, amount, reason, submission_id)
    values (v_submission.user_id, v_task.xp * v_multiplier, 'task', v_submission.id)
    on conflict do nothing;
  end if;

  if v_task.coin > 0 then
    insert into public.coin_transactions (user_id, amount, reason, submission_id)
    values (v_submission.user_id, v_task.coin * v_multiplier, 'task', v_submission.id)
    on conflict do nothing;
  end if;

  /*
    Takım bonusu ÇARPILMIYOR. Vitrin bireysel bir teşvik; takım bonusunu
    da ikiye katlamak, aynı gün takım görevi yapan bir ekibe dört kat
    avantaj veriyordu (kişi başı 2x + bonus 2x).
  */
  if v_task.scope = 'team'
     and (v_task.team_bonus_xp > 0 or v_task.team_bonus_coin > 0) then

    select team_id into v_team
    from public.team_members where user_id = v_submission.user_id;

    if v_team is not null then
      select count(*) into v_done
      from public.task_submissions s
      join public.team_members m on m.user_id = s.user_id
      where s.task_id = v_task.id
        and s.period_key = v_submission.period_key
        and s.status = 'approved'
        and m.team_id = v_team;

      if v_done >= coalesce(v_task.min_team_size, 2) then
        for v_member in
          select s.id as submission_id, s.user_id
          from public.task_submissions s
          join public.team_members m on m.user_id = s.user_id
          where s.task_id = v_task.id
            and s.period_key = v_submission.period_key
            and s.status = 'approved'
            and m.team_id = v_team
        loop
          if v_task.team_bonus_xp > 0 then
            insert into public.xp_transactions (user_id, amount, reason, submission_id)
            values (v_member.user_id, v_task.team_bonus_xp, 'team_bonus', v_member.submission_id)
            on conflict do nothing;
          end if;

          if v_task.team_bonus_coin > 0 then
            insert into public.coin_transactions (user_id, amount, reason, submission_id)
            values (v_member.user_id, v_task.team_bonus_coin, 'team_bonus', v_member.submission_id)
            on conflict do nothing;
          end if;

          perform public.notify(
            v_member.user_id,
            'system',
            'Takım bonusu kazandın',
            v_task.title || ' görevini takımca tamamladınız: +'
              || v_task.team_bonus_xp || ' XP • +' || v_task.team_bonus_coin || ' Coin',
            v_task.id
          );

          -- Bonus alan her üyenin kartı da tazeleniyor.
          perform public.recompute_user_stats(v_member.user_id);
        end loop;
      end if;
    end if;
  end if;

  -- D33 FAZ Z: bu görev bir zinciri tamamladı mı?
  perform public.check_chain_completion(v_submission.user_id, v_task.id);

  -- D33 FAZ DV: bu, davet edilen kullanıcının ilk onaylı görevi mi?
  perform public.check_referral_reward(v_submission.user_id);

  perform public.check_and_award_badges(v_submission.user_id);
  perform public.recompute_user_stats(v_submission.user_id);
end;
$$;
