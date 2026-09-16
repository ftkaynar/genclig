-- M32b (D33 FAZ Z): Görev Zincirleri — sıralı görev setleri ve bonus.

-- ===========================================================================
-- 1. Tablolar
-- ===========================================================================

create table if not exists public.task_chains (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  icon text,
  /*
    municipality_id şimdilik HER ZAMAN null.

    Belediye zincirleri bu dilimin kapsamı dışında (rapora borç olarak
    yazıldı): belediye kullanıcı kümesi görev kümesinden farklı ve
    "kendi belediyemin zinciri" ile "ülke geneli zincir" aynı listede
    karışırdı. Kolon şimdiden açılıyor ki o iş geldiğinde tabloya
    dokunmak gerekmesin.
  */
  municipality_id uuid references public.municipalities(id) on delete cascade,
  bonus_xp integer not null default 0 check (bonus_xp >= 0),
  bonus_token integer not null default 0 check (bonus_token >= 0),
  status text not null default 'active' check (status in ('active', 'passive')),
  sort smallint not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists task_chains_status_idx
  on public.task_chains (status, sort);

/*
  Zincir adımları.

  Birincil anahtar (chain_id, task_id): aynı görev bir zincirde iki kez
  olamaz. Ayrı bir id + tekil indeks denendi ve elendi — "bu görev bu
  zincirde var mı" sorusu en sık sorulan soru ve birincil anahtarla
  cevaplanmalı.

  sort adımların GÖSTERİM sırası. Tamamlama sırası ZORUNLU DEĞİL:
  kullanıcı adımları istediği sırayla yapabiliyor. Zorunlu sıra
  denendi ve elendi — üçüncü adımı yanlışlıkla önce yapan kullanıcının
  ilerlemesi sayılmıyordu ve bu cezalandırıcı hissettiriyordu.
*/
create table if not exists public.chain_steps (
  chain_id uuid not null references public.task_chains(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  sort smallint not null default 0,
  primary key (chain_id, task_id)
);

create index if not exists chain_steps_task_idx on public.chain_steps (task_id);

/*
  KAPI TABLOSU (D33 ortak idempotens deseni).

  Birincil anahtar (chain_id, user_id). Bonus yazmadan ÖNCE buraya
  insert ... on conflict do nothing yapılıyor; satır gerçekten girdiyse
  transaction yazılıyor. İki tetik aynı anda yarışsa bile yalnız biri
  geçiyor.

  Neden transaction tablosuna kolon eklenmedi: her yeni bonus için
  xp_transactions'a kolon + kısmi tekil indeks eklemek tabloyu her
  özellikte genişletiyor ve eski satırlarda null bırakıyordu.
*/
create table if not exists public.chain_awards (
  chain_id uuid not null references public.task_chains(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  awarded_at timestamptz not null default now(),
  primary key (chain_id, user_id)
);

-- ===========================================================================
-- 2. RLS
-- ===========================================================================

alter table public.task_chains enable row level security;
alter table public.chain_steps enable row level security;
alter table public.chain_awards enable row level security;

-- Aktif zincirler herkese açık; pasifler yalnız süper admine.
drop policy if exists task_chains_select on public.task_chains;
create policy task_chains_select on public.task_chains
  for select to authenticated
  using (status = 'active' or public.is_super_admin());

drop policy if exists task_chains_write on public.task_chains;
create policy task_chains_write on public.task_chains
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

/*
  Adımlar zincirinin görünürlüğünü miras alıyor: pasif bir zincirin
  adımları da gizli. Adımları bağımsız açmak, pasif zincirdeki görev
  listesini sızdırırdı.
*/
drop policy if exists chain_steps_select on public.chain_steps;
create policy chain_steps_select on public.chain_steps
  for select to authenticated
  using (
    exists (
      select 1 from public.task_chains c
      where c.id = chain_id
        and (c.status = 'active' or public.is_super_admin())
    )
  );

drop policy if exists chain_steps_write on public.chain_steps;
create policy chain_steps_write on public.chain_steps
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

/*
  Kapı tablosu: kullanıcı yalnız KENDİ satırını görüyor.

  Yazma politikası YOK — tabloya yalnızca security definer fonksiyon
  yazıyor. Politikasız bir tabloya authenticated rol yazamaz; bu,
  istemcinin kendine bonus açmasını şemadan engelliyor.
*/
drop policy if exists chain_awards_select_own on public.chain_awards;
create policy chain_awards_select_own on public.chain_awards
  for select to authenticated
  using (user_id = (select auth.uid()));

-- ===========================================================================
-- 3. Tamamlama kontrolü
-- ===========================================================================

/*
  Bu görevi içeren zincirlerde tamamlanma var mı?

  award_task_points'in sonunda çağrılıyor. Yalnız TESLİM EDİLEN görevi
  içeren zincirlere bakıyor: kullanıcının tüm zincirlerini her onayda
  taramak, zincir sayısı arttıkça onay yolunu yavaşlatırdı.

  "Tamamlandı" ölçütü: zincirin HER adımında kullanıcının approved bir
  teslimi var. Dönem ayrımı yok — zincir bir kez tamamlanıyor ve kapı
  tablosu tekrarı engelliyor.
*/
create or replace function public.check_chain_completion(
  p_user uuid,
  p_task uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_chain record;
  v_missing integer;
begin
  if p_user is null or p_task is null then
    return;
  end if;

  for v_chain in
    select c.id, c.title, c.bonus_xp, c.bonus_token
    from public.task_chains c
    join public.chain_steps s on s.chain_id = c.id
    where s.task_id = p_task
      and c.status = 'active'
      -- Zaten ödüllendirilmiş zinciri hiç hesaplama.
      and not exists (
        select 1 from public.chain_awards a
        where a.chain_id = c.id and a.user_id = p_user
      )
  loop
    -- Eksik adım sayısı: onaylı teslimi olmayan adımlar.
    select count(*) into v_missing
    from public.chain_steps s
    where s.chain_id = v_chain.id
      and not exists (
        select 1 from public.task_submissions ts
        where ts.task_id = s.task_id
          and ts.user_id = p_user
          and ts.status = 'approved'
      );

    if v_missing > 0 then
      continue;
    end if;

    /*
      KAPI: satır gerçekten girdiyse ödül yaz. `found` bir önceki
      insert'in satır yazıp yazmadığını söylüyor; on conflict do nothing
      çakışmada found'u false bırakıyor.
    */
    insert into public.chain_awards (chain_id, user_id)
    values (v_chain.id, p_user)
    on conflict do nothing;

    if not found then
      continue;
    end if;

    if v_chain.bonus_xp > 0 then
      insert into public.xp_transactions (user_id, amount, reason)
      values (p_user, v_chain.bonus_xp, 'chain_bonus');
    end if;

    if v_chain.bonus_token > 0 then
      insert into public.coin_transactions (user_id, amount, reason)
      values (p_user, v_chain.bonus_token, 'chain_bonus');
    end if;

    perform public.notify(
      p_user,
      'chain_completed',
      'Zinciri tamamladın!',
      v_chain.title || ' zincirini bitirdin: +' || v_chain.bonus_xp
        || ' XP • +' || v_chain.bonus_token || ' Token',
      v_chain.id
    );
  end loop;
end;
$$;

revoke all on function public.check_chain_completion(uuid, uuid) from public, anon;
grant execute on function public.check_chain_completion(uuid, uuid) to authenticated;

-- ===========================================================================
-- 4. award_task_points'e bağlama
-- ===========================================================================

/*
  Zincir kontrolü award_task_points'in SONUNDA.

  Rozet ve istatistik hesabından sonra: zincir bonusu da bir XP kaynağı
  ve rozet eşiklerini etkileyebiliyor. Sıra "önce görev puanı, sonra
  zincir, sonra rozet" olsaydı zincir bonusuyla eşiği geçen kullanıcı
  rozetini bir onay geç alırdı.

  Bu yüzden zincirden sonra rozet ve istatistik BİR KEZ DAHA çağrılıyor
  — ikisi de idempotent (kendi kapıları var).
*/
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

  perform public.check_and_award_badges(v_submission.user_id);
  perform public.recompute_user_stats(v_submission.user_id);
end;
$$;

-- ===========================================================================
-- 5. Okuma yardımcıları
-- ===========================================================================

/*
  Kullanıcının zincir ilerlemesi.

  Tek RPC: liste ekranı her zincir için ayrı sorgu atmak zorunda
  kalmasın. Adım sayısı ve tamamlanan adım sayısı burada hesaplanıyor —
  istemcide hesaplamak, RLS'in teslimleri gizlemesi yüzünden yanlış
  sonuç verirdi (kullanıcı yalnız kendi teslimini görüyor ama sayımı
  yine de doğru olmalı).
*/
create or replace function public.my_chains()
returns table (
  chain_id uuid,
  title text,
  description text,
  icon text,
  bonus_xp integer,
  bonus_token integer,
  step_count integer,
  done_count integer,
  awarded boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    c.title,
    c.description,
    c.icon,
    c.bonus_xp,
    c.bonus_token,
    (select count(*)::integer from public.chain_steps s where s.chain_id = c.id),
    (select count(*)::integer
       from public.chain_steps s
      where s.chain_id = c.id
        and exists (
          select 1 from public.task_submissions ts
          where ts.task_id = s.task_id
            and ts.user_id = (select auth.uid())
            and ts.status = 'approved'
        )),
    exists (
      select 1 from public.chain_awards a
      where a.chain_id = c.id and a.user_id = (select auth.uid())
    )
  from public.task_chains c
  where c.status = 'active'
  order by c.sort, c.created_at;
$$;

revoke all on function public.my_chains() from public, anon;
grant execute on function public.my_chains() to authenticated;

/** Tek zincirin adımları, kullanıcının durumu ile. */
create or replace function public.chain_steps_of(p_chain uuid)
returns table (
  task_id uuid,
  title text,
  icon text,
  xp integer,
  coin integer,
  sort smallint,
  done boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    t.id,
    t.title,
    coalesce(t.icon, tc.icon),
    t.xp,
    t.coin,
    s.sort,
    exists (
      select 1 from public.task_submissions ts
      where ts.task_id = t.id
        and ts.user_id = (select auth.uid())
        and ts.status = 'approved'
    )
  from public.chain_steps s
  join public.tasks t on t.id = s.task_id
  left join public.task_categories tc on tc.id = t.category_id
  where s.chain_id = p_chain
    and exists (
      select 1 from public.task_chains c
      where c.id = p_chain and c.status = 'active'
    )
  order by s.sort, t.title;
$$;

revoke all on function public.chain_steps_of(uuid) from public, anon;
grant execute on function public.chain_steps_of(uuid) to authenticated;

-- ===========================================================================
-- 6. Örnek zincir
-- ===========================================================================

/*
  "Kültür Kaşifi" — üç kültür/eğitim görevinden oluşan örnek zincir.

  Seed idempotent: aynı başlıkla ikinci bir zincir açmıyor. Adımlar
  mevcut aktif görevlerden seçiliyor; uygun görev yoksa zincir adımsız
  kalıyor ve arayüzde görünmüyor (adımsız zincir "0/0" gösterirdi).
*/
do $$
declare
  v_chain uuid;
  v_task uuid;
  v_i smallint := 0;
begin
  select id into v_chain from public.task_chains where title = 'Kültür Kaşifi';

  if v_chain is null then
    insert into public.task_chains
      (title, description, icon, bonus_xp, bonus_token, status, sort)
    values (
      'Kültür Kaşifi',
      'Şehrinin kültürünü keşfet: üç görevi tamamla, bonusu kap.',
      'palette',
      150,
      100,
      'active',
      0
    )
    returning id into v_chain;
  end if;

  if not exists (select 1 from public.chain_steps where chain_id = v_chain) then
    /*
      Adımlar ÜÇE tamamlanıyor: önce kültür/eğitim görevleri, yetmezse
      herhangi bir global görev.

      İlk yazımda yedek doldurma yalnız HİÇ adım yoksa çalışıyordu ve
      iki kültür görevi olan bir veritabanında zincir 2 adımda kalıyordu
      (ölçüldü). Zincirin anlamı "birkaç görevlik bir seri"; iki adım
      seri hissi vermiyor.
    */
    for v_task in
      select t.id
      from public.tasks t
      left join public.task_categories c on c.id = t.category_id
      where t.status = 'active'
        and t.municipality_id is null
      order by
        (coalesce(c.slug, '') in ('culture', 'education')) desc,
        t.created_at
      limit 3
    loop
      insert into public.chain_steps (chain_id, task_id, sort)
      values (v_chain, v_task, v_i)
      on conflict do nothing;
      v_i := v_i + 1;
    end loop;
  end if;

  raise notice 'ornek zincir hazir: %', v_chain;
end;
$$;
