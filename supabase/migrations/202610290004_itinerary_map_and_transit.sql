-- Location link and "how to get here" for itinerary stops, seeded from the KL trip planner.
begin;

alter table public.trip_itinerary_stops
  add column map_url text not null default '' check (length(map_url) <= 500),
  add column getting_there text not null default '' check (length(getting_there) <= 300);

create temp table seed_leg on commit drop as
  select * from (values
    (1, 'Pavilion KL', 'https://www.google.com/maps/search/?api=1&query=Pavilion%20Kuala%20Lumpur%2C%20168%20Jalan%20Bukit%20Bintang%2C%2055100%20Kuala%20Lumpur', 'Dari hotel (Travelogue Guest House): jalan kaki 480 m, ±5 menit'),
    (1, 'Don Don Donki (Lot 10)', 'https://www.google.com/maps/search/?api=1&query=Don%20Don%20Donki%20Lot%2010%2C%2050%20Jalan%20Sultan%20Ismail%2C%20Bukit%20Bintang%2C%2055100%20Kuala%20Lumpur', 'Dari Pavilion: jalan kaki ±10 menit (estimasi)'),
    (2, 'Berjaya Times Square', 'https://www.google.com/maps/search/?api=1&query=Berjaya%20Times%20Square%2C%201%20Jalan%20Imbi%2C%2055100%20Kuala%20Lumpur', 'Dari hotel: Monorail Bukit Bintang → Imbi, 1 stop (estimasi RM3), lalu jalan kaki'),
    (2, 'Pavilion KL', 'https://www.google.com/maps/search/?api=1&query=Pavilion%20Kuala%20Lumpur%2C%20168%20Jalan%20Bukit%20Bintang%2C%2055100%20Kuala%20Lumpur', 'Dari Berjaya: Monorail Imbi → Bukit Bintang, 1 stop (estimasi RM3), lalu jalan kaki'),
    (2, 'Petaling Street', 'https://www.google.com/maps/search/?api=1&query=Petaling%20Street%2C%20Chinatown%2C%20Kuala%20Lumpur', 'Dari Pavilion: MRT Bukit Bintang → Pasar Seni, ±5 menit via Merdeka (RM1,30/orang pakai Touch n Go), lalu jalan kaki'),
    (3, 'Haniffa Department Store', 'https://www.google.com/maps/search/?api=1&query=Haniffa%20Department%20Store%2C%201%20Jalan%20Masjid%20India%2C%2050100%20Kuala%20Lumpur', 'Dari hotel: Monorail Bukit Bintang → Medan Tuanku, 3 stop (tarif belum dicek), lalu jalan kaki ±10 menit'),
    (3, 'Muaz', 'https://www.google.com/maps/search/?api=1&query=Muaz%20Textiles%20Masjid%20India%20Kuala%20Lumpur', 'Dari Haniffa: jalan kaki'),
    (3, 'Mydin Jalan Masjid India', 'https://www.google.com/maps/search/?api=1&query=Mydin%20Jalan%20Masjid%20India%2C%2095%20Jalan%20Masjid%20India%2C%20Kuala%20Lumpur', 'Dari Muaz: jalan kaki'),
    (3, 'Petaling Street', 'https://www.google.com/maps/search/?api=1&query=Petaling%20Street%2C%20Chinatown%2C%20Kuala%20Lumpur', 'Dari Mydin: jalan kaki 10-12 menit ke Masjid Jamek LRT, LRT 1 stop ke Pasar Seni (estimasi RM3), lalu jalan kaki'),
    (4, 'Berjaya Times Square', 'https://www.google.com/maps/search/?api=1&query=Berjaya%20Times%20Square%2C%201%20Jalan%20Imbi%2C%2055100%20Kuala%20Lumpur', 'Dari hotel: Monorail Bukit Bintang → Imbi, 1 stop (estimasi RM3), lalu jalan kaki'),
    (4, 'Pavilion KL', 'https://www.google.com/maps/search/?api=1&query=Pavilion%20Kuala%20Lumpur%2C%20168%20Jalan%20Bukit%20Bintang%2C%2055100%20Kuala%20Lumpur', 'Dari Berjaya: Monorail Imbi → Bukit Bintang, 1 stop (estimasi RM3), lalu jalan kaki'),
    (4, 'Don Don Donki (Lot 10)', 'https://www.google.com/maps/search/?api=1&query=Don%20Don%20Donki%20Lot%2010%2C%2050%20Jalan%20Sultan%20Ismail%2C%20Bukit%20Bintang%2C%2055100%20Kuala%20Lumpur', 'Dari Pavilion: jalan kaki ±10 menit (estimasi)'),
    (4, '99 Speedmart', 'https://www.google.com/maps/search/?api=1&query=99%20Speedmart%20Bukit%20Bintang%20Kuala%20Lumpur', 'Dari Lot 10: Grab ke hotel bawa barang (estimasi RM10), lalu jalan kaki ke cabang terdekat'),
    (5, 'OC Express (KLIA2)', 'https://www.google.com/maps/search/?api=1&query=OC%20Express%20KLIA2%20Sepang', 'Dari hotel ke KLIA2: Grab 45-75 menit (RM80-100 hari Minggu siang, estimasi)')
) as v(day, place, map_url, getting_there);

update public.trip_itinerary_stops s
set map_url = v.map_url, getting_there = v.getting_there
from seed_leg v
where s.day = v.day and lower(btrim(s.place)) = lower(v.place)
  and s.trip_code = (
    select code from public.trips
    where country ilike 'malaysia%'
    order by (departure_date = date '2026-11-04') desc nulls last, created_at
    limit 1
  );

commit;
