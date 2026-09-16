-- M32a (D33 FAZ GG): Günün Görevi — 2x ödüllü günlük vitrin.

-- ===========================================================================
-- 1. Tablo
-- ===========================================================================

/*
  Günün Görevi.

  Birincil anahtar GÜN: bir günde tek görev vitrine çıkıyor. Ayrı bir
  id + tekil indeks denendi ve elendi — "bugünün görevi" sorusunun
  cevabı tek satır olmalı ve bunu şema garanti etmeli, uygulama değil.

  created_by null olabiliyor: satırı cron da yazabiliyor, insan da.
  Null = otomatik seçim, dolu = süper admin sabitledi.
*/
create table if not exists public.daily_spotlight (
  day date primary key,
  task_id uuid not null references public.tasks(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists daily_spotlight_task_idx
  on public.daily_spotlight (task_id);

alter table public.daily_spotlight enable row level security;

-- Herkes görebilir: vitrin zaten herkese gösteriliyor.
drop policy if exists daily_spotlight_select on public.daily_spotlight;
create policy daily_spotlight_select on public.daily_spotlight
  for select to authenticated using (true);

/*
  Yazma yalnız süper admin.

  Belediye personeli DIŞARIDA: Günün Görevi ülke çapında tek bir
  vitrin; her belediyenin kendi gününü sabitlemesi, aynı gün için
  yarışan satırlar demekti (birincil anahtar zaten buna izin vermezdi
  ve personel sebepsiz hata görürdü).
*/
drop policy if exists daily_spotlight_write on public.daily_spotlight;
create policy daily_spotlight_write on public.daily_spotlight
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ===========================================================================
-- 2. Seçim
-- ===========================================================================

/*
  Belirli bir günün vitrin görevi.

  Ayrı fonksiyon: hem arayüz hem puanlama aynı cevabı vermeli. İki
  yerde ayrı sorgu yazmak, birinin "bugün"ü UTC'ye göre çözmesi
  demekti.
*/
create or replace function public.spotlight_task_id(p_day date default null)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.task_id
  from public.daily_spotlight s
  where s.day = coalesce(p_day, public.istanbul_day())
  limit 1;
$$;

revoke all on function public.spotlight_task_id(date) from public, anon;
grant execute on function public.spotlight_task_id(date) to authenticated;

/*
  Otomatik seçim.

  DETERMİNİSTİK: aynı gün için kaç kez çağrılırsa çağrılsın aynı görevi
  seçiyor. random() denendi ve elendi — cron iki kez koşarsa (yeniden
  deneme, elle tetikleme) aynı günün görevi değişiyordu ve 2x ödül
  alan kullanıcı ile vitrinde görünen görev ayrışıyordu.

  Sıralama anahtarı md5(gün || görev kimliği): güne göre değişiyor ama
  gün sabitken sabit.

  Aday havuzu: aktif, GLOBAL (belediyesi olmayan) ve süresi geçmemiş
  görevler. Belediyeye bağlı görev vitrine çıkmıyor — ülkenin geri
  kalanı o görevi yapamıyor ve 2x ödül erişilemez olurdu.

  Dünkü görev atlanıyor: art arda aynı görev vitrinde kalırsa "günün"
  görevi olmaktan çıkıyor.
*/
create or replace function public.pick_daily_spotlight(p_day date default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date := coalesce(p_day, public.istanbul_day());
  v_existing uuid;
  v_yesterday uuid;
  v_pick uuid;
begin
  -- Elle sabitlenmiş ya da daha önce seçilmiş gün: dokunma.
  select task_id into v_existing
  from public.daily_spotlight where day = v_day;

  if v_existing is not null then
    return v_existing;
  end if;

  select task_id into v_yesterday
  from public.daily_spotlight where day = v_day - 1;

  select t.id into v_pick
  from public.tasks t
  where t.status = 'active'
    and t.municipality_id is null
    and (t.starts_at is null or t.starts_at <= now())
    and (t.ends_at is null or t.ends_at > now())
    and (v_yesterday is null or t.id <> v_yesterday)
  order by md5(v_day::text || t.id::text)
  limit 1;

  if v_pick is null then
    -- Aday yoksa vitrin boş kalıyor; hata DEĞİL.
    return null;
  end if;

  insert into public.daily_spotlight (day, task_id, created_by)
  values (v_day, v_pick, null)
  on conflict (day) do nothing;

  -- Yarış durumunda kazanan satırı döndür, kendi seçimini değil.
  select task_id into v_existing
  from public.daily_spotlight where day = v_day;

  return v_existing;
end;
$$;

revoke all on function public.pick_daily_spotlight(date) from public, anon;
grant execute on function public.pick_daily_spotlight(date) to authenticated;

/*
  Süper adminin sabitlemesi.

  Yalnız bugün ve yarın: geçmiş bir günün vitrinini değiştirmek, o gün
  2x alan teslimlerle çelişirdi (ödül zaten yazılmış olurdu).
*/
create or replace function public.set_daily_spotlight(
  p_day date,
  p_task uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := public.istanbul_day();
begin
  if not public.is_super_admin() then
    raise exception 'Bu işlem için yetkin yok.';
  end if;

  if p_day < v_today or p_day > v_today + 1 then
    raise exception 'Yalnızca bugün ya da yarın için seçim yapabilirsin.';
  end if;

  if not exists (
    select 1 from public.tasks
    where id = p_task and status = 'active'
  ) then
    raise exception 'Görev bulunamadı ya da yayında değil.';
  end if;

  insert into public.daily_spotlight (day, task_id, created_by)
  values (p_day, p_task, (select auth.uid()))
  on conflict (day) do update
    set task_id = excluded.task_id,
        created_by = excluded.created_by,
        created_at = now();
end;
$$;

revoke all on function public.set_daily_spotlight(date, uuid) from public, anon;
grant execute on function public.set_daily_spotlight(date, uuid) to authenticated;

/** Vitrin kaydını kaldırır (otomatik seçime geri döner). */
create or replace function public.clear_daily_spotlight(p_day date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Bu işlem için yetkin yok.';
  end if;

  if p_day < public.istanbul_day() then
    raise exception 'Geçmiş gün değiştirilemez.';
  end if;

  delete from public.daily_spotlight where day = p_day;
end;
$$;

revoke all on function public.clear_daily_spotlight(date) from public, anon;
grant execute on function public.clear_daily_spotlight(date) to authenticated;

-- ===========================================================================
-- 3. 2x ödül
-- ===========================================================================

/*
  award_task_points: vitrin görevinde ödül İKİ KATI.

  IDEMPOTENS DEĞİŞMİYOR: hâlâ tek satır yazılıyor, yalnız MİKTAR iki
  katı. `xp_transactions_task_submission_unique` kısmi indeksi aynı
  teslim için ikinci satırı zaten engelliyor; ikinci bir "spotlight
  bonusu" satırı yazmak o garantiyi kaybettirirdi.

  Hangi gün: TESLİMİN tarihi (created_at), onayın değil. Kullanıcı
  görevi vitrin gününde yaptıysa 2x hak ediyor; onayın üç gün sonra
  gelmesi bunu değiştirmemeli.
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

  -- Günün Görevi: teslim tarihinde vitrindeyse çarpan 2.
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

  perform public.check_and_award_badges(v_submission.user_id);
  perform public.recompute_user_stats(v_submission.user_id);
end;
$$;

-- ===========================================================================
-- 4. Günlük seçim işi
-- ===========================================================================

/*
  Gün başında (Istanbul 00:05) otomatik seçim.

  Cron ÇALIŞMASA BİLE sistem doğru işliyor: arayüz vitrini okurken
  kaydı bulamazsa pick_daily_spotlight'ı çağırıyor (tembel yol).
  Aynı desen D26'daki sıralama ödüllerinde kullanılmıştı.

  21:05 UTC = 00:05 Istanbul (sabit UTC+03).
*/
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
    from cron.job where jobname = 'genclig-daily-spotlight';

    perform cron.schedule(
      'genclig-daily-spotlight',
      '5 21 * * *',
      $cron$select public.pick_daily_spotlight();$cron$
    );

    raise notice 'pg_cron isi kuruldu: genclig-daily-spotlight';
  else
    raise notice 'pg_cron kurulu degil; tembel yol (ana sayfa) kullanilacak';
  end if;
end;
$$;
