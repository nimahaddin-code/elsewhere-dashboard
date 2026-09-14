-- Apply alongside the matching frontend. Existing order snapshots stay unchanged.
begin;
alter table public.product_variants add column if not exists photo_url text;
create or replace function public.commerce_price(local_price numeric, grams numeric, category text, margin numeric,
  rate numeric, fashion numeric, other numeric) returns numeric language sql immutable set search_path = '' as $$
  select case when rate > 0 and local_price >= 0 and grams >= 0 and coalesce(margin,0) >= 0 and fashion >= 0 and other >= 0
  then ceil((local_price * rate + grams / 1000 * case when trim(category) ~* '^(fashion|pakaian|clothing|bags|tas|sepatu|shoes|accessories|aksesoris)$' then fashion else other end)
    * (1 + coalesce(margin, case when category ~* 'makanan|food|snack|minuman' then 20 else 25 end) / 100) / 1000) * 1000 end;
$$;
revoke all on function public.commerce_price(numeric,numeric,text,numeric,numeric,numeric,numeric) from public, anon, authenticated;

create or replace function public.commerce_catalogue() returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(item order by approved_at desc), '[]'::jsonb) from (
    select p.approved_at, jsonb_build_object('id',p.id,'name',p.name,'brand',p.brand,'category',p.category,'photo_url',p.photo_url,
      'trip_code',t.code,'trip_name',t.name,'country',t.country,'departure_date',t.departure_date,'return_date',t.return_date,
      'product_variants',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'name',v.name,'photo_url',v.photo_url,'sale_mode',v.sale_mode,
        'available', case when v.sale_mode='preorder' and v.preorder_capacity is null then null else greatest(0,case when v.sale_mode='stock' then v.stock else v.preorder_capacity end - coalesce((
          select sum(i.quantity) from public.order_items i join public.orders o on o.id=i.order_id where i.variant_id=v.id and o.status <> 'cancelled'),0)) end,
        'unit_price_idr',public.commerce_price(v.local_price,v.weight_grams,p.category,p.margin_percent,public.commerce_current_rate(t.currency_code),t.fashion_cargo_per_kg,t.nonfashion_cargo_per_kg)) order by v.created_at)
        from public.product_variants v where v.product_id=p.id and v.active),'[]'::jsonb)) item
    from public.products p join public.trips t on t.code=p.trip_code
    where p.published and p.status='Ready' and t.status='Open PO'
  ) products;
$$;
revoke all on function public.commerce_catalogue() from public, anon, authenticated;
grant execute on function public.commerce_catalogue() to anon, authenticated;

commit;
