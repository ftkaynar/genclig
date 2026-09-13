# GençLİG — Kalıcı Çalışma Kuralları

Bu dosya projenin değişmez çalışma kurallarını tanımlar. Her dilimde geçerlidir.

1. **Tahmin etme, ölç.** Bir şeyin durumunu söylemeden önce komutu çalıştır, çıktıyı göster.

2. **Kapsam dilimle sınırlıdır.** Sadece dilimde yazılanı yap. DOKUNMA listesine dokunma. Kapsam dışı ihtiyaç görürsen yapma, bildir.

3. **Onay kapısı.** Migration, şema değişikliği, silme, üzerine yazma, geri alınamaz her işlem için içeriği göster, onay bekle, onaysız koşma.

4. **Gerekçe koda.** Kritik kararlarda yorum olarak "neden" ve varsa "denenen ve elenen alternatif" yaz.

5. **Çıktı kısa ve düz metin.** Tablo kullanma, uzun içeriği parçala.

6. **Yanıldıysan açıkça söyle ve düzelt.** Savunma ve "zaten öyleydi" gerekçesi yok.

7. **Her dilim sonunda üç blok ver:**
   - Dilim-içi kontrol sonuçları
   - Test listesi (3 satır: ne sınanmalı, hangi durumda kırılır, hangi kanıt gerekir)
   - Kanıt

8. **Tek dilim = tek commit.** Commit mesajı dilim numarasıyla başlar.

9. **Secret'lar repoya ve client'a girmez.** `.env.example` güncel tutulur.

10. **İş mantığı ve puan/coin yazımı asla client'ta olmaz.** RLS + server tarafı.

11. **Adlandırma.** Kod, dosya ve tablo adları İngilizce; kullanıcıya görünen metin ve yorumlar Türkçe.

12. **Stack sabit.** Next.js (App Router, TypeScript strict, Tailwind), pnpm, Supabase (Postgres, Auth, Storage, RLS, Edge Functions), Vercel. Yeni kütüphane eklemeden önce sor.
