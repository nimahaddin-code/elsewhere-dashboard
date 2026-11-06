-- Staff-entered orders for items priced on the spot (not in the catalogue).
-- Additive: one new editor-only RPC. Manual items have no product/variant link,
-- so they never reserve catalogue stock or capacity. The order then follows the
-- normal status, payment and shipping flow in the Orders tab.
begin;

create or replace function public.commerce_place_manual_order(
  p_request_id uuid,
  p_trip_code text,
  p_items jsonb,
  p_name text,
  p_phone text,
  p_address text default '',
  p_notes text default ''
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  item record;
  o public.orders;
  order_total numeric := 0;
  item_count integer;
begin
  if not public.commerce_editor() then
    raise exception 'Akses ditolak: hanya owner/editor';
  end if;
  if p_request_id is null then raise exception 'Permintaan tidak valid'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));
  select * into o from public.orders where request_id = p_request_id;
  if found then
    return jsonb_build_object('order_id', o.id, 'order_code', o.order_code, 'total_idr', o.total_idr);
  end if;

  if not exists (select 1 from public.trips where code = p_trip_code) then
    raise exception 'Trip tidak ditemukan';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Daftar produk tidak valid';
  end if;
  item_count := jsonb_array_length(p_items);
  p_phone := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  p_phone := case when left(p_phone, 1) = '0' then '62' || substr(p_phone, 2) else p_phone end;
  p_address := trim(coalesce(p_address, ''));
  if p_address = '' then p_address := 'Alamat menyusul'; end if;
  if item_count not between 1 and 50
    or p_name is null or length(trim(p_name)) not between 2 and 100
    or p_phone !~ '^[0-9]{9,15}$'
    or length(p_address) not between 10 and 1000
    or length(coalesce(p_notes, '')) > 1000 then
    raise exception 'Lengkapi nama, nomor WhatsApp, dan produk yang valid';
  end if;

  for item in
    select trim(coalesce(value->>'name', '')) as name,
           (value->>'quantity')::numeric as quantity,
           (value->>'unit_price')::numeric as unit_price
    from jsonb_array_elements(p_items)
  loop
    if length(item.name) not between 1 and 200
      or item.quantity is null or item.quantity <> trunc(item.quantity) or item.quantity not between 1 and 20
      or item.unit_price is null or item.unit_price <= 0 or item.unit_price > 1000000000 then
      raise exception 'Nama, jumlah (1-20), atau harga produk tidak valid';
    end if;
    order_total := order_total + item.quantity * item.unit_price;
  end loop;

  insert into public.orders(request_id, trip_code, customer_name, phone, address, notes, total_idr)
  values(p_request_id, p_trip_code, trim(p_name), p_phone, p_address, coalesce(p_notes, ''), order_total)
  returning * into o;

  insert into public.order_items(order_id, product_id, variant_id, product_name, variant_name, quantity, unit_price_idr, sale_mode, pricing_snapshot)
  select o.id, null, null, trim(value->>'name'), 'Manual', (value->>'quantity')::integer, (value->>'unit_price')::numeric, 'manual',
         jsonb_build_object('source', 'manual') || coalesce(value->'snapshot', '{}'::jsonb)
  from jsonb_array_elements(p_items);

  return jsonb_build_object('order_id', o.id, 'order_code', o.order_code, 'total_idr', o.total_idr);
end $$;

revoke all on function public.commerce_place_manual_order(uuid,text,jsonb,text,text,text,text) from public, anon, authenticated;
grant execute on function public.commerce_place_manual_order(uuid,text,jsonb,text,text,text,text) to authenticated;

notify pgrst, 'reload schema';
commit;
