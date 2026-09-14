-- Apply after 202609120001_commerce.sql. No live changes until rollout.
begin;
alter table public.product_variants alter column preorder_capacity drop not null;
alter table public.product_variants alter column preorder_capacity drop default;
-- NULL capacity represents unlimited preorder. Zero still means closed when a cap is enabled.
update public.product_variants set sale_mode='preorder',preorder_capacity=null;
update public.trips set name='Malaysia trip',fashion_cargo_per_kg=90000,nonfashion_cargo_per_kg=90000 where country='Malaysia';

create table public.commerce_exchange_rates (
 currency_code text primary key check(currency_code ~ '^[A-Z]{3}$'),
 rate_idr numeric not null check(rate_idr > 0 and rate_idr < 1000000),
 source_updated_at timestamptz not null,
 checked_at timestamptz not null default now(),
 last_error text
);
alter table public.commerce_exchange_rates enable row level security;
revoke all on public.commerce_exchange_rates from public,anon,authenticated;

create function public.commerce_current_rate(p_currency text) returns numeric language sql stable security definer set search_path='' as $$
 select rate_idr from public.commerce_exchange_rates where currency_code=p_currency
 and source_updated_at between now()-interval '48 hours' and now()+interval '5 minutes';
$$;
revoke all on function public.commerce_current_rate(text) from public,anon,authenticated;

create function public.commerce_rate_status(p_currency text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('rate',public.commerce_current_rate(p_currency),'updated_at',r.source_updated_at,
 'checked_at',r.checked_at,'refresh_failed',r.last_error is not null)
 from (select 1) seed left join public.commerce_exchange_rates r on r.currency_code=p_currency;
$$;
revoke all on function public.commerce_rate_status(text) from public,anon,authenticated;
grant execute on function public.commerce_rate_status(text) to anon,authenticated;

-- Only the database job may accept a provider response. Clients cannot submit FX values.
create function public.commerce_accept_rate(p_currency text,p_payload jsonb) returns void language plpgsql security definer set search_path='' as $$
declare r numeric; ts timestamptz;
begin
 if p_currency !~ '^[A-Z]{3}$' or p_payload->>'result' is distinct from 'success' or p_payload->>'base_code' is distinct from p_currency then raise exception 'Invalid rate response'; end if;
 r:=(p_payload->'rates'->>'IDR')::numeric;
 ts:=to_timestamp((p_payload->>'time_last_update_unix')::double precision);
 if r is null or r <= 0 or r >= 1000000 or ts is null or ts not between now()-interval '48 hours' and now()+interval '5 minutes' then raise exception 'Invalid or stale exchange rate'; end if;
 insert into public.commerce_exchange_rates(currency_code,rate_idr,source_updated_at) values(p_currency,r,ts)
 on conflict(currency_code) do update set rate_idr=excluded.rate_idr,source_updated_at=excluded.source_updated_at,checked_at=now(),last_error=null
 where excluded.source_updated_at>=commerce_exchange_rates.source_updated_at;
 update public.trips set exchange_rate_idr=public.commerce_current_rate(p_currency) where currency_code=p_currency;
end $$;
revoke all on function public.commerce_accept_rate(text,jsonb) from public,anon,authenticated;

create function public.commerce_enforce_trip_rate() returns trigger language plpgsql security definer set search_path='' as $$
begin
 new.exchange_rate_idr:=public.commerce_current_rate(new.currency_code); return new;
end $$;
revoke all on function public.commerce_enforce_trip_rate() from public,anon,authenticated;
create trigger commerce_automatic_trip_rate before insert or update of currency_code,exchange_rate_idr on public.trips for each row execute function public.commerce_enforce_trip_rate();

create index commerce_order_phone_created on public.orders(phone,created_at desc);
create index commerce_order_created on public.orders(created_at desc);
create function public.commerce_expire_unpaid_orders() returns integer language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 -- Recheck under each order lock, matching payment/status RPC lock order.
 with candidates as (select id from public.orders where status='new' and created_at < now()-interval '48 hours' for update skip locked)
 update public.orders o set status='cancelled',updated_at=now()
 from candidates c where o.id=c.id and o.status='new'
 and not exists(select 1 from public.order_payments p where p.order_id=o.id);
 get diagnostics n=row_count; return n;
end $$;
revoke all on function public.commerce_expire_unpaid_orders() from public,anon,authenticated;

create or replace function public.commerce_catalogue() returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(item order by approved_at desc), '[]'::jsonb) from (
    select p.approved_at, jsonb_build_object('id',p.id,'name',p.name,'brand',p.brand,'category',p.category,'photo_url',p.photo_url,
      'trip_code',t.code,'trip_name',t.name,'country',t.country,'departure_date',t.departure_date,'return_date',t.return_date,
      'product_variants',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'name',v.name,'sale_mode',v.sale_mode,
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

create or replace function public.commerce_place_order(p_request_id uuid, p_variant_id uuid, p_quantity integer,
 p_expected_price numeric, p_name text, p_phone text, p_address text, p_notes text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v public.product_variants; p public.products; t public.trips; o public.orders;
 price numeric; reserved integer; v_trip text;
begin
 if p_request_id is null then raise exception 'Permintaan tidak valid'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 select * into o from public.orders where request_id=p_request_id;
 if found then return jsonb_build_object('order_code',o.order_code,'total_idr',o.total_idr); end if;
 if p_quantity is null or p_quantity not between 1 and 20 or p_expected_price is null or p_expected_price <= 0
 or p_name is null or length(trim(p_name)) not between 2 and 100 or p_phone is null or p_phone !~ '^[0-9]{9,15}$'
 or p_address is null or length(trim(p_address)) not between 10 and 1000 or length(coalesce(p_notes,'')) > 1000 then
 raise exception 'Lengkapi nama, nomor WhatsApp, alamat, dan jumlah yang valid'; end if;
 -- Normalize the Indonesian local prefix so 08… and 628… share one limit.
 p_phone := case when left(p_phone,1)='0' then '62'||substr(p_phone,2) else p_phone end;
 if length(p_phone)>15 then raise exception 'Nomor WhatsApp tidak valid'; end if;
 -- One shared short transaction lock makes aggregate limits reliable during concurrent submissions.
 perform pg_advisory_xact_lock(hashtextextended('elsewhere-checkout-rate-limit',0));
 if (select count(*) from public.orders where phone=p_phone and created_at>now()-interval '15 minutes')>=3
 or (select count(*) from public.orders where phone=p_phone and created_at>now()-interval '24 hours')>=10 then
 raise exception 'Terlalu banyak pesanan dari nomor ini. Tunggu sebentar atau hubungi WhatsApp Elsewhere'; end if;
 if (select count(*) from public.orders where created_at>now()-interval '1 minute')>=60 then
 raise exception 'Pesanan sedang ramai. Coba lagi dalam satu menit'; end if;
 select pr.trip_code into v_trip from public.products pr join public.product_variants va on va.product_id=pr.id where va.id=p_variant_id;
 select * into t from public.trips where code=v_trip for update;
 select pr.* into p from public.products pr join public.product_variants va on va.product_id=pr.id where va.id=p_variant_id for update of pr;
 select * into v from public.product_variants where id=p_variant_id for update;
 if v.id is null or v.active is not true or p.published is not true or p.status is distinct from 'Ready' or t.status is distinct from 'Open PO' or p.trip_code is distinct from t.code then raise exception 'Produk atau trip sudah tidak menerima pesanan'; end if;
 price := public.commerce_price(v.local_price,v.weight_grams,p.category,p.margin_percent,public.commerce_current_rate(t.currency_code),t.fashion_cargo_per_kg,t.nonfashion_cargo_per_kg);
 if price is null or price <= 0 then raise exception 'Harga belum siap. Hubungi tim Elsewhere'; end if;
 if price <> p_expected_price then raise exception 'Harga berubah. Tutup form dan perbarui katalog sebelum memesan'; end if;
 select coalesce(sum(i.quantity),0) into reserved from public.order_items i join public.orders x on x.id=i.order_id where i.variant_id=v.id and x.status <> 'cancelled';
 if (v.sale_mode='stock' or v.preorder_capacity is not null) and reserved+p_quantity > (case when v.sale_mode='stock' then v.stock else v.preorder_capacity end) then raise exception 'Stok atau kuota tidak mencukupi. Perbarui katalog'; end if;
 insert into public.orders(request_id,trip_code,customer_name,phone,address,notes,total_idr)
 values(p_request_id,t.code,trim(p_name),p_phone,trim(p_address),trim(coalesce(p_notes,'')),price*p_quantity) returning * into o;
 insert into public.order_items(order_id,product_id,variant_id,product_name,variant_name,quantity,unit_price_idr,sale_mode,pricing_snapshot)
 values(o.id,p.id,v.id,p.name,v.name,p_quantity,price,v.sale_mode,
 jsonb_build_object('local_price',v.local_price,'weight_grams',v.weight_grams,'currency',t.currency_code,'exchange_rate_idr',public.commerce_current_rate(t.currency_code),
 'category',p.category,'margin_percent',coalesce(p.margin_percent,case when p.category ~* 'makanan|food|snack|minuman' then 20 else 25 end),
 'fashion_cargo_per_kg',t.fashion_cargo_per_kg,'nonfashion_cargo_per_kg',t.nonfashion_cargo_per_kg));
 return jsonb_build_object('order_code',o.order_code,'total_idr',o.total_idr);
end $$;
revoke all on function public.commerce_place_order(uuid,uuid,integer,numeric,text,text,text,text) from public, anon, authenticated;
grant execute on function public.commerce_place_order(uuid,uuid,integer,numeric,text,text,text,text) to anon, authenticated;


commit;
