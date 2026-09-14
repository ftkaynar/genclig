-- Takım görevlerinde "takımından kaç kişi tamamladı" sayacı.
--
-- security definer olmak zorunda: RLS kullanıcıya yalnızca kendi
-- teslimlerini gösteriyor, dolayısıyla takım arkadaşlarının teslimleri
-- normal sorguyla sayılamıyor (aynı sınıf sorun D07'de ölçülmüştü:
-- gerçek 2 iken görünen 1). Fonksiyon yalnızca sayı döndürüyor, kimin
-- tamamladığını sızdırmıyor.
--
-- Dönem: her görevin kendi period_key'i kullanılıyor; takım bonusu da
-- aynı dönem içinde sayıldığı için ikisi tutarlı kalıyor.

create or replace function public.team_task_progress(p_task_ids uuid[])
returns table (task_id uuid, done integer)
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_team uuid;
begin
  if v_uid is null then
    return;
  end if;

  select team_id into v_team
  from public.team_members where user_id = v_uid;

  if v_team is null then
    return;
  end if;

  return query
  select
    t.id,
    (
      select count(*)::integer
      from public.task_submissions s
      join public.team_members m on m.user_id = s.user_id
      where s.task_id = t.id
        and s.status = 'approved'
        and s.period_key = public.task_period_key(t.type, now())
        and m.team_id = v_team
    )
  from public.tasks t
  where t.id = any(p_task_ids)
    and t.scope = 'team';
end;
$$;

revoke all on function public.team_task_progress(uuid[]) from public;
revoke all on function public.team_task_progress(uuid[]) from anon;
grant execute on function public.team_task_progress(uuid[]) to authenticated;
