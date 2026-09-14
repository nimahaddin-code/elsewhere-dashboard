-- Corrected spreadsheet E6/E7: Ladies Polo Style 1 and Ladies Style 1, S/M/L.
-- Additive, existing photos preserved, exact ID/SKU/name guards.
begin;
create temporary table elsewhere_padini_corrected_photos (
 variant_id uuid primary key, product_id uuid not null, sku text not null, variant_name text not null, photo_url text not null
) on commit drop;
insert into elsewhere_padini_corrected_photos values
('fe4940a1-9a93-49dd-9f2a-dbb4fc0674f1','60cef566-3ee4-4330-b50f-c69ea68ed190','CAT-MY-PADINI-001','PDI Casual Active Sweat Shirt Ladies Polo — Style 1 — S','https://www.padini.com/media/catalog/product/_/r/_r1-top-pi20526036-001-a_btm-pi20526208-001-a.jpg?width=720&height=1080&canvas=720,1080&quality=80&bg-color=255,255,255&fit=bounds'),
('27ba971b-d3ba-43e0-8b19-df88259bdd09','60cef566-3ee4-4330-b50f-c69ea68ed190','CAT-MY-PADINI-003','PDI Casual Active Sweat Shirt Ladies Polo — Style 1 — L','https://www.padini.com/media/catalog/product/_/r/_r1-top-pi20526036-001-a_btm-pi20526208-001-a.jpg?width=720&height=1080&canvas=720,1080&quality=80&bg-color=255,255,255&fit=bounds'),
('ebdbe4d9-ec8c-4d4e-b4f0-d06f05320dc9','60cef566-3ee4-4330-b50f-c69ea68ed190','CAT-MY-PADINI-004','PDI Casual Active Sweat Shirt Ladies — Style 1 — S','https://www.padini.com/media/catalog/product/_/r/_r1-top-pi20514962-001-a_btm-pi20519086-002-a.jpg?width=720&height=1080&canvas=720,1080&quality=80&bg-color=255,255,255&fit=bounds'),
('8dd090da-b95e-4ef9-b4d2-a4cbbc2d8662','60cef566-3ee4-4330-b50f-c69ea68ed190','CAT-MY-PADINI-005','PDI Casual Active Sweat Shirt Ladies — Style 1 — M','https://www.padini.com/media/catalog/product/_/r/_r1-top-pi20514962-001-a_btm-pi20519086-002-a.jpg?width=720&height=1080&canvas=720,1080&quality=80&bg-color=255,255,255&fit=bounds'),
('902e77ae-1689-4847-89cd-0c701df3248a','60cef566-3ee4-4330-b50f-c69ea68ed190','CAT-MY-PADINI-006','PDI Casual Active Sweat Shirt Ladies — Style 1 — L','https://www.padini.com/media/catalog/product/_/r/_r1-top-pi20514962-001-a_btm-pi20519086-002-a.jpg?width=720&height=1080&canvas=720,1080&quality=80&bg-color=255,255,255&fit=bounds'),
('7482a917-c5c4-4ea1-a132-22dac4bf9d3a','60cef566-3ee4-4330-b50f-c69ea68ed190','CAT-MY-PADINI-002','PDI Casual Active Sweat Shirt Ladies Polo — Style 1 — M','https://www.padini.com/media/catalog/product/_/r/_r1-top-pi20526036-001-a_btm-pi20526208-001-a.jpg?width=720&height=1080&canvas=720,1080&quality=80&bg-color=255,255,255&fit=bounds');
do $$ begin
 if exists(select 1 from elsewhere_padini_corrected_photos m left join public.product_variants v on v.id=m.variant_id and v.product_id=m.product_id and v.sku=m.sku and v.name=m.variant_name where v.id is null) then
  raise exception 'Photo import aborted: destination variant IDs, names or SKUs differ from the reviewed live catalogue';
 end if;
end $$;
update public.product_variants v set photo_url=m.photo_url,updated_at=now()
from elsewhere_padini_corrected_photos m
where v.id=m.variant_id and nullif(trim(v.photo_url),'') is null;
commit;
