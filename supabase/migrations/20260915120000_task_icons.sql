-- Görev ve kategori ikonları.
--
-- İkon adı lucide-react'teki bileşen adının kebab-case hali ('tree-pine',
-- 'footprints'). Veritabanı yalnızca metni tutuyor; hangi adların geçerli
-- olduğunu arayüzdeki küratörlü liste biliyor. Tanınmayan ad geldiğinde
-- arayüz varsayılana düşüyor, hata vermiyor.
--
-- Neden kolon, ayrı tablo değil: ikon görevin kendi özelliği ve tek bir metin.
-- Ayrı tablo yalnızca join maliyeti getirirdi.

alter table public.tasks add column if not exists icon text;

-- task_categories.icon zaten M6'da tanımlıydı; kolon adlarını lucide
-- karşılıklarına çekiyoruz.
update public.task_categories set icon = 'tree-pine' where slug = 'environment';
update public.task_categories set icon = 'users' where slug = 'social';
update public.task_categories set icon = 'footprints' where slug = 'sports';
update public.task_categories set icon = 'landmark' where slug = 'culture';
update public.task_categories set icon = 'book-open' where slug = 'education';
update public.task_categories set icon = 'megaphone' where slug = 'civic';

-- Seed görevlere kendi ikonları.
update public.tasks set icon = 'camera'
  where id = '0000f1a5-0000-4000-8000-000000000001';
update public.tasks set icon = 'trees'
  where id = '0000f1a5-0000-4000-8000-000000000002';
update public.tasks set icon = 'waves'
  where id = '0000f1a5-0000-4000-8000-000000000003';
update public.tasks set icon = 'footprints'
  where id = '0000f1a5-0000-4000-8000-000000000004';

-- Rozet ikonları da lucide adlarına çekiliyor.
update public.badges set icon = 'sparkles' where slug = 'first-step';
update public.badges set icon = 'tree-pine' where slug = 'green-hero';
update public.badges set icon = 'landmark' where slug = 'culture-explorer';
update public.badges set icon = 'users' where slug = 'social-starter';
update public.badges set icon = 'book-open' where slug = 'knowledge-seeker';
update public.badges set icon = 'megaphone' where slug = 'city-voice';
update public.badges set icon = 'trophy' where slug = 'city-maker';
