-- M36b — Kapaksız görevlere kart kapağı atama
--
-- SORUN: D38 FAZ GK kontakt sayfasını 20 kart kapağına ayırdı, ama
-- yalnız M34'teki 24 görevin `art_key`'i vardı. İlk migration'dan
-- (20260914000000_tasks.sql) gelen 7 yayındaki görev kapaksız kaldı ve
-- kartları hâlâ yer tutucuyla çiziliyordu: kategori gradyanı + ortada
-- büyük ikon. Kullanıcı bunu "ikon ve çerçeve kapak fotoğrafı olan
-- kartlar" diye bildirdi; doğru tespit.
--
-- NEDEN BU EŞLEME: her kapak, görevin FİİLEN ne yaptırdığına göre
-- seçildi, kategoriye göre değil. Kullanılmamış anahtarlar (art-08,
-- art-09, art-10) anlam tuttuğu yerde tercih edildi ki aynı fotoğraf
-- listede iki kez yan yana düşmesin.
--
-- DENENEN VE ELENEN: sahil temizliğinin takım sürümüne farklı bir
-- kapak vermek denendi (art-08 "dayanışma"). Elendi: ikisi aynı işin
-- bireysel ve takım sürümü; aynı kapak bunu doğru anlatıyor, takım
-- ayrımını kart zaten pembe "TAKIM" kurdelesiyle yapıyor.
--
-- IDEMPOTENT ve YÖNETİCİ SEÇİMİNE DOKUNMAZ: `where art_key is null`.
-- Panelden kapak seçilmiş bir görev bu migration'dan etkilenmez.
--
-- Taslak görev ("Taslak görev (yayında değil)") bilerek kapaksız
-- bırakıldı: "Görsel yok" yolunun canlı bir örneği kalsın.

do $$
declare
  v_eslesme constant text[][] := array[
    -- KÜLTÜR
    ['Belediye tarih müzesini ziyaret et', 'art-14'],  -- müze içi, büst
    ['Takımca kültür noktası keşfedin',    'art-13'],  -- şehir turu, Galata
    -- ÇEVRE (bireysel + takım, aynı iş)
    ['Sahil temizliğine katıl',             'art-07'], -- eldivenli el, atık
    ['Takımınla sahil temizliğine katılın', 'art-07'],
    -- SOSYAL
    ['STK buluşması: sahilde fidan dikimi', 'art-01'], -- grupça fidan dikimi
    -- SPOR
    ['Bir parkı ziyaret et', 'art-09'],                -- park, yeşil alan
    ['Parkta 7.500 adım at', 'art-03']                 -- koşu/hareket
  ];
  v_i integer;
  v_toplam integer := 0;
  v_n integer;
begin
  for v_i in 1 .. array_length(v_eslesme, 1) loop
    update public.tasks
       set art_key = v_eslesme[v_i][2]
     where title = v_eslesme[v_i][1]
       and art_key is null;

    get diagnostics v_n = row_count;
    v_toplam := v_toplam + v_n;
  end loop;

  raise notice 'M36b: % göreve kapak atandı', v_toplam;
end;
$$;
