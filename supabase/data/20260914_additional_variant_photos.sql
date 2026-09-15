-- 2026-09-14: 7 Blackmores + 12 Padini size variants (4 styles).
-- Sources and review holds: catalogue-photo-sources.json and CATALOGUE-PHOTOS.md.
-- Apply after 202609140001_variant_photos_rounding.sql; existing photos preserved.
-- Padini row 8/9/10/11 -> Ladies Style 2/3/4 and Ladies Polo Style 2.
-- Rows 6/7 are held (duplicate photo). Rows 12-14 have no verified live variant IDs.
begin;
create temporary table elsewhere_extra_photos (
 variant_id uuid primary key, product_id uuid not null, sku text not null, variant_name text not null, photo_url text not null
) on commit drop;
insert into elsewhere_extra_photos values
('a9b48826-c97e-4a93-9197-1872d3b72652','471b8efd-5bd5-4967-be84-c4674bd2d193','CAT-MY-BLACKMORES-66559-DEFAULT','Default','https://alpropharmacy.com.my/cdn/shop/files/100150762_LPG2026.jpg?v=1783613758'),
('de68552b-f38a-4eef-a3f4-15101a94d611','d2e2e133-b1d6-4d55-afbc-9ca9be39292f','CAT-MY-BLACKMORES-27121-DEFAULT','Default','https://sunwaymulticare.com.my/cdn/shop/files/Blackmores_Bio_C.png?v=1775807510'),
('286b359a-cc3a-426e-af82-227fb6df7efc','426d3ff7-860f-4918-bc30-1d7f77627612','CAT-MY-BLACKMORES-29199-DEFAULT','Default','https://cdn.shopify.com/s/files/1/0902/4562/8224/files/4_dadacf97-3b62-4997-8887-3894b7a96264.png?v=1788400799'),
('d4a9163a-7ae0-4ee8-9117-d3497bf75427','851e473c-c489-471e-a5b2-695881c3dfd6','CAT-MY-BLACKMORES-14781-DEFAULT','Default','https://www.blackmores.com.my/-/media/project/blackmores-group/my/blackmores_my_2020_glucosamine_1500_30_tabs_100ml_with_code1.png?h=700&iar=0&w=700&hash=8E3D2E33B954F796D1F1523D090BB307'),
('e3616137-84ad-479c-a190-be121f141907','d321fa78-010a-409b-afad-1d80d9155555','CAT-MY-BLACKMORES-70766-DEFAULT','Default','https://htmpharmacy.my/site_media/img/761-00033954_L_1.jpg'),
('9f368f39-3a69-4099-8863-14e4687dde9d','693bb952-3b18-4063-bde3-dff38b61ce63','CAT-MY-BLACKMORES-96499-DEFAULT','Default','https://www.shinepharmacy.com/cdn/shop/files/BLACKMORESCALCIUM_D3120S.png?v=1724061035'),
('003a008c-6ad1-4b91-b883-242707f2e340','6ab3001e-a38b-47cb-92ef-5d51604fe894','CAT-MY-BLACKMORES-92841-DEFAULT','Default','https://alpropharmacy.com.my/cdn/shop/files/00011464_L_1.jpg?v=1775840335'),
('5c631720-9ad9-409f-b70a-5463f89b92de','60cef566-3ee4-4330-b50f-c69ea68ed190','CAT-MY-PADINI-007','PDI Casual Active Sweat Shirt Ladies — Style 2 — S','https://www.padini.com/media/catalog/product/_/r/_r1-top-pi20524291-001-a_btm-pi20524296-002-a.jpg?width=720&height=1080&canvas=720,1080&quality=80&bg-color=255,255,255&fit=bounds'),
('13635787-3c67-43a2-a1bd-9ae36a5b453c','60cef566-3ee4-4330-b50f-c69ea68ed190','CAT-MY-PADINI-008','PDI Casual Active Sweat Shirt Ladies — Style 2 — M','https://www.padini.com/media/catalog/product/_/r/_r1-top-pi20524291-001-a_btm-pi20524296-002-a.jpg?width=720&height=1080&canvas=720,1080&quality=80&bg-color=255,255,255&fit=bounds'),
('7c9b9f8a-293a-4479-b54c-92426402fd32','60cef566-3ee4-4330-b50f-c69ea68ed190','CAT-MY-PADINI-009','PDI Casual Active Sweat Shirt Ladies — Style 2 — L','https://www.padini.com/media/catalog/product/_/r/_r1-top-pi20524291-001-a_btm-pi20524296-002-a.jpg?width=720&height=1080&canvas=720,1080&quality=80&bg-color=255,255,255&fit=bounds'),
('e5c144ba-93c2-4d6a-8f3c-bd5306c28550','60cef566-3ee4-4330-b50f-c69ea68ed190','CAT-MY-PADINI-010','PDI Casual Active Sweat Shirt Ladies — Style 3 — S','https://www.padini.com/media/catalog/product/_/r/_r1-top-pi20514961-001-a_btm-pi20519086-001-a.jpg?width=720&height=1080&canvas=720,1080&quality=80&bg-color=255,255,255&fit=bounds'),
('d6483cde-70d3-40b9-a566-607cced16541','60cef566-3ee4-4330-b50f-c69ea68ed190','CAT-MY-PADINI-011','PDI Casual Active Sweat Shirt Ladies — Style 3 — M','https://www.padini.com/media/catalog/product/_/r/_r1-top-pi20514961-001-a_btm-pi20519086-001-a.jpg?width=720&height=1080&canvas=720,1080&quality=80&bg-color=255,255,255&fit=bounds'),
('3e44edd7-99b0-4d7d-93ad-087866dcbaf7','60cef566-3ee4-4330-b50f-c69ea68ed190','CAT-MY-PADINI-012','PDI Casual Active Sweat Shirt Ladies — Style 3 — L','https://www.padini.com/media/catalog/product/_/r/_r1-top-pi20514961-001-a_btm-pi20519086-001-a.jpg?width=720&height=1080&canvas=720,1080&quality=80&bg-color=255,255,255&fit=bounds'),
('096a85d2-3678-407b-8b86-b6dc83cc5fef','60cef566-3ee4-4330-b50f-c69ea68ed190','CAT-MY-PADINI-013','PDI Casual Active Sweat Shirt Ladies — Style 4 — S','https://www.padini.com/media/catalog/product/_/r/_r1-top-pi20524326-001-a_btm-pi20524295-003-a.jpg?width=720&height=1080&canvas=720,1080&quality=80&bg-color=255,255,255&fit=bounds'),
('9d82a3d9-077d-499a-b21f-255694cab403','60cef566-3ee4-4330-b50f-c69ea68ed190','CAT-MY-PADINI-014','PDI Casual Active Sweat Shirt Ladies — Style 4 — M','https://www.padini.com/media/catalog/product/_/r/_r1-top-pi20524326-001-a_btm-pi20524295-003-a.jpg?width=720&height=1080&canvas=720,1080&quality=80&bg-color=255,255,255&fit=bounds'),
('67ffa5cc-8f41-4d30-9191-212f6b728af0','60cef566-3ee4-4330-b50f-c69ea68ed190','CAT-MY-PADINI-015','PDI Casual Active Sweat Shirt Ladies — Style 4 — L','https://www.padini.com/media/catalog/product/_/r/_r1-top-pi20524326-001-a_btm-pi20524295-003-a.jpg?width=720&height=1080&canvas=720,1080&quality=80&bg-color=255,255,255&fit=bounds'),
('9278bd69-2f21-4d32-82c3-dd41ef260e9f','60cef566-3ee4-4330-b50f-c69ea68ed190','CAT-MY-PADINI-016','PDI Casual Active Sweat Shirt Ladies Polo — Style 2 — S','https://www.padini.com/media/catalog/product/_/r/_r1-top-pi20526035-001-a_btm-pi20526209-001-a.jpg?width=720&height=1080&canvas=720,1080&quality=80&bg-color=255,255,255&fit=bounds'),
('dd662a40-9474-4dd3-bfc3-60b47a02d213','60cef566-3ee4-4330-b50f-c69ea68ed190','CAT-MY-PADINI-017','PDI Casual Active Sweat Shirt Ladies Polo — Style 2 — M','https://www.padini.com/media/catalog/product/_/r/_r1-top-pi20526035-001-a_btm-pi20526209-001-a.jpg?width=720&height=1080&canvas=720,1080&quality=80&bg-color=255,255,255&fit=bounds'),
('2a282e58-052d-4f84-9a77-35d4bff70dc5','60cef566-3ee4-4330-b50f-c69ea68ed190','CAT-MY-PADINI-018','PDI Casual Active Sweat Shirt Ladies Polo — Style 2 — L','https://www.padini.com/media/catalog/product/_/r/_r1-top-pi20526035-001-a_btm-pi20526209-001-a.jpg?width=720&height=1080&canvas=720,1080&quality=80&bg-color=255,255,255&fit=bounds');
do $$ begin
 if exists(select 1 from elsewhere_extra_photos m left join public.product_variants v on v.id=m.variant_id and v.product_id=m.product_id and v.sku=m.sku and v.name=m.variant_name where v.id is null) then
  raise exception 'Photo import aborted: destination variant IDs, names or SKUs differ from the reviewed live catalogue';
 end if;
end $$;
update public.product_variants v set photo_url=m.photo_url,updated_at=now()
from elsewhere_extra_photos m
where v.id=m.variant_id and nullif(trim(v.photo_url),'') is null;
commit;
