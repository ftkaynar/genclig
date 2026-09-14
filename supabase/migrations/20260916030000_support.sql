-- Destek merkezi: SSS + destek talepleri.

create table public.faq_items (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject text not null,
  status text not null default 'open'
    check (status in ('open', 'answered', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index support_tickets_user_idx on public.support_tickets (user_id, created_at desc);
create index support_tickets_status_idx on public.support_tickets (status, updated_at desc);

create table public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  -- Mesajı kimin yazdığını gönderenin rolünden değil, yazıldığı andaki
  -- karardan okuyoruz: bir kullanıcı sonradan personel olursa eski
  -- mesajları geriye dönük personel yanıtı görünmemeli.
  is_staff boolean not null default false,
  created_at timestamptz not null default now()
);

create index ticket_messages_ticket_idx on public.ticket_messages (ticket_id, created_at);

-- ---------------------------------------------------------------------------
-- Talep akışı
-- ---------------------------------------------------------------------------

/*
  Talep açma.

  Konu ve ilk mesaj birlikte yazılıyor: iki ayrı çağrı arasında hata olursa
  mesajsız bir talep kalırdı ve personel neyin sorulduğunu göremezdi.
*/
create or replace function public.create_ticket(p_subject text, p_body text)
returns public.support_tickets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_row public.support_tickets;
begin
  if v_uid is null then
    raise exception 'Bu işlem için giriş yapmalısın.';
  end if;

  if p_subject is null or length(trim(p_subject)) < 3 then
    raise exception 'Konu en az 3 karakter olmalı.';
  end if;

  if p_body is null or length(trim(p_body)) < 10 then
    raise exception 'Mesaj en az 10 karakter olmalı.';
  end if;

  -- Açık talep sayısı sınırlı: aynı kullanıcının onlarca açık talebi
  -- personel kuyruğunu kullanılamaz hale getirirdi.
  if (
    select count(*) from public.support_tickets
    where user_id = v_uid and status <> 'closed'
  ) >= 5 then
    raise exception 'Çok fazla açık talebin var. Önce mevcutları kapat.';
  end if;

  insert into public.support_tickets (user_id, subject)
  values (v_uid, trim(p_subject))
  returning * into v_row;

  insert into public.ticket_messages (ticket_id, sender_id, body, is_staff)
  values (v_row.id, v_uid, trim(p_body), false);

  return v_row;
end;
$$;

revoke all on function public.create_ticket(text, text) from public;
revoke all on function public.create_ticket(text, text) from anon;
grant execute on function public.create_ticket(text, text) to authenticated;

/*
  Yanıt.

  Personel yanıtı talebi 'answered' yapıp kullanıcıya bildirim atıyor;
  kullanıcının yanıtı talebi 'open'a döndürüyor (top yeniden personelde).
  Kapalı talebe yazılamıyor — kapanmış bir konuyu yeniden açmak yeni talep
  gerektiriyor, aksi halde eski talepler süresiz canlı kalırdı.
*/
create or replace function public.reply_ticket(p_ticket uuid, p_body text)
returns public.ticket_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_ticket public.support_tickets;
  v_staff boolean := public.is_super_admin();
  v_row public.ticket_messages;
begin
  if v_uid is null then
    raise exception 'Bu işlem için giriş yapmalısın.';
  end if;

  if p_body is null or length(trim(p_body)) < 2 then
    raise exception 'Mesaj boş olamaz.';
  end if;

  select * into v_ticket from public.support_tickets where id = p_ticket;

  if v_ticket.id is null then
    raise exception 'Talep bulunamadı.';
  end if;

  if not v_staff and v_ticket.user_id <> v_uid then
    raise exception 'Bu talebe yanıt verme yetkin yok.';
  end if;

  if v_ticket.status = 'closed' then
    raise exception 'Bu talep kapatılmış.';
  end if;

  insert into public.ticket_messages (ticket_id, sender_id, body, is_staff)
  values (p_ticket, v_uid, trim(p_body), v_staff)
  returning * into v_row;

  update public.support_tickets
  set status = case when v_staff then 'answered' else 'open' end,
      updated_at = now()
  where id = p_ticket;

  if v_staff then
    perform public.notify(
      v_ticket.user_id,
      'support_reply',
      'Destek talebine yanıt geldi',
      v_ticket.subject,
      v_ticket.id
    );
  end if;

  return v_row;
end;
$$;

revoke all on function public.reply_ticket(uuid, text) from public;
revoke all on function public.reply_ticket(uuid, text) from anon;
grant execute on function public.reply_ticket(uuid, text) to authenticated;

create or replace function public.close_ticket(p_ticket uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_ticket public.support_tickets;
begin
  if v_uid is null then
    raise exception 'Bu işlem için giriş yapmalısın.';
  end if;

  select * into v_ticket from public.support_tickets where id = p_ticket;

  if v_ticket.id is null then
    raise exception 'Talep bulunamadı.';
  end if;

  if not public.is_super_admin() and v_ticket.user_id <> v_uid then
    raise exception 'Bu talebi kapatma yetkin yok.';
  end if;

  update public.support_tickets
  set status = 'closed', updated_at = now()
  where id = p_ticket;
end;
$$;

revoke all on function public.close_ticket(uuid) from public;
revoke all on function public.close_ticket(uuid) from anon;
grant execute on function public.close_ticket(uuid) to authenticated;

/*
  Personel kuyruğu.

  security definer: kuyruk kullanıcı adını da gösteriyor ve mesaj sayısını
  hesaplıyor; ikisi de RLS altında tek sorguda toplanamıyordu. Fonksiyon
  süper admin değilse hiçbir şey döndürmüyor.
*/
create or replace function public.list_all_tickets(p_status text default null)
returns table (
  id uuid,
  subject text,
  status text,
  username text,
  message_count integer,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_super_admin() then
    return;
  end if;

  return query
  select
    t.id,
    t.subject,
    t.status,
    p.username::text,
    (select count(*)::integer from public.ticket_messages m where m.ticket_id = t.id),
    t.updated_at
  from public.support_tickets t
  join public.profiles p on p.id = t.user_id
  where p_status is null or t.status = p_status
  order by
    -- Yanıt bekleyenler önce: personelin sırada ne olduğunu görmesi gerek.
    case t.status when 'open' then 0 when 'answered' then 1 else 2 end,
    t.updated_at desc
  limit 200;
end;
$$;

revoke all on function public.list_all_tickets(text) from public;
revoke all on function public.list_all_tickets(text) from anon;
grant execute on function public.list_all_tickets(text) to authenticated;

-- ---------------------------------------------------------------------------
-- SSS seed
-- ---------------------------------------------------------------------------

insert into public.faq_items (question, answer, sort_order)
values
  (
    'XP ve coin nasıl kazanılır?',
    'Görevleri tamamlayarak. Her görevin kartında kazanacağın XP ve coin yazılı. Konum doğrulamalı görevler anında onaylanır; fotoğraflı görevler incelemeye alınır.',
    1
  ),
  (
    'Görevim neden "incelemede" görünüyor?',
    'Fotoğraf isteyen görevler belediye ekibi tarafından kontrol edilir. Onaylandığında puanların hesabına geçer ve bildirim alırsın.',
    2
  ),
  (
    'Seviye nasıl yükselir?',
    'Seviyen topladığın toplam XP''ye göre hesaplanır. Profil sayfandaki halkada bir sonraki seviyeye ne kadar kaldığını görebilirsin.',
    3
  ),
  (
    'Coin''lerimi nerede kullanırım?',
    'Ödüller sayfasından. Yeterli coin''in varsa ödülü alır, sana özel bir kupon kodu verilir; kodu ödülün geçerli olduğu yerde gösterirsin.',
    4
  ),
  (
    'Takım görevleri nasıl çalışır?',
    'Takım görevinde bonusun yazılması için takımından belirtilen sayıda kişinin görevi tamamlaması gerekir. Eşik dolduğunda bonus, görevi tamamlayan tüm üyelere birden yazılır.',
    5
  ),
  (
    'Şehirdeki bir sorunu nasıl bildiririm?',
    '"Şehrin için bildir" ekranından. Sorunun fotoğrafını ve konumunu gönderirsin; belediye ekibi incelediğinde durum değişikliği bildirimi alırsın.',
    6
  )
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.faq_items enable row level security;
alter table public.support_tickets enable row level security;
alter table public.ticket_messages enable row level security;

-- SSS gizli bilgi değil; giriş yapmamış ziyaretçi de okuyabilir.
create policy faq_items_select_public on public.faq_items
  for select to anon, authenticated using (is_active);

create policy faq_items_write_super on public.faq_items
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy support_tickets_select_own on public.support_tickets
  for select to authenticated using (user_id = (select auth.uid()));

create policy support_tickets_select_super on public.support_tickets
  for select to authenticated using (public.is_super_admin());

create policy ticket_messages_select_own on public.ticket_messages
  for select to authenticated using (
    exists (
      select 1 from public.support_tickets t
      where t.id = ticket_messages.ticket_id
        and t.user_id = (select auth.uid())
    )
  );

create policy ticket_messages_select_super on public.ticket_messages
  for select to authenticated using (public.is_super_admin());

/*
  Yazma politikası bilerek yok ve yazma GRANT'i de verilmiyor: talep açmanın
  ve yanıtlamanın tek yolu security definer fonksiyonlar. Durum geçişleri
  (open/answered/closed) ve bildirim orada; client doğrudan insert edebilseydi
  durumu istediği gibi yazabilirdi.
*/
revoke all on public.faq_items from anon, authenticated;
grant select on public.faq_items to anon, authenticated;
grant insert, update, delete on public.faq_items to authenticated;

revoke all on public.support_tickets from anon, authenticated;
grant select on public.support_tickets to authenticated;

revoke all on public.ticket_messages from anon, authenticated;
grant select on public.ticket_messages to authenticated;
