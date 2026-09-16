-- Let customers submit one private payment proof for an active order.
-- The storage path must begin with the order UUID; receipts remain private.
alter table public.order_payments alter column created_by drop not null;

create or replace function public.commerce_public_receipt_path(p_path text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare order_id uuid;
begin
  order_id := split_part(p_path, '/', 1)::uuid;
  return exists (
    select 1 from public.orders
    where id = order_id and status not in ('cancelled', 'completed')
  );
exception when others then
  return false;
end $$;
revoke all on function public.commerce_public_receipt_path(text) from public, authenticated;
grant execute on function public.commerce_public_receipt_path(text) to anon;

drop policy if exists commerce_receipts_anon_guard on storage.objects;
create policy commerce_receipts_anon_insert on storage.objects
  for insert to anon
  with check (
    bucket_id = 'order-receipts'
    and public.commerce_public_receipt_path(name)
  );

create or replace function public.commerce_submit_payment(
  p_request_id uuid,
  p_order_code text,
  p_amount numeric,
  p_reference text,
  p_receipt_path text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare o public.orders; result uuid; booked numeric;
begin
  if p_request_id is null or p_order_code is null or p_receipt_path is null
    or not public.commerce_public_receipt_path(p_receipt_path) then
    raise exception 'Bukti pembayaran tidak valid';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));
  select id into result from public.order_payments where request_id = p_request_id;
  if found then return result; end if;
  select * into o from public.orders where order_code = trim(p_order_code) for update;
  if o.id is null or o.status in ('cancelled', 'completed')
    or split_part(p_receipt_path, '/', 1) <> o.id::text then
    raise exception 'Pesanan tidak dapat menerima bukti pembayaran';
  end if;
  select coalesce(sum(amount_idr), 0) into booked
    from public.order_payments where order_id = o.id;
  if p_amount is null or p_amount <= 0 or p_amount + booked > o.total_idr then
    raise exception 'Nominal melebihi sisa tagihan';
  end if;
  insert into public.order_payments(request_id, order_id, amount_idr, reference, receipt_path, created_by)
  values(p_request_id, o.id, p_amount, trim(coalesce(p_reference, 'QRIS customer')), p_receipt_path, null)
  returning id into result;
  return result;
end $$;
revoke all on function public.commerce_submit_payment(uuid,text,numeric,text,text) from public, authenticated;
grant execute on function public.commerce_submit_payment(uuid,text,numeric,text,text) to anon;

create or replace function public.commerce_order_target(p_order_code text)
returns jsonb language sql security definer set search_path = '' as $$
  select jsonb_build_object('order_id', id, 'order_code', order_code, 'total_idr', total_idr)
  from public.orders where order_code = trim(p_order_code) and status <> 'cancelled';
$$;
revoke all on function public.commerce_order_target(text) from public, authenticated;
grant execute on function public.commerce_order_target(text) to anon;

create or replace function public.commerce_verify_payment(p_payment_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare payment public.order_payments; o public.orders;
begin
  if not public.commerce_editor() then raise exception 'Akses ditolak: hanya owner/editor'; end if;
  select * into payment from public.order_payments where id = p_payment_id;
  select * into o from public.orders where id = payment.order_id for update;
  if o.id is null or o.status = 'cancelled' then raise exception 'Pesanan tidak dapat dibayar'; end if;
  update public.order_payments set verified_at = coalesce(verified_at, now()), verified_by = coalesce(verified_by, auth.uid()) where id = p_payment_id;
  if o.status = 'new' then
    update public.orders set status = 'confirmed', updated_at = now() where id = o.id;
  end if;
end $$;
