-- Panel gösterge fonksiyonları.
--
-- Sayımlar security definer: personel kendi belediyesinin toplamlarını görmeli
-- ama teslim ve rapor satırlarının hepsini tek tek okumak zorunda kalmamalı.
-- Fonksiyonlar yalnızca sayı döndürüyor.

create or replace function public.panel_kpis(p_municipality_id uuid)
returns table (
  active_tasks integer,
  pending_reviews integer,
  approved_submissions integer,
  participants integer,
  reports_new integer,
  reports_in_progress integer,
  reports_resolved integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (
    public.is_super_admin()
    or public.has_municipality_role(
      p_municipality_id,
      array['municipality_admin', 'municipality_operator']
    )
  ) then
    raise exception 'Bu panele erişim yetkin yok.';
  end if;

  return query
  select
    (select count(*)::integer from public.tasks t
      where t.municipality_id = p_municipality_id and t.status = 'active'),
    (select count(*)::integer from public.task_submissions s
      join public.tasks t on t.id = s.task_id
      where t.municipality_id = p_municipality_id and s.status = 'pending'),
    (select count(*)::integer from public.task_submissions s
      join public.tasks t on t.id = s.task_id
      where t.municipality_id = p_municipality_id and s.status = 'approved'),
    (select count(distinct s.user_id)::integer from public.task_submissions s
      join public.tasks t on t.id = s.task_id
      where t.municipality_id = p_municipality_id),
    (select count(*)::integer from public.problem_reports r
      where r.municipality_id = p_municipality_id and r.status = 'new'),
    (select count(*)::integer from public.problem_reports r
      where r.municipality_id = p_municipality_id and r.status in ('reviewing', 'in_progress')),
    (select count(*)::integer from public.problem_reports r
      where r.municipality_id = p_municipality_id and r.status = 'resolved');
end;
$$;

revoke all on function public.panel_kpis(uuid) from public;
revoke all on function public.panel_kpis(uuid) from anon;
grant execute on function public.panel_kpis(uuid) to authenticated;

/*
  Çağıranın personel olduğu belediyeler.
  Panel layout'u hangi belediyenin panelini göstereceğini buradan öğreniyor.
  user_roles RLS'i kendi satırlarını gösterdiği için definer şart değil, ama
  belediye adını da getirebilmek için tek sorguda birleştiriliyor.
*/
create or replace function public.my_municipalities()
returns table (municipality_id uuid, name text, role text)
language sql
stable
set search_path = ''
as $$
  select ur.municipality_id, m.name, ur.role
  from public.user_roles ur
  join public.municipalities m on m.id = ur.municipality_id
  where ur.user_id = (select auth.uid())
    and ur.role in ('municipality_admin', 'municipality_operator')
  order by m.name;
$$;

grant execute on function public.my_municipalities() to authenticated;

/** Süper admin panosu için global sayımlar. */
create or replace function public.admin_kpis()
returns table (
  users_total integer,
  municipalities_total integer,
  tasks_total integer,
  pending_reviews integer,
  reports_total integer,
  reports_open integer,
  redemptions_total integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Bu panele erişim yetkin yok.';
  end if;

  return query
  select
    (select count(*)::integer from public.profiles),
    (select count(*)::integer from public.municipalities),
    (select count(*)::integer from public.tasks),
    (select count(*)::integer from public.task_submissions where status = 'pending'),
    (select count(*)::integer from public.problem_reports),
    (select count(*)::integer from public.problem_reports
      where status in ('new', 'reviewing', 'in_progress')),
    (select count(*)::integer from public.reward_redemptions);
end;
$$;

revoke all on function public.admin_kpis() from public;
revoke all on function public.admin_kpis() from anon;
grant execute on function public.admin_kpis() to authenticated;

/*
  Süper admin kullanıcı listesini görebilmeli.
  profiles üzerinde yalnızca SELECT politikası ekleniyor; yazma hâlâ kapalı,
  kullanıcının kendi satırını düzenleme kuralı değişmedi.
*/
create policy profiles_select_super on public.profiles
  for select to authenticated using (public.is_super_admin());
