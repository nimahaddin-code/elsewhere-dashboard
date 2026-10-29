-- Fix for 202610290002: that seed skipped any trip that already had a stop, so the KL plan never loaded
-- when a test stop ("Pavilion") existed. Fill empty placeholder stops and add the missing ones.
-- Stops that already have a note or shops are left untouched.
begin;

create temp table seed_trip on commit drop as
  select code from public.trips
  where country ilike 'malaysia%'
  order by (departure_date = date '2026-11-04') desc nulls last, created_at
  limit 1;

create temp table seed_v on commit drop as
  select * from (values
    (1, 0, 'Pavilion KL', '19:40 · 168 Jln Bukit Bintang · konten: cerita kedatangan, store walk-through. Cek jam buka & lokasi surau.', '[{"id": "20562706-6ec7-46bc-be56-811cde8c391d", "name": "Beauty & skincare", "items": "rak skincare dengan harga di frame", "done": false}, {"id": "bf538dd5-a09e-4efa-8d9a-71b14e6e194f", "name": "Fashion", "items": "rak fashion, close-up kain & ukuran", "done": false}]'::jsonb),
    (1, 1, 'Don Don Donki (Lot 10)', '21:30 · Lot 10, Jln Sultan Ismail · konten. Katanya buka 24 jam, cek lagi (pintu masuk beda siang/malam).', '[{"id": "139668f8-616c-4b62-a7f3-7c7442d800ca", "name": "Snack Jepang", "items": "lorong snack, cek stok yang cepat habis", "done": false}, {"id": "e29c67b8-888f-4e6c-a354-864d0eb64939", "name": "Skincare", "items": "brand & harga di frame", "done": false}]'::jsonb),
    (2, 0, 'Berjaya Times Square', '10:45 · 1 Jln Imbi · konten. Datang setelah 10:30, cek jam buka.', '[{"id": "c7ee2f35-2525-4c80-a349-7b2662c0824a", "name": "Fashion", "items": "walk-through lantai fashion, opsi ukuran & warna", "done": false}, {"id": "7a68cf6a-2282-4bd4-92d6-536d1c1f3328", "name": "Tas", "items": "try-on dengan price tag", "done": false}, {"id": "f4079580-90f8-4a8e-b6ff-06a6ef0b8621", "name": "Vincci", "items": "cek apakah ada outlet di sini", "done": false}]'::jsonb),
    (2, 1, 'Pavilion KL', '14:15 · konten: beauty, skincare, fashion. Sebut nama toko & harga di setiap klip.', '[{"id": "5b856b63-7537-4c13-a370-7e35028d073f", "name": "Beauty & skincare", "items": "harga & brand", "done": false}, {"id": "5f124109-072f-4986-a33a-49996afe3370", "name": "Fashion", "items": "kain & ukuran", "done": false}, {"id": "fb4a5639-c0ab-4fe3-b54a-65896e2f2b55", "name": "Vincci", "items": "cek outlet di Pavilion; sepatu & tas, tag sale", "done": false}]'::jsonb),
    (2, 2, 'Petaling Street', '17:10 · Jln Petaling, Chinatown · konten. Buka Min-Jum 8:00-20:00, Sabtu sampai 22:00.', '[{"id": "6eceb300-896a-4c6a-a0da-5b301e13172d", "name": "Souvenir", "items": "close-up dan cek harga", "done": false}, {"id": "8c5f227d-accf-4b73-9d6b-fcbbb974e902", "name": "Aksesoris", "items": "tawar-menawar & price check", "done": false}]'::jsonb),
    (3, 0, 'Haniffa Department Store', '10:15 · 1 Jln Masjid India · belanja. Buka 10:00-21:30 (listing lama, cek lagi).', '[{"id": "fbd48cc3-79ba-4602-994a-55497c7e51ee", "name": "Oleh-oleh murah", "items": "harga per pcs, bulk pack", "done": false}]'::jsonb),
    (3, 1, 'Muaz', '11:30 · alamat BELUM ketemu, konfirmasi pin di Google Maps dulu. Kalau di tempat lain, pindah ke Hari 4 pagi.', '[{"id": "0dc837da-5ad5-4b21-a056-63c52545740d", "name": "Hijab (grosir)", "items": "tanya minimum order & harga grosir; kain & warna", "done": false}]'::jsonb),
    (3, 2, 'Mydin Jalan Masjid India', '14:30 · 95 Jln Masjid India, 5 lantai. Jumat buka sampai 22:00.', '[{"id": "56fc825d-0dd1-42c2-b381-796ed93e3f7c", "name": "Groceries", "items": "harga & bulk buy", "done": false}, {"id": "7999cbfc-b08d-4e88-892e-f12cedc6e4d9", "name": "Souvenir", "items": "harga tag", "done": false}]'::jsonb),
    (3, 3, 'Petaling Street', '17:25 · belanja. Stall tutup 20:00.', '[{"id": "018611c9-9e18-4335-9fc7-fd37effcbdec", "name": "Souvenir", "items": "belanja sesuai daftar order", "done": false}, {"id": "2846af9d-97c8-43cd-adf0-5c0fdb6f7472", "name": "Aksesoris", "items": "belanja sesuai daftar order", "done": false}]'::jsonb),
    (4, 0, 'Berjaya Times Square', '10:45 · belanja.', '[{"id": "a81a62a0-78da-475d-8711-8d436af47be8", "name": "Fashion", "items": "belanja sesuai daftar order", "done": false}, {"id": "29e23ab3-8141-43cc-9498-03c768783d8f", "name": "Tas", "items": "belanja sesuai daftar order", "done": false}, {"id": "acc7f4bd-4528-49be-896c-61fa3fc94549", "name": "Vincci", "items": "cek outlet", "done": false}]'::jsonb),
    (4, 1, 'Pavilion KL', '14:15 · belanja.', '[{"id": "29c2340c-7071-4ae5-8684-bf3f08c4e286", "name": "Vincci", "items": "sepatu & tas sesuai order", "done": false}, {"id": "05d2bdd2-a248-4bb7-9131-1ae0cd791efc", "name": "Beauty & skincare", "items": "sesuai order", "done": false}]'::jsonb),
    (4, 2, 'Don Don Donki (Lot 10)', '16:45 · belanja. Cek segel & tanggal expired di rak.', '[{"id": "6e79bf24-81ed-43f8-93df-4d7687c2578c", "name": "Snack Jepang", "items": "sesuai order", "done": false}, {"id": "56eac4f8-f05c-4283-877e-d283b4b289b9", "name": "Skincare", "items": "sesuai order", "done": false}]'::jsonb),
    (4, 3, '99 Speedmart', '18:45 · pilih cabang terdekat hotel (cek apakah ''99 Supermarket'' toko yang sama).', '[{"id": "323c914c-ebf2-41c2-bb06-5acb56feba47", "name": "Perlengkapan packing", "items": "lakban, plastik, air mineral", "done": false}]'::jsonb),
    (5, 0, 'OC Express (KLIA2)', '13:40 · belum teridentifikasi, cek dulu apa & di mana. Lewati kalau jadwal mepet.', '[]'::jsonb)
) as v(day, position, place, note, shops);

update public.trip_itinerary_stops s
set place = v.place, note = v.note, shops = v.shops, position = v.position
from seed_trip t, seed_v v
where s.trip_code = t.code and s.day = v.day
  and s.note = '' and s.shops = '[]'::jsonb
  and lower(v.place) like lower(btrim(s.place)) || '%';

insert into public.trip_itinerary_stops (trip_code, day, position, place, note, shops)
select t.code, v.day, v.position, v.place, v.note, v.shops
from seed_trip t cross join seed_v v
where not exists (
  select 1 from public.trip_itinerary_stops s
  where s.trip_code = t.code and s.day = v.day
    and lower(v.place) like lower(btrim(s.place)) || '%'
);

commit;
