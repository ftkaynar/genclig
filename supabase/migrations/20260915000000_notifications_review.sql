-- Bildirimler ve teslim inceleme motoru.
--
-- İki parça birlikte geliyor çünkü inceleme sonucunun kullanıcıya ulaşması
-- akışın parçası: onaylanan teslimden haberi olmayan kullanıcı puanının
-- nereden geldiğini anlamıyor.

-- ---------------------------------------------------------------------------
-- Bildirimler
-- ---------------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in (
    'submission_approved', 'submission_rejected', 'badge_earned',
    'problem_status', 'reward_redeemed', 'system'
  )),
  title text not null,
  body text,
  -- İlgili kaydın kimliği (teslim, rozet, rapor...). Tür bazlı, FK yok:
  -- farklı tablolara işaret ettiği için tek bir yabancı anahtar kurulamıyor.
  ref_id uuid,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_unread_idx
  on public.notifications (user_id, is_read, created_at desc);

alter table public.notifications enable row level security;

create policy notifications_select_own on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));

/*
  Okundu bilgisini kullanıcı değiştirebilmeli ama yalnızca kendi satırında ve
  yalnızca is_read alanında. UPDATE politikası yerine rpc seçildi: politika
  hangi sütunun değiştiğini göremiyor, kullanıcı kendi bildiriminin başlığını
  da düzenleyebilirdi.
*/

revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;

/*
  Bildirim yazma yardımcısı. Yalnızca diğer security definer fonksiyonlardan
  çağrılıyor; client'a execute yetkisi VERİLMİYOR, aksi halde kullanıcı
  kendine sahte bildirim üretebilirdi.
*/
create or replace function public.notify(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text default null,
  p_ref_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (user_id, type, title, body, ref_id)
  values (p_user_id, p_type, p_title, p_body, p_ref_id);
end;
$$;

revoke all on function public.notify(uuid, text, text, text, uuid) from public;
revoke all on function public.notify(uuid, text, text, text, uuid) from anon;
revoke all on function public.notify(uuid, text, text, text, uuid) from authenticated;

create or replace function public.mark_notification_read(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notifications
  set is_read = true
  where id = p_id
    and user_id = (select auth.uid());
end;
$$;

create or replace function public.mark_all_notifications_read()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notifications
  set is_read = true
  where user_id = (select auth.uid())
    and is_read = false;
end;
$$;

revoke all on function public.mark_notification_read(uuid) from public;
revoke all on function public.mark_notification_read(uuid) from anon;
grant execute on function public.mark_notification_read(uuid) to authenticated;

revoke all on function public.mark_all_notifications_read() from public;
revoke all on function public.mark_all_notifications_read() from anon;
grant execute on function public.mark_all_notifications_read() to authenticated;

-- ---------------------------------------------------------------------------
-- Teslim inceleme
-- ---------------------------------------------------------------------------

/*
  Bekleyen bir teslimi onaylar veya reddeder.

  Yetki kontrolü fonksiyonun içinde: execute yetkisi tüm oturum açmış
  kullanıcılarda, ama içeride süper admin ya da teslimin ait olduğu belediyede
  yetkili personel olma şartı aranıyor. Global görevlerin (municipality_id
  null) teslimlerini yalnızca süper admin inceleyebiliyor.

  Onayda ödül award_task_points üzerinden yazılıyor; o fonksiyon idempotent
  olduğu için çift tetik puan katlamıyor.
*/
create or replace function public.review_submission(
  p_submission_id uuid,
  p_action text,
  p_reason text default null
)
returns public.task_submissions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_submission public.task_submissions;
  v_task public.tasks;
  v_row public.task_submissions;
begin
  if v_uid is null then
    raise exception 'Bu işlem için giriş yapmalısın.';
  end if;

  if p_action not in ('approve', 'reject') then
    raise exception 'Geçersiz işlem.';
  end if;

  select * into v_submission
  from public.task_submissions
  where id = p_submission_id;

  if v_submission.id is null then
    raise exception 'Teslim bulunamadı.';
  end if;

  select * into v_task from public.tasks where id = v_submission.task_id;

  if not (
    public.is_super_admin()
    or (
      v_task.municipality_id is not null
      and public.has_municipality_role(
        v_task.municipality_id,
        array['municipality_admin', 'municipality_operator']
      )
    )
  ) then
    raise exception 'Bu teslimi inceleme yetkin yok.';
  end if;

  -- Zaten sonuçlanmış teslim yeniden incelenmiyor: ikinci onay ödülü
  -- katlamasa da reddedilmiş bir teslimi sessizce onaylamak geçmişi bozardı.
  if v_submission.status <> 'pending' then
    raise exception 'Bu teslim zaten sonuçlanmış.';
  end if;

  if p_action = 'approve' then
    update public.task_submissions
    set status = 'approved',
        reviewed_by = v_uid,
        reviewed_at = now(),
        reject_reason = null
    where id = p_submission_id
    returning * into v_row;

    perform public.award_task_points(v_row.id);

    perform public.notify(
      v_row.user_id,
      'submission_approved',
      v_task.title || ' onaylandı',
      '+' || v_task.xp || ' XP • +' || v_task.coin || ' Coin kazandın.',
      v_row.id
    );
  else
    update public.task_submissions
    set status = 'rejected',
        reviewed_by = v_uid,
        reviewed_at = now(),
        reject_reason = p_reason
    where id = p_submission_id
    returning * into v_row;

    perform public.notify(
      v_row.user_id,
      'submission_rejected',
      v_task.title || ' reddedildi',
      coalesce(p_reason, 'Teslimin kabul edilmedi. Tekrar deneyebilirsin.'),
      v_row.id
    );
  end if;

  return v_row;
end;
$$;

revoke all on function public.review_submission(uuid, text, text) from public;
revoke all on function public.review_submission(uuid, text, text) from anon;
grant execute on function public.review_submission(uuid, text, text) to authenticated;
