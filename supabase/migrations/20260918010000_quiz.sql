-- Quiz doğrulaması (M23).
--
-- Şema D06'da `verification = 'quiz'` değerini zaten kabul ediyordu ama
-- davranışı yoktu. Bu migration soruları, cevap kontrolünü ve puan yazımını
-- ekliyor.

create table public.task_quiz_questions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  question text not null check (char_length(question) between 3 and 500),
  /*
    options: [{"key":"a","text":"..."}, ...] — 2 ile 6 şık.
    jsonb seçildi çünkü şık sayısı göreve göre değişiyor ve ayrı bir
    satır tablosu her soru için ek bir sorgu turu demekti.
  */
  options jsonb not null,
  correct_key text not null,
  sort smallint not null default 0,
  created_at timestamptz not null default now(),

  constraint task_quiz_options_count check (
    jsonb_typeof(options) = 'array'
    and jsonb_array_length(options) between 2 and 6
  )
);

create index task_quiz_questions_task_idx
  on public.task_quiz_questions (task_id, sort);

/*
  Geçme eşiği.

  Şimdilik sabit %80. tasks tablosuna taşınabilir, ama görev başına eşik
  ayarlamanın bir ihtiyaç olduğu henüz ölçülmedi; sabit değerle başlayıp
  gerekirse kolona çevirmek, hiç kullanılmayan bir kolon taşımaktan iyi.
*/
create or replace function public.quiz_pass_ratio()
returns numeric
language sql
immutable
set search_path = ''
as $$ select 0.80::numeric $$;

grant execute on function public.quiz_pass_ratio() to anon, authenticated;

/*
  Kullanıcıya gösterilecek sorular — doğru cevap ANAHTARI OLMADAN.

  Kritik güvenlik noktası: `correct_key` hiçbir koşulda kullanıcıya
  gitmemeli. Bu yüzden ham tabloda kullanıcı için select politikası YOK;
  soruları yalnızca bu fonksiyon veriyor ve dönüş tipinde correct_key
  sütunu hiç bulunmuyor.

  Denenen ve elenen alternatif: tabloya sütun bazlı select yetkisi verip
  (`grant select (id, task_id, question, options, sort)`) politika yazmak.
  Elendi, çünkü PostgREST `select=*` ile sütun listesini genişletebiliyor
  ve tek bir yanlış yapılandırmada anahtar sızıyordu; fonksiyon sınırı
  daha dar ve gözle denetlenebilir.
*/
create or replace function public.get_task_quiz(p_task_id uuid)
returns table (
  id uuid,
  question text,
  options jsonb,
  sort smallint
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return;
  end if;

  -- Görev yayında değilse soruları da vermiyoruz.
  if not exists (
    select 1 from public.tasks t
    where t.id = p_task_id and t.status = 'active'
  ) then
    return;
  end if;

  return query
  select q.id, q.question, q.options, q.sort
  from public.task_quiz_questions q
  where q.task_id = p_task_id
  order by q.sort, q.created_at;
end;
$$;

revoke all on function public.get_task_quiz(uuid) from public;
revoke all on function public.get_task_quiz(uuid) from anon;
grant execute on function public.get_task_quiz(uuid) to authenticated;

/*
  Quiz teslimi.

  p_answers biçimi: {"<soru_id>": "<şık_key>", ...}

  Neden pending teslim açılmıyor: quiz insan incelemesi gerektirmiyor,
  cevap ya doğru ya yanlış. Kalan kullanıcı tekrar denemeli; pending bir
  satır açılsaydı `task_submissions_open_unique` ikinci denemeyi
  engellerdi ve kullanıcı görevi bir daha hiç yapamazdı. Bu yüzden
  yalnızca GEÇİNCE approved satır yazılıyor.

  Dönen: oran ve geçip geçmediği.
*/
create or replace function public.submit_quiz(p_task_id uuid, p_answers jsonb)
returns table (passed boolean, correct_count integer, total_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_task public.tasks;
  v_period text;
  v_total integer;
  v_correct integer;
  v_ratio numeric;
  v_row public.task_submissions;
begin
  if v_uid is null then
    raise exception 'Bu işlem için giriş yapmalısın.';
  end if;

  select * into v_task from public.tasks where id = p_task_id;

  if v_task.id is null then
    raise exception 'Görev bulunamadı.';
  end if;

  if v_task.status <> 'active' then
    raise exception 'Görev aktif değil.';
  end if;

  if v_task.verification <> 'quiz' then
    raise exception 'Bu görev test görevi değil.';
  end if;

  if v_task.starts_at is not null and v_task.starts_at > now() then
    raise exception 'Görev henüz başlamadı.';
  end if;

  if v_task.ends_at is not null and v_task.ends_at < now() then
    raise exception 'Görevin süresi dolmuş.';
  end if;

  -- Takım görevi kuralı quiz'de de geçerli.
  if v_task.scope = 'team'
     and not exists (select 1 from public.team_members where user_id = v_uid) then
    raise exception 'Bu görev takım görevi — önce bir takıma katıl.';
  end if;

  v_period := public.task_period_key(v_task.type, now());

  if exists (
    select 1 from public.task_submissions
    where task_id = p_task_id
      and user_id = v_uid
      and period_key = v_period
      and status = 'approved'
  ) then
    raise exception 'Bu görevi zaten tamamladın.';
  end if;

  select count(*) into v_total
  from public.task_quiz_questions where task_id = p_task_id;

  if v_total = 0 then
    raise exception 'Bu görevin soruları henüz hazır değil.';
  end if;

  select count(*) into v_correct
  from public.task_quiz_questions q
  where q.task_id = p_task_id
    and p_answers ->> q.id::text = q.correct_key;

  v_ratio := v_correct::numeric / v_total::numeric;

  if v_ratio < public.quiz_pass_ratio() then
    return query select false, v_correct, v_total;
    return;
  end if;

  insert into public.task_submissions (
    task_id, user_id, status, reviewed_at
  )
  values (p_task_id, v_uid, 'approved', now())
  returning * into v_row;

  perform public.award_task_points(v_row.id);

  return query select true, v_correct, v_total;
end;
$$;

revoke all on function public.submit_quiz(uuid, jsonb) from public;
revoke all on function public.submit_quiz(uuid, jsonb) from anon;
grant execute on function public.submit_quiz(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Seed: bir quiz görevi + üç soru
-- ---------------------------------------------------------------------------

insert into public.tasks (
  id, municipality_id, category_id, type, title, description, instructions,
  xp, coin, verification, icon, difficulty, status
)
values (
  '0000f1a5-0000-4000-8000-0000000000a1',
  null,
  (select id from public.task_categories where slug = 'culture'),
  'continuous',
  'Belediye tarih müzesini ziyaret et',
  'Müzeyi gez, sonra kısa testi çözerek görevi tamamla.',
  'Testte soruların en az %80''ini doğru yanıtlaman gerekiyor.',
  70, 35, 'quiz', 'landmark', 'easy', 'active'
)
on conflict do nothing;

insert into public.task_quiz_questions (task_id, question, options, correct_key, sort)
values
  (
    '0000f1a5-0000-4000-8000-0000000000a1',
    'Müzede sergilenen en eski eser hangi döneme ait?',
    '[{"key":"a","text":"Osmanlı"},{"key":"b","text":"Bizans"},{"key":"c","text":"Roma"}]'::jsonb,
    'c', 1
  ),
  (
    '0000f1a5-0000-4000-8000-0000000000a1',
    'Müze hangi günler ziyarete kapalı?',
    '[{"key":"a","text":"Pazartesi"},{"key":"b","text":"Çarşamba"},{"key":"c","text":"Cumartesi"}]'::jsonb,
    'a', 2
  ),
  (
    '0000f1a5-0000-4000-8000-0000000000a1',
    'Müzedeki sergi salonu sayısı kaçtır?',
    '[{"key":"a","text":"3"},{"key":"b","text":"5"},{"key":"c","text":"8"}]'::jsonb,
    'b', 3
  )
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.task_quiz_questions enable row level security;

/*
  Kullanıcı için select politikası bilerek YOK.

  Sorular yalnızca get_task_quiz üzerinden, correct_key olmadan gidiyor.
  Ham tabloyu okuyabilen tek kesim yönetim: süper admin ve görevin
  belediyesindeki personel — onların doğru cevabı görmesi zaten gerekli
  (soruyu onlar yazıyor).
*/
create policy task_quiz_select_super on public.task_quiz_questions
  for select to authenticated using (public.is_super_admin());

create policy task_quiz_select_staff on public.task_quiz_questions
  for select to authenticated using (
    exists (
      select 1 from public.tasks t
      where t.id = task_quiz_questions.task_id
        and t.municipality_id is not null
        and public.has_municipality_role(
          t.municipality_id, array['municipality_admin', 'municipality_operator']
        )
    )
  );

create policy task_quiz_write_super on public.task_quiz_questions
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy task_quiz_write_staff on public.task_quiz_questions
  for all to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_quiz_questions.task_id
        and t.municipality_id is not null
        and public.has_municipality_role(
          t.municipality_id, array['municipality_admin', 'municipality_operator']
        )
    )
  )
  with check (
    exists (
      select 1 from public.tasks t
      where t.id = task_quiz_questions.task_id
        and t.municipality_id is not null
        and public.has_municipality_role(
          t.municipality_id, array['municipality_admin', 'municipality_operator']
        )
    )
  );

revoke all on public.task_quiz_questions from anon, authenticated;
grant select, insert, update, delete on public.task_quiz_questions to authenticated;
