-- M31: sürekli görev günü 06:00'da başlıyor (Europe/Istanbul).

/*
  Görev günü neden gece yarısında değil 06:00'da başlıyor?

  Sürekli görevler gündelik alışkanlık kurmak için var ("bugün yürü",
  "bugün geri dönüşüm kutusuna at"). Gece yarısı sınırı bu ritmi iki
  yerden bozuyordu:

  1. Gece 00:30'da görev yapan genç, aslında "dünkü" gününü kapatırken
     yeni günün hakkını harcamış oluyordu; sabah kalktığında sayaç zaten
     dolu görünüyordu.
  2. Tamamlanma tiki gece yarısı, kimse bakmazken sıfırlanıyordu. Ritim
     hissi için sıfırlamanın kullanıcının GÖRDÜĞÜ bir anda olması lazım:
     sabah uygulamayı açtığında kart "Tekrar yap" olarak karşılıyor.

  06:00 seçildi çünkü hedef kitlenin (13-25 yaş) uyku aralığının
  dışında kalan en erken makul saat. 04:00 denenip elendi: gece
  çalışan/geç yatan kullanıcı için hâlâ "aynı gün" hissi veriyordu.

  Sınır Europe/Istanbul: sunucu UTC ve sabit kaydırma (now() - 6 saat)
  yaz/kış farkı olmadığı için aynı sonucu verirdi, ama saat dilimi
  açıkça yazılınca kural tek yerden okunuyor ve Türkiye bir gün yaz
  saatine dönerse kendiliğinden doğru kalıyor.
*/
create or replace function public.task_day_start(p_at timestamptz default now())
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select case
    when (p_at at time zone 'Europe/Istanbul')::time >= '06:00'::time then
      (date_trunc('day', p_at at time zone 'Europe/Istanbul') + interval '6 hours')
        at time zone 'Europe/Istanbul'
    else
      (date_trunc('day', p_at at time zone 'Europe/Istanbul')
        - interval '18 hours')
        at time zone 'Europe/Istanbul'
  end;
$$;

comment on function public.task_day_start(timestamptz) is
  'Verilen ana ait görev gününün başlangıcı: Europe/Istanbul 06:00.';

revoke all on function public.task_day_start(timestamptz) from public, anon;
grant execute on function public.task_day_start(timestamptz) to authenticated;

/*
  Günlük teslim sayacı aynı pencereye taşınıyor.

  ÖNCEKİ DURUM: `(created_at at time zone 'Europe/Istanbul')::date =
  bugün` — yani gece yarısı sınırı. Kart 06:00'da sıfırlanıp sayaç
  00:00'da sıfırlansaydı kullanıcı "Tekrar yap" yazan bir karta basıp
  "bugün için yeterince gönderdin" hatası alırdı. İki sınırın aynı
  olması ŞART.

  Reddedilen teslimler sayılmıyor: kullanıcı haksız yere reddedilmişse
  günü kapanmamalı (M20'den beri aynı kural).
*/
create or replace function public.daily_submission_count(
  p_task_id uuid,
  p_user_id uuid
)
returns integer
language sql
security definer
stable
set search_path = ''
as $$
  select count(*)::integer
  from public.task_submissions
  where task_id = p_task_id
    and user_id = p_user_id
    and status <> 'rejected'
    and created_at >= public.task_day_start(now());
$$;

revoke all on function public.daily_submission_count(uuid, uuid) from public, anon;
grant execute on function public.daily_submission_count(uuid, uuid) to authenticated;

/*
  submit_task gövdesi DEĞİŞMİYOR.

  Sürekli görevin günlük sınırı zaten daily_submission_count üzerinden
  okunuyor; pencereyi o fonksiyonda değiştirmek submit_task'ı ve quiz
  yolundaki ikizini (submit_quiz_task) tek hamlede doğru kılıyor.
  150 satırlık iki gövdeyi kopyalayıp yeniden yazmak denendi ve elendi:
  aynı kuralın iki kopyası, ilerde birinin unutulması demekti.
*/
comment on function public.submit_task(uuid, double precision, double precision, text) is
  'Görev teslimi. Sürekli görevde günlük sınır penceresi task_day_start() ile aynı: Europe/Istanbul 06:00.';
