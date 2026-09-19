-- M34b (D35 FAZ S): her kategoriye en az dört görev.

/*
  ÖLÇÜLEN SORUN: kategori satırları (D35 FAZ G) eklendi ama çoğu kategori
  boştu — altı kategoriden yalnız ikisinde görev vardı ve ekran üç boş
  satırla açılıyordu. Kategori düzeni ancak dolu bir katalogla anlam
  kazanıyor.

  24 görev, kategori başına dört. Özellikler bilinçli olarak DAĞITILDI:
  bireysel/takım, sürekli/anlık, dört doğrulama tipi, üç zorluk. Hepsi
  aynı olsaydı feed tekdüze görünür ve filtreler işe yaramazdı.

  KURUM ADLARI KURGUSAL. Gerçek bir STK, okul ya da belediye adı
  kullanılmadı: tohum verisi demo ortamlarında ve ekran görüntülerinde
  görünüyor, var olan bir kurumu ona sormadan platformda görev açıyor
  gibi göstermek yanlış olurdu.

  IDEMPOTENS: her görev başlığa göre ekleniyor (`where not exists`).
  Migration yeniden koşarsa kopya üretmiyor. Mevcut 14 görevle başlık
  çakışması olmaması için adlar kontrol edildi.

  Global (municipality_id null): tohum görevleri ülke genelinde
  görünmeli; belediyeye bağlamak onları o belediyenin kullanıcılarına
  hapsederdi.
*/

do $$
declare
  v_cat_env smallint;
  v_cat_soc smallint;
  v_cat_spo smallint;
  v_cat_kul smallint;
  v_cat_egi smallint;
  v_cat_civ smallint;
  v_task uuid;
begin
  select id into v_cat_env from public.task_categories where slug = 'environment';
  select id into v_cat_soc from public.task_categories where slug = 'social';
  select id into v_cat_spo from public.task_categories where slug = 'sports';
  select id into v_cat_kul from public.task_categories where slug = 'culture';
  select id into v_cat_egi from public.task_categories where slug = 'education';
  select id into v_cat_civ from public.task_categories where slug = 'civic';

  -- =========================================================== ÇEVRE
  insert into public.tasks (title, description, instructions, type, category_id,
    verification, difficulty, scope, xp, coin, status, municipality_id,
    issuer_name, location_label, art_key, daily_submission_limit)
  select * from (values
    ('Sokağındaki çöpleri topla',
     'Yaşadığın sokakta bir poşet çöp topla ve fotoğrafla.',
     'Dolu poşeti geri dönüşüm kutusunun yanında fotoğrafla.',
     'continuous', v_cat_env, 'photo', 'easy', 'individual', 60, 30, 'active',
     null::uuid, 'Yeşil Adımlar Derneği', null, 'art-07', 2),
    ('Evinde geri dönüşüm köşesi kur',
     'Cam, plastik ve kâğıt için üç ayrı kutu hazırla.',
     'Üç kutuyu birlikte fotoğrafla; etiketleri görünsün.',
     'instant', v_cat_env, 'photo', 'easy', 'individual', 80, 40, 'active',
     null::uuid, null, null, 'art-01', null::integer),
    ('Takımınla mahalle parkı temizliği',
     'Takımınla bir parkta temizlik yapın.',
     'Park girişinde takımca fotoğraf çekin; konumunuz doğrulanacak.',
     'instant', v_cat_env, 'photo_gps', 'medium', 'team', 200, 120, 'active',
     null::uuid, 'Temiz Mahalle İnisiyatifi', 'Mahalle parkı', 'art-13', null::integer),
    ('Bir fidan dik ve takip et',
     'Bir fidan dik, iki hafta boyunca sula.',
     'Dikim anını ve sulama anlarını fotoğrafla.',
     'continuous', v_cat_env, 'photo', 'medium', 'individual', 120, 70, 'active',
     null::uuid, 'Yeşil Adımlar Derneği', null, 'art-12', 1)
  ) as v(title, description, instructions, type, category_id, verification,
         difficulty, scope, xp, coin, status, municipality_id, issuer_name,
         location_label, art_key, daily_submission_limit)
  where not exists (select 1 from public.tasks t where t.title = v.title);

  -- ========================================================== SOSYAL
  insert into public.tasks (title, description, instructions, type, category_id,
    verification, difficulty, scope, xp, coin, status, municipality_id,
    issuer_name, location_label, art_key, daily_submission_limit)
  select * from (values
    ('50 esnafı ziyaret et ve fotoğrafla',
     'Mahallendeki esnafı tanı, kısa sohbet et ve dükkân fotoğrafı çek.',
     'Her ziyarette dükkânın vitrinini fotoğrafla. Esnafın yüzünü izinsiz çekme.',
     'continuous', v_cat_soc, 'photo', 'hard', 'individual', 90, 60, 'active',
     null::uuid, 'Komşuluk Ağı', null, 'art-02', 5),
    ('10 arkadaşınla GençLİG bağlantısı paylaş',
     'Davet kodunu on arkadaşınla paylaş.',
     'Paylaşım ekranının görüntüsünü yükle.',
     'instant', v_cat_soc, 'photo', 'easy', 'individual', 100, 80, 'active',
     null::uuid, null, null, 'art-19', null::integer),
    ('Bir yaşlı komşunu ziyaret et',
     'Bir saat sohbet et, ihtiyacı varsa yardım et.',
     'Ziyaret sonrası kısa bir not ve (izinliyse) fotoğraf yükle.',
     'continuous', v_cat_soc, 'photo', 'medium', 'individual', 110, 70, 'active',
     null::uuid, 'Komşuluk Ağı', null, 'art-18', 1),
    ('Takımınla hayvan barınağında gönüllü ol',
     'Takımınla bir gün barınakta çalışın.',
     'Barınak girişinde takımca fotoğraf çekin.',
     'instant', v_cat_soc, 'photo_gps', 'medium', 'team', 220, 140, 'active',
     null::uuid, 'Patili Dostlar Kulübü', 'Hayvan barınağı', 'art-17', null::integer)
  ) as v(title, description, instructions, type, category_id, verification,
         difficulty, scope, xp, coin, status, municipality_id, issuer_name,
         location_label, art_key, daily_submission_limit)
  where not exists (select 1 from public.tasks t where t.title = v.title);

  -- ============================================================ SPOR
  insert into public.tasks (title, description, instructions, type, category_id,
    verification, difficulty, scope, xp, coin, status, municipality_id,
    issuer_name, location_label, art_key, daily_submission_limit)
  select * from (values
    ('Günde 8.000 adım yürü',
     'Gün içinde en az sekiz bin adım at.',
     'Adım sayarının ekran görüntüsünü yükle.',
     'continuous', v_cat_spo, 'photo', 'easy', 'individual', 70, 35, 'active',
     null::uuid, null, null, 'art-20', 1),
    ('Sahilde 5 km koş',
     'Kesintisiz beş kilometre koş.',
     'Koşu uygulamasının özet ekranını yükle.',
     'continuous', v_cat_spo, 'photo', 'hard', 'individual', 150, 90, 'active',
     null::uuid, 'Şehir Koşu Kulübü', 'Sahil yolu', 'art-03', 1),
    ('Bisikletle işe/okula git',
     'Bir günü bisikletle git gel.',
     'Bisikletini varış noktasında fotoğrafla.',
     'continuous', v_cat_spo, 'photo', 'medium', 'individual', 100, 55, 'active',
     null::uuid, null, null, 'art-11', 2),
    ('Takımınla mahalle maçı düzenle',
     'Takımınla bir maç organize edin.',
     'Saha girişinde takımca fotoğraf çekin.',
     'instant', v_cat_spo, 'photo_gps', 'medium', 'team', 190, 110, 'active',
     null::uuid, 'Şehir Koşu Kulübü', 'Mahalle sahası', 'art-04', null::integer)
  ) as v(title, description, instructions, type, category_id, verification,
         difficulty, scope, xp, coin, status, municipality_id, issuer_name,
         location_label, art_key, daily_submission_limit)
  where not exists (select 1 from public.tasks t where t.title = v.title);

  -- ========================================================== KÜLTÜR
  insert into public.tasks (title, description, instructions, type, category_id,
    verification, difficulty, scope, xp, coin, status, municipality_id,
    issuer_name, location_label, art_key, daily_submission_limit)
  select * from (values
    ('Şehrinin tarihini test et',
     'Şehrin hakkında kısa bir bilgi testi çöz.',
     null,
     'instant', v_cat_kul, 'quiz', 'easy', 'individual', 90, 50, 'active',
     null::uuid, null, null, 'art-14', null::integer),
    ('Bir müzeye git ve en sevdiğin eseri anlat',
     'Müze ziyaretinde bir eseri seç ve neden sevdiğini yaz.',
     'Eserin fotoğrafını (izin veriliyorsa) ve notunu yükle.',
     'instant', v_cat_kul, 'photo_gps', 'medium', 'individual', 130, 80, 'active',
     null::uuid, 'Kent Belleği Derneği', 'Şehir müzesi', 'art-04', null::integer),
    ('Mahallendeki tarihî yapıyı belgele',
     'Tarihî bir yapıyı fotoğrafla ve kısa bilgi yaz.',
     'Yapının cephesini ve varsa tabelasını fotoğrafla.',
     'continuous', v_cat_kul, 'photo_gps', 'medium', 'individual', 120, 70, 'active',
     null::uuid, 'Kent Belleği Derneği', null, 'art-06', 2),
    ('Takımınla bir sahne gösterisine katıl',
     'Takımınla tiyatro, konser ya da gösteri izleyin.',
     'Salon girişinde takımca fotoğraf çekin.',
     'instant', v_cat_kul, 'photo_gps', 'easy', 'team', 170, 100, 'active',
     null::uuid, null, 'Kültür merkezi', 'art-14', null::integer)
  ) as v(title, description, instructions, type, category_id, verification,
         difficulty, scope, xp, coin, status, municipality_id, issuer_name,
         location_label, art_key, daily_submission_limit)
  where not exists (select 1 from public.tasks t where t.title = v.title);

  -- ========================================================== EĞİTİM
  insert into public.tasks (title, description, instructions, type, category_id,
    verification, difficulty, scope, xp, coin, status, municipality_id,
    issuer_name, location_label, art_key, daily_submission_limit)
  select * from (values
    ('Kütüphanede bir saat çalış',
     'Kütüphanede kesintisiz bir saat geçir.',
     'Kütüphanedeyken konumunu doğrula.',
     'continuous', v_cat_egi, 'gps', 'easy', 'individual', 80, 45, 'active',
     null::uuid, null, 'Halk kütüphanesi', 'art-15', 2),
    ('Bir kitabı bitir ve özetini yaz',
     'Bir kitabı bitirip kısa bir özet paylaş.',
     'Kitabın kapağını ve özet notunu yükle.',
     'continuous', v_cat_egi, 'photo', 'medium', 'individual', 140, 85, 'active',
     null::uuid, 'Okuyan Gençlik Kulübü', null, 'art-05', 1),
    ('Dijital güvenlik testini çöz',
     'Güvenli internet kullanımı hakkındaki testi çöz.',
     null,
     'instant', v_cat_egi, 'quiz', 'easy', 'individual', 95, 55, 'active',
     null::uuid, null, null, 'art-16', null::integer),
    ('Takımınla bir arkadaşınıza ders anlatın',
     'Takımca bir konuyu hazırlayıp anlatın.',
     'Ders sonunda takımca fotoğraf çekin.',
     'instant', v_cat_egi, 'photo', 'medium', 'team', 180, 105, 'active',
     null::uuid, 'Okuyan Gençlik Kulübü', null, 'art-05', null::integer)
  ) as v(title, description, instructions, type, category_id, verification,
         difficulty, scope, xp, coin, status, municipality_id, issuer_name,
         location_label, art_key, daily_submission_limit)
  where not exists (select 1 from public.tasks t where t.title = v.title);

  -- ================================================== ŞEHİR KATILIMI
  insert into public.tasks (title, description, instructions, type, category_id,
    verification, difficulty, scope, xp, coin, status, municipality_id,
    issuer_name, location_label, art_key, daily_submission_limit)
  select * from (values
    ('Bozuk bir kaldırımı bildir',
     'Yürürken gördüğün bozuk kaldırımı fotoğrafla.',
     'Sorunun net göründüğü bir fotoğraf çek.',
     'continuous', v_cat_civ, 'photo_gps', 'easy', 'individual', 85, 50, 'active',
     null::uuid, null, null, 'art-06', 3),
    ('Muhtarlığı ziyaret et ve mahalleni sor',
     'Muhtara mahallenin ihtiyaçlarını sor.',
     'Muhtarlık tabelasını fotoğrafla ve notunu yaz.',
     'instant', v_cat_civ, 'photo_gps', 'medium', 'individual', 130, 75, 'active',
     null::uuid, 'Şehrim Benim Platformu', 'Muhtarlık', 'art-06', null::integer),
    ('Yerel yönetim testini çöz',
     'Belediyeler ne yapar? Kısa testi çöz.',
     null,
     'instant', v_cat_civ, 'quiz', 'easy', 'individual', 90, 50, 'active',
     null::uuid, null, null, 'art-15', null::integer),
    ('Takımınla mahalle ihtiyaç haritası çıkarın',
     'Takımınla mahallenizdeki üç ihtiyacı belirleyip belgeleyin.',
     'Her ihtiyaç için bir fotoğraf ve kısa not yükleyin.',
     'instant', v_cat_civ, 'photo_gps', 'hard', 'team', 240, 150, 'active',
     null::uuid, 'Şehrim Benim Platformu', null, 'art-02', null::integer)
  ) as v(title, description, instructions, type, category_id, verification,
         difficulty, scope, xp, coin, status, municipality_id, issuer_name,
         location_label, art_key, daily_submission_limit)
  where not exists (select 1 from public.tasks t where t.title = v.title);

  -- ======================================================= QUIZ SORULARI
  /*
    Quiz görevleri sorusuz kalmamalı: submit_quiz_task soru yoksa
    "Bu görevin soruları henüz hazır değil" hatası veriyor ve görev
    tıklanabilir ama yapılamaz oluyordu.
  */
  select id into v_task from public.tasks where title = 'Şehrinin tarihini test et';
  if v_task is not null and not exists (
    select 1 from public.task_quiz_questions where task_id = v_task
  ) then
    insert into public.task_quiz_questions (task_id, question, options, correct_key, sort)
    values
      (v_task, 'Bir şehrin "kent belleği" ne demektir?',
       '[{"key":"a","text":"Şehrin nüfus sayımı"},{"key":"b","text":"Şehrin ortak hafızası ve mirası"},{"key":"c","text":"Şehrin bütçesi"}]'::jsonb,
       'b', 0),
      (v_task, 'Tarihî yapıları korumak neden önemlidir?',
       '[{"key":"a","text":"Turist geldiği için"},{"key":"b","text":"Sadece yasal zorunluluk"},{"key":"c","text":"Kimlik ve süreklilik duygusu için"}]'::jsonb,
       'c', 1);
  end if;

  select id into v_task from public.tasks where title = 'Dijital güvenlik testini çöz';
  if v_task is not null and not exists (
    select 1 from public.task_quiz_questions where task_id = v_task
  ) then
    insert into public.task_quiz_questions (task_id, question, options, correct_key, sort)
    values
      (v_task, 'Güçlü bir parola nasıl olmalı?',
       '[{"key":"a","text":"Doğum tarihin"},{"key":"b","text":"Uzun, benzersiz ve tahmin edilemez"},{"key":"c","text":"Her yerde aynı"}]'::jsonb,
       'b', 0),
      (v_task, 'Tanımadığın birinden gelen bağlantıya ne yapmalısın?',
       '[{"key":"a","text":"Hemen tıklamalı"},{"key":"b","text":"Arkadaşlarına iletmeli"},{"key":"c","text":"Tıklamamalı ve raporlamalı"}]'::jsonb,
       'c', 1),
      (v_task, 'İki adımlı doğrulama ne işe yarar?',
       '[{"key":"a","text":"Hesabı daha hızlı açar"},{"key":"b","text":"Parola çalınsa bile hesabı korur"},{"key":"c","text":"Reklamları kapatır"}]'::jsonb,
       'b', 2);
  end if;

  select id into v_task from public.tasks where title = 'Yerel yönetim testini çöz';
  if v_task is not null and not exists (
    select 1 from public.task_quiz_questions where task_id = v_task
  ) then
    insert into public.task_quiz_questions (task_id, question, options, correct_key, sort)
    values
      (v_task, 'Belediye meclisi üyeleri nasıl belirlenir?',
       '[{"key":"a","text":"Atama ile"},{"key":"b","text":"Seçimle"},{"key":"c","text":"Kura ile"}]'::jsonb,
       'b', 0),
      (v_task, 'Muhtar hangi düzeyde görev yapar?',
       '[{"key":"a","text":"Mahalle/köy"},{"key":"b","text":"İl"},{"key":"c","text":"Ülke"}]'::jsonb,
       'a', 1);
  end if;

  raise notice 'tohum gorevleri hazir';
end;
$$;
