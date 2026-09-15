-- Add optional Shopee-style option dimensions without changing existing order snapshots.
begin;
alter table public.products add column if not exists option1_label text;
alter table public.products add column if not exists option2_label text;
alter table public.product_variants add column if not exists option1_value text;
alter table public.product_variants add column if not exists option2_value text;

create or replace function public.commerce_catalogue() returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(item order by approved_at desc), '[]'::jsonb) from (
    select p.approved_at, jsonb_build_object('id',p.id,'name',p.name,'brand',p.brand,'category',p.category,'photo_url',p.photo_url,
      'option1_label',p.option1_label,'option2_label',p.option2_label,
      'trip_code',t.code,'trip_name',t.name,'country',t.country,'departure_date',t.departure_date,'return_date',t.return_date,
      'product_variants',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'name',v.name,'option1_value',v.option1_value,'option2_value',v.option2_value,'photo_url',v.photo_url,'sale_mode',v.sale_mode,
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
