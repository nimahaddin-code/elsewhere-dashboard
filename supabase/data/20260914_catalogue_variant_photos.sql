-- Source: https://docs.google.com/spreadsheets/d/1j-KXMU8ddKaRckwlmuYUfr4AWbjoL940OKC4VNfONSs/edit
-- 2026-09-14: 15 verified Tudungruffle variant photos, matched against public live IDs.
-- Apply after 202609140001_variant_photos_rounding.sql. Does not change prices, stock or publication.
-- Existing nonblank photos are preserved. Wrong database or changed IDs/SKUs abort the transaction.
begin;
create temporary table elsewhere_sheet_photos (
 variant_id uuid primary key, product_id uuid not null, sku text not null, variant_name text not null, photo_url text not null
) on commit drop;
insert into elsewhere_sheet_photos values
('7ee949a1-9a97-4f99-a725-a183cc9a3f79','f4c218d8-cb9f-4c7b-8cef-922fd71de4a8','CAT-MY-TUDUNG-SHAWL-002','Vintage Floral in Belladonna Modal Shawl','https://cdn.shopify.com/s/files/1/0511/4560/5281/files/BELLADONNA-02.jpg?v=1788506669'),
('b14d9605-63c5-4ef7-92ed-15bea67e1353','f4c218d8-cb9f-4c7b-8cef-922fd71de4a8','CAT-MY-TUDUNG-SHAWL-003','Orchid in Elma Modal Shawl','https://cdn.shopify.com/s/files/1/0511/4560/5281/files/ELMA-2.jpg?v=1787298791'),
('cf4bf1c7-7a25-4fee-9445-2f735492e4e8','f4c218d8-cb9f-4c7b-8cef-922fd71de4a8','CAT-MY-TUDUNG-SHAWL-004','Waterveil in Lattice Chiffon Shawl','https://cdn.shopify.com/s/files/1/0511/4560/5281/files/WATERVEILSH-02.jpg?v=1784882133'),
('6aa9587b-e35e-4331-987a-15caaec9e827','f4c218d8-cb9f-4c7b-8cef-922fd71de4a8','CAT-MY-TUDUNG-SHAWL-005','Calista in Lattice Chiffon Shawl','https://cdn.shopify.com/s/files/1/0511/4560/5281/files/CALISTASH-2.jpg?v=1784882010'),
('0c1bcb7f-7b0f-4ee3-906d-0389a3fbef6f','f4c218d8-cb9f-4c7b-8cef-922fd71de4a8','CAT-MY-TUDUNG-SHAWL-006','Desertbloom in Lattice Chiffon Shawl','https://cdn.shopify.com/s/files/1/0511/4560/5281/files/DESERTBLOOMSH-01.jpg?v=1784882046'),
('fadea061-5e27-4bb3-b54b-2c4c2cef0bdb','f4c218d8-cb9f-4c7b-8cef-922fd71de4a8','CAT-MY-TUDUNG-SHAWL-007','Dreams in Lattice Chiffon Shawl','https://cdn.shopify.com/s/files/1/0511/4560/5281/files/DREAMSSH-01.jpg?v=1784881931'),
('c75deaa8-c46e-4078-9d4d-67128e5115d3','f4c218d8-cb9f-4c7b-8cef-922fd71de4a8','CAT-MY-TUDUNG-SHAWL-001','Vintage Floral in Aster Modal Shawl','https://cdn.shopify.com/s/files/1/0511/4560/5281/files/ASTER-02.jpg?v=1788506710'),
('0c151fd0-5760-42da-b4cf-dfdd8cf5d825','d031c7b8-4584-4e88-83f4-b30b8e4c6094','CAT-MY-TUDUNG-SQUARE-001','Vintage Floral in Gotham','https://cdn.shopify.com/s/files/1/0511/4560/5281/files/GOTHAM-1.jpg?v=1787796608'),
('e9125208-a2e1-448d-ae82-fb536e5ff53f','d031c7b8-4584-4e88-83f4-b30b8e4c6094','CAT-MY-TUDUNG-SQUARE-002','Vintage Floral in Meadow','https://cdn.shopify.com/s/files/1/0511/4560/5281/files/MEADOW-1.jpg?v=1787796555'),
('25ce19df-8b5f-479b-adb7-c7e6ab2b80e1','d031c7b8-4584-4e88-83f4-b30b8e4c6094','CAT-MY-TUDUNG-SQUARE-003','Vintage Floral in Sylvan','https://cdn.shopify.com/s/files/1/0511/4560/5281/files/SYLVAN-1.jpg?v=1787796484'),
('c3de6602-c34e-4e1e-9357-acc3677b896c','d031c7b8-4584-4e88-83f4-b30b8e4c6094','CAT-MY-TUDUNG-SQUARE-004','Orchid In Rayne','https://cdn.shopify.com/s/files/1/0511/4560/5281/files/RAYNE-01.jpg?v=1787300118'),
('2787f9a1-46b2-498a-b8fb-9905677b5f90','d031c7b8-4584-4e88-83f4-b30b8e4c6094','CAT-MY-TUDUNG-SQUARE-005','Orchid In Pansy','https://cdn.shopify.com/s/files/1/0511/4560/5281/files/PANSY-01.jpg?v=1787300143'),
('bbc15ee1-e2b7-4838-a7d8-ec2913631df3','d031c7b8-4584-4e88-83f4-b30b8e4c6094','CAT-MY-TUDUNG-SQUARE-006','Orchid In Viona','https://cdn.shopify.com/s/files/1/0511/4560/5281/files/VIONA-01.jpg?v=1787300035'),
('f6423dd9-ca0f-4ab2-8d1d-6c159f02c3d1','d031c7b8-4584-4e88-83f4-b30b8e4c6094','CAT-MY-TUDUNG-SQUARE-007','Vintage Garden in Rose','https://cdn.shopify.com/s/files/1/0511/4560/5281/files/ROSE.jpg?v=1773125260'),
('cde134c2-e6ae-4410-9660-501540f0d18b','d031c7b8-4584-4e88-83f4-b30b8e4c6094','CAT-MY-TUDUNG-SQUARE-008','Vintage Garden in Eleanor','https://cdn.shopify.com/s/files/1/0511/4560/5281/files/ELEANOR.jpg?v=1764646833');
do $$ begin
 if exists(select 1 from elsewhere_sheet_photos m left join public.product_variants v on v.id=m.variant_id and v.product_id=m.product_id and v.sku=m.sku and v.name=m.variant_name where v.id is null) then
  raise exception 'Photo import aborted: destination variant IDs, names or SKUs differ from the reviewed live catalogue';
 end if;
end $$;
update public.product_variants v set photo_url=m.photo_url,updated_at=now()
from elsewhere_sheet_photos m
where v.id=m.variant_id and nullif(trim(v.photo_url),'') is null;
commit;
