-- M37 — art_key'leri D40'ın yeni görsel setine yeniden eşle
--
-- NEDEN ÜZERİNE YAZIYOR (M36b'den farklı olarak):
--
-- M36b yalnız `art_key is null` satırlara dokunuyordu, çünkü dolu olan
-- satırlar geçerli bir görseli işaret ediyordu. D40'ta kaynak sayfa
-- tamamen değişti: art-01..art-20 anahtarları hâlâ GEÇERLİ ama artık
-- BAŞKA fotoğrafları gösteriyor. Örnek: eski art-13 "Ziyaret · şehir
-- turu" idi, yeni art-13 "Sanat · duvar resmi". Yani eski değerleri
-- korumak, her görevin kapağını rastgele bir fotoğrafa bağlamak
-- olurdu. Bu yüzden 33 görevin hepsi başlığa göre yeniden eşleniyor.
--
-- EŞLEME ÖLÇÜTÜ: görevin FİİLEN NE YAPTIRDIĞI. Kategori değil —
-- "Yerel yönetim testini çöz" civic kategorisinde ama görsel olarak bir
-- test/çalışma sahnesi (art-40), şehir manzarası değil.
--
-- KAYNAKTA KARŞILIĞI OLMAYAN TEK GÖREV: "Bisikletle işe/okula git".
-- İki sayfanın 40 karesinde bisiklet yok. En yakın açık hava/hareket
-- sahnesi verildi (art-20, dağ manzarası) ve panelden değiştirilebilir.
--
-- Taslak görev de kapak alıyor: D39'da "Görsel yok" yolunun canlı
-- örneği kalsın diye boş bırakılmıştı, ama dilim "is null olanlara
-- varsayılan ata" diyor. Yol artık `taskArtUrl` null dönüşüyle test
-- ediliyor, canlı satıra gerek yok.

do $$
declare
  v_eslesme constant text[][] := array[
    -- ===================================================== ŞEHİR KATILIMI
    ['Bozuk bir kaldırımı bildir',                 'art-25'], -- duyuru/bildirim
    ['Mahallendeki bir sorunu fotoğrafla',         'art-22'], -- telefonla çekim
    ['Muhtarlığı ziyaret et ve mahalleni sor',     'art-23'], -- grup sohbeti
    ['Takımınla mahalle ihtiyaç haritası çıkarın', 'art-24'], -- el ele takım
    ['Yerel yönetim testini çöz',                  'art-40'], -- laptopta test
    -- ============================================================= KÜLTÜR
    ['Belediye tarih müzesini ziyaret et',         'art-10'], -- müzede heykel
    ['Bir müzeye git ve en sevdiğin eseri anlat',  'art-32'], -- müze salonu
    ['Mahallendeki tarihî yapıyı belgele',         'art-16'], -- antik sütunlar
    ['Şehrinin tarihini test et',                  'art-01'], -- Galata ve şehir
    ['Takımca kültür noktası keşfedin',            'art-13'], -- duvar resmi
    ['Takımınla bir sahne gösterisine katıl',      'art-37'], -- sahne ve kalabalık
    ['Taslak görev (yayında değil)',               'art-01'],
    -- ============================================================= EĞİTİM
    ['Bir kitabı bitir ve özetini yaz',            'art-39'], -- şehirde okuma
    ['Dijital güvenlik testini çöz',               'art-15'], -- kulaklıkla kodlama
    ['Kütüphanede bir saat çalış',                 'art-11'], -- pencere önünde çalışma
    ['Takımınla bir arkadaşınıza ders anlatın',    'art-27'], -- atölye sunumu
    -- ============================================================== ÇEVRE
    ['Bir fidan dik ve takip et',                  'art-06'], -- fidan dikimi
    ['Evinde geri dönüşüm köşesi kur',             'art-36'], -- geri dönüşüm kutuları
    ['Sahil temizliğine katıl',                    'art-07'], -- sahilde atık
    ['Takımınla sahil temizliğine katılın',        'art-07'], -- aynı işin takım sürümü
    ['Sokağındaki çöpleri topla',                  'art-30'], -- parkta/sokakta atık
    ['Takımınla mahalle parkı temizliği',          'art-30'],
    -- ============================================================= SOSYAL
    ['10 arkadaşınla GençLİG bağlantısı paylaş',   'art-28'], -- sosyal medya
    ['50 esnafı ziyaret et ve fotoğrafla',         'art-26'], -- dükkân ziyareti
    ['Bir yaşlı komşunu ziyaret et',               'art-08'], -- kutu/ziyaret
    ['STK buluşması: sahilde fidan dikimi',        'art-34'], -- fidan dikimi (2)
    ['Takımınla hayvan barınağında gönüllü ol',    'art-29'], -- köpek dostluğu
    -- =============================================================== SPOR
    ['Bir parkı ziyaret et',                       'art-02'], -- parkta grup
    ['Bisikletle işe/okula git',                   'art-20'], -- karşılığı yok, en yakın
    ['Günde 8.000 adım yürü',                      'art-21'], -- sahil yolunda yürüyüş
    ['Parkta 7.500 adım at',                       'art-21'],
    ['Sahilde 5 km koş',                           'art-09'], -- sahilde koşu
    ['Takımınla mahalle maçı düzenle',             'art-05']  -- basketbol
  ];
  v_i integer;
  v_toplam integer := 0;
  v_n integer;
  v_kalan integer;
begin
  for v_i in 1 .. array_length(v_eslesme, 1) loop
    update public.tasks
       set art_key = v_eslesme[v_i][2]
     where title = v_eslesme[v_i][1]
       and art_key is distinct from v_eslesme[v_i][2];

    get diagnostics v_n = row_count;
    v_toplam := v_toplam + v_n;
  end loop;

  /*
    Emniyet ağı: listede olmayan ya da sonradan eklenmiş bir görev
    kapaksız kalmasın. Anahtar aralığı da denetleniyor — eski set 20
    anahtarlıydı, yeni set 40; aralık dışı bir değer kartta sessizce
    gradyana düşerdi.
  */
  update public.tasks
     set art_key = 'art-01'
   where art_key is null
      or art_key !~ '^art-(0[1-9]|[1-3][0-9]|40)$';

  get diagnostics v_n = row_count;

  select count(*) into v_kalan
    from public.tasks
   where art_key is null;

  raise notice 'M37: % görev yeniden eşlendi, % görev emniyet ağına düştü, kapaksız kalan %',
    v_toplam, v_n, v_kalan;
end;
$$;
