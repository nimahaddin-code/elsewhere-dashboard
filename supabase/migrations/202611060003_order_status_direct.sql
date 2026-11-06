-- Let editors set an order's status directly from the Orders tab: jump ahead
-- (new -> purchased) or step back to fix a mistake. Additive: commerce_update_order
-- is unchanged. Rules kept: cancelled orders are closed (use the cancel RPC), and
-- shipped/completed still require full verified payment plus courier and tracking.
begin;

create or replace function public.commerce_set_order_status(
  p_order_id uuid,
  p_status text,
  p_courier text default null,
  p_tracking text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
  paid numeric;
  next_courier text;
  next_tracking text;
begin
  if not public.commerce_editor() then raise exception 'Akses ditolak: hanya owner/editor'; end if;
  select * into o from public.orders where id = p_order_id for update;
  if o.id is null then raise exception 'Pesanan tidak ditemukan'; end if;
  if o.status = 'cancelled' then raise exception 'Pesanan sudah dibatalkan'; end if;
  if p_status is null or p_status not in ('new','confirmed','purchased','arrived','packed','shipped','completed') then
    raise exception 'Status tidak valid';
  end if;
  -- Null keeps the saved courier/tracking; a value (even '') replaces it.
  next_courier := trim(coalesce(p_courier, o.courier));
  next_tracking := trim(coalesce(p_tracking, o.tracking_number));
  if length(next_courier) > 100 or length(next_tracking) > 200 then raise exception 'Kurir atau resi terlalu panjang'; end if;
  if p_status in ('shipped','completed') then
    select coalesce(sum(amount_idr), 0) into paid from public.order_payments where order_id = o.id and verified_at is not null;
    if paid < o.total_idr then raise exception 'Catat pembayaran sampai lunas sebelum dikirim'; end if;
    if next_courier = '' or next_tracking = '' then raise exception 'Isi kurir dan nomor resi sebelum dikirim'; end if;
  end if;
  update public.orders
  set status = p_status, courier = next_courier, tracking_number = next_tracking, updated_at = now()
  where id = o.id;
end $$;

revoke all on function public.commerce_set_order_status(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.commerce_set_order_status(uuid,text,text,text) to authenticated;

notify pgrst, 'reload schema';
commit;
