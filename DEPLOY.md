# Handoff deploy Elsewhere

## Konfigurasi yang sudah disiapkan

- Supabase: `ousvoecocjewzqnznnlw`.
- WhatsApp Business: `6287890345028`.
- Malaysia trip: kargo fashion dan non-fashion Rp90.000/kg.
- Semua varian existing dan varian baru: preorder tanpa batas. Status trip dan publikasi produk tetap harus diaktifkan oleh owner/editor.
- Kurs otomatis: job Supabase mengecek setiap jam (menit 7), sumber gratis memperbarui data harian. Pesanan lama menyimpan harga saat checkout.

## Sebelum mengubah database

Simpan backup database dari Supabase/pg_dump, termasuk schema, policies dan data. Salin juga objek Storage bila membutuhkan pemulihan file. Jangan commit backup, `.env.local`, database password atau service-role key. Export hasil query JSON saja bukan pengganti backup database penuh.

Perubahan ini belum diterapkan ke database live. Jangan menjalankan migrasi pertama jauh sebelum deploy: migrasi mencabut akses tabel mentah anonymous yang digunakan frontend lama.

## Urutan aktivasi

1. Gabungkan branch integrasi ke repository/branch yang dipakai project Vercel temanmu. Pastikan Vercel mengakses repository tersebut.
2. Siapkan environment Vercel (Production dan Preview jika dipakai):
   - `VITE_SUPABASE_URL=https://ousvoecocjewzqnznnlw.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`: salin publishable key dari Supabase Project Settings → API Keys. Jangan gunakan secret/service-role key.
   - `VITE_WHATSAPP_NUMBER=6287890345028`
3. Gunakan konfigurasi `vercel.json`: build `npm run build:vercel`, output `dist-vercel`, Node 22.13+; jangan pilih preset Next.js. Environment dibaca saat build, jadi rebuild bila berubah.
4. Saat siap deploy, admin Supabase menjalankan file berikut satu per satu dalam urutan ini melalui SQL Editor. Hentikan bila ada error:
   - `supabase/migrations/202609120001_commerce.sql`
   - `supabase/migrations/202609130001_preorder_and_rates.sql`
   - `supabase/migrations/202609130002_scheduled_rates.sql`
   - `supabase/migrations/202609160001_easy_order_codes.sql`
   - `supabase/migrations/202609160002_short_order_codes.sql`
   - `supabase/migrations/202609160003_customer_payment_proof.sql`
   File terakhir mengaktifkan HTTP dan pg_cron, membuat dua jadwal, lalu mengambil kurs pertama. Setup dibatalkan jika kurs Malaysia tidak tersedia; perbaiki penyebab lalu ulangi file terakhir. Jangan mengulangi migrasi yang sudah berhasil.
   Setelah migration selesai, jalankan `NOTIFY pgrst, 'reload schema';` di SQL Editor jika RPC baru masih belum terlihat oleh API.
5. Deploy frontend yang cocok segera setelah migrasi; atur Supabase Auth Site URL ke domain live dan Redirect URLs untuk `/dashboard` agar reset password kembali ke dashboard.
6. Login sebagai owner/editor, pilih Malaysia trip, ubah Planning ke Open PO. Pastikan produk Ready sudah dipublish dan varian aktif dengan harga/berat benar. Migrasi tidak mempublikasikan draft secara otomatis.

## Verifikasi setelah deploy

Di SQL Editor admin:

```sql
select public.commerce_rate_status('MYR');
select jobname, schedule, active from cron.job
where jobname in ('elsewhere-hourly-rates','elsewhere-expire-unpaid');
select j.jobname, d.status, d.return_message, d.start_time
from cron.job_run_details d join cron.job j on j.jobid=d.jobid
where j.jobname like 'elsewhere-%'
order by d.start_time desc limit 10;
```

Rate harus positif, timestamp sumber belum lewat 48 jam dan kedua job aktif. Riwayat job baru muncul setelah jadwal berjalan. Bila refresh gagal, cek peringatan/error provider; refresh bisa dicoba admin dengan `select public.commerce_refresh_rates();`.

Buka `/` tanpa login, pesan varian preorder stok nol, pastikan pesanan muncul di `/dashboard`. Coba ulang permintaan yang sama saat jaringan gagal: tidak boleh membuat duplikat. Catat lalu verifikasi pembayaran; konfirmasi, beli, tiba, kemas, lunasi dan isi kurir/resi sebelum kirim. Gunakan data uji yang bisa direkonsiliasi, jangan menghapus catatan pembayaran terverifikasi. Pastikan akun nonmember tidak bisa melihat pesanan atau receipt.

## Batasan dan rollback

`npm test`, `npm run typecheck`, dan `npm run build:vercel` memverifikasi source. Tes database memakai PGlite dengan auth/storage dan HTTP/cron stand-in; koneksi provider serta ekstensi dan scheduler Supabase tetap perlu diverifikasi live. Tes ini tidak membuktikan konkurensi multi-session PostgreSQL.

Pembatasan pesanan: 3/nomor/15 menit, 10/nomor/24 jam, 60 total/menit. Pesanan baru tanpa catatan pembayaran dibatalkan setelah 48 jam pada jadwal per jam. Ini bukan CAPTCHA. Pembayaran dan resi masih manual, ongkir domestik dikonfirmasi terpisah.

Untuk rollback, hentikan checkout, simpan semua pesanan/pembayaran baru dan rekonsiliasi sebelum memulihkan schema/policies dari backup. Jangan drop tabel transaksi. Frontend lama saja tidak cocok dengan policies baru. Admin dapat menonaktifkan job melalui `cron.unschedule('elsewhere-hourly-rates')` dan `cron.unschedule('elsewhere-expire-unpaid')`; kurs otomatis tidak akan refresh dan checkout berhenti setelah kurs terlalu lama.


## Update 14 September: pencarian, foto varian, pembulatan, profit

Frontend baru menambahkan pencarian/filter katalog dashboard, foto per varian, estimasi profit, dan pembulatan harga jual ke atas ke kelipatan Rp1.000. Contoh Rp123.400 menjadi Rp124.000; harga yang sudah pas Rp124.000 tetap. Modal tetap harga barang × kurs + kargo. Profit per unit adalah harga jual setelah pembulatan dikurangi modal tersebut, belum termasuk biaya operasional, pembayaran dan ongkir domestik.

Untuk database yang sudah memakai seluruh migrasi commerce sebelumnya, jalankan `supabase/migrations/202609140001_variant_photos_rounding.sql` bersamaan dengan frontend ini. Periksa dulu migrasi sebelumnya sudah terpasang; jangan menjalankan bootstrap project kosong pada database existing. Migrasi hanya menambahkan `product_variants.photo_url` bila belum ada serta memperbarui fungsi harga/katalog. Existing URL dan snapshot pesanan tidak ditimpa. Pesanan baru memakai harga bulat dari server; pelanggan yang masih melihat harga lama perlu refresh katalog.

Untuk editor varian dua pilihan dan upload foto varian, jalankan `supabase/migrations/202609150001_variant_options.sql` setelah migrasi di atas. Migrasi ini menambahkan label pilihan pada produk dan nilai pilihan pada varian, lalu memperbarui RPC katalog publik. Snapshot order lama tidak berubah.

Import link foto Excel ke `product_variants.photo_url` dengan mencocokkan ID varian atau SKU yang unik dalam produk, bukan nama produk saja. Jangan overwrite foto existing dengan sel Excel kosong. Pastikan link adalah URL gambar http/https langsung yang bisa diakses publik. Jika importer versi deployed memakai nama kolom lain, petakan kolom itu terlebih dahulu. Link website saja tidak cukup untuk mengetahui isi Excel atau mengisi foto yang belum tersimpan.

Cek sesudah update: pilih dua varian dengan foto berbeda di katalog publik, pastikan foto dan harga ikut berubah; link kosong/rusak kembali ke foto produk. Cek harga dan profit satu varian terhadap modalnya dan pastikan invoice/order lama tetap sama. Informasi modal/profit tidak ditambahkan ke RPC katalog publik.


### Foto spreadsheet yang sudah dicocokkan ke data live

Pada 14 September, katalog publik live berisi 31 produk/61 varian; data ini sudah berbeda dari commit main meskipun frontend masih sama. Setelah migrasi fitur foto di atas, jalankan `supabase/data/20260914_catalogue_variant_photos.sql` untuk mengisi 15 foto Tudungruffle (7 shawl, 8 square). Semua 15 URL merespons sebagai gambar saat diperiksa. Script memeriksa ID produk, ID varian, nama, dan SKU; seluruh transaksi dibatalkan jika tujuan tidak cocok. Foto yang sudah terisi tetap dipertahankan, dan pengulangan tidak membuat duplikat. Script diuji memakai salinan metadata varian live dalam database lokal.

Sumber: https://docs.google.com/spreadsheets/d/1j-KXMU8ddKaRckwlmuYUfr4AWbjoL940OKC4VNfONSs/edit

Update katalog terakhir: manifest foto aktif sekarang berisi **103 baris**, termasuk **15 Milo**. Lima Milo yang dihapus pemilik sudah dikeluarkan dari manifest; daftar penonaktifan ada di `supabase/data/catalogue-removed-items.json`. Cocokkan ID/SKU melalui akses staff sebelum menonaktifkan varian live; jangan hapus riwayat order atau induk Milo yang masih memiliki varian aktif.

Foto pengganti tujuh Blackmores dan 12 varian ukuran Padini ada di `supabase/data/20260914_additional_variant_photos.sql`. Koreksi dua model Padini Style 1 (6 varian ukuran) ada di `supabase/data/20260914_corrected_padini_photos.sql`; foto E6/E7 sekarang berbeda. Jalankan keduanya setelah migrasi fitur foto. Guard ID/SKU/nama dan preservasi foto existing tetap berlaku. Detail sumber dan pemasangan ada di [CATALOGUE-PHOTOS.md](CATALOGUE-PHOTOS.md). Produk makanan dan model baru Padini tetap perlu pencocokan ID/SKU staff untuk import foto; jangan membuat produk duplikat berdasarkan ketidakhadiran di katalog publik.
