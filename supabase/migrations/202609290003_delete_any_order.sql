-- Allow editors to explicitly remove a test or administrative order in any status.
-- Nothing is deleted by this migration; deletion remains one manual RPC call.
begin;

create or replace function public.commerce_delete_order(p_order_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
begin
  if not public.commerce_editor() then
    raise exception 'Akses ditolak: hanya owner/editor';
  end if;

  select * into o from public.orders where id = p_order_id for update;
  if o.id is null then raise exception 'Pesanan tidak ditemukan'; end if;

  delete from public.order_payments where order_id = o.id;
  delete from public.order_items where order_id = o.id;
  delete from public.orders where id = o.id;
end $$;

revoke all on function public.commerce_delete_order(uuid) from public, anon, authenticated;
grant execute on function public.commerce_delete_order(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
