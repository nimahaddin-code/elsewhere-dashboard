-- Run once against the existing Elsewhere Supabase project. All changes are transactional.
-- Existing core tables must exist; missing/ incompatible schema fails without partial changes.
begin;

alter table public.trips add column if not exists exchange_rate_idr numeric;
alter table public.trips add constraint commerce_valid_rate check (exchange_rate_idr is null or (exchange_rate_idr > 0 and exchange_rate_idr < 1000000));
alter table public.product_variants add column if not exists sale_mode text not null default 'preorder';
alter table public.product_variants add column if not exists preorder_capacity integer not null default 0;
alter table public.product_variants add constraint commerce_sale_mode check (sale_mode in ('preorder','stock'));
alter table public.product_variants add constraint commerce_capacity check (preorder_capacity >= 0 and stock >= 0);

create function public.commerce_member() returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.workspace_members where lower(email) = lower(auth.jwt()->>'email')
  );
$$;
revoke all on function public.commerce_member() from public, anon, authenticated;
grant execute on function public.commerce_member() to authenticated;

create function public.commerce_editor() returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.workspace_members where lower(email) = lower(auth.jwt()->>'email') and role in ('owner','editor')
  );
$$;
revoke all on function public.commerce_editor() from public, anon, authenticated;
grant execute on function public.commerce_editor() to authenticated;

-- Restrictive guards also constrain any pre-existing permissive policies.
alter table public.workspace_members enable row level security;
revoke all on public.workspace_members from anon, authenticated;
grant select on public.workspace_members to authenticated;
create policy commerce_self_guard on public.workspace_members as restrictive for all to authenticated
  using (lower(email) = lower(auth.jwt()->>'email')) with check (false);
create policy commerce_self_read on public.workspace_members for select to authenticated
  using (lower(email) = lower(auth.jwt()->>'email'));
do $$ declare t text; begin
  foreach t in array array['trips','trip_expenses','products','product_variants','product_categories'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('create policy commerce_member_guard on public.%I as restrictive for all to authenticated using (public.commerce_member()) with check (public.commerce_member())', t);
    execute format('create policy commerce_member_read on public.%I for select to authenticated using (public.commerce_member())', t);
    -- Preserve existing permissive write policies and their created_by checks.
    execute format('create policy commerce_editor_insert_guard on public.%I as restrictive for insert to authenticated with check (public.commerce_editor())', t);
    execute format('create policy commerce_editor_update_guard on public.%I as restrictive for update to authenticated using (public.commerce_editor()) with check (public.commerce_editor())', t);
    execute format('create policy commerce_editor_delete_guard on public.%I as restrictive for delete to authenticated using (public.commerce_editor())', t);
  end loop;
end $$;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  order_code text not null unique default ('EW-' || upper(replace(gen_random_uuid()::text, '-', ''))),
  trip_code text not null references public.trips(code),
  customer_name text not null check (length(customer_name) between 2 and 100),
  phone text not null check (phone ~ '^[0-9]{9,15}$'),
  address text not null check (length(address) between 10 and 1000),
  notes text not null default '' check (length(notes) <= 1000),
  total_idr numeric not null check (total_idr > 0),
  status text not null default 'new' check (status in ('new','confirmed','purchased','arrived','packed','shipped','completed','cancelled')),
  courier text not null default '', tracking_number text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  product_name text not null, variant_name text not null,
  quantity integer not null check (quantity between 1 and 20),
  unit_price_idr numeric not null check (unit_price_idr > 0),
  sale_mode text not null,
  pricing_snapshot jsonb not null
);
create index on public.orders(trip_code, created_at desc);
create index on public.order_items(order_id);
create index on public.order_items(variant_id);
create table public.order_payments (
  id uuid primary key default gen_random_uuid(), request_id uuid not null unique,
  order_id uuid not null references public.orders(id),
  amount_idr numeric not null check (amount_idr > 0 and amount_idr <= 1000000000),
  reference text not null check (length(reference) between 1 and 200),
  receipt_path text,
  verified_at timestamptz, verified_by uuid,
  created_by uuid not null, created_at timestamptz not null default now()
);
create index on public.order_payments(order_id);
do $$ declare t text; begin
  foreach t in array array['orders','order_items','order_payments'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('create policy commerce_read on public.%I for select to authenticated using (public.commerce_member())', t);
  end loop;
end $$;

-- Internal price function; both public catalogue and checkout use exactly this value.
create function public.commerce_price(local_price numeric, grams numeric, category text, margin numeric,
  rate numeric, fashion numeric, other numeric) returns numeric language sql immutable set search_path = '' as $$
  select case when rate > 0 and local_price >= 0 and grams >= 0 and coalesce(margin,0) >= 0 and fashion >= 0 and other >= 0
  then round((local_price * rate + grams / 1000 * case when trim(category) ~* '^(fashion|pakaian|clothing|bags|tas|sepatu|shoes|accessories|aksesoris)$' then fashion else other end)
    * (1 + coalesce(margin, case when category ~* 'makanan|food|snack|minuman' then 20 else 25 end) / 100)) end;
$$;
revoke all on function public.commerce_price(numeric,numeric,text,numeric,numeric,numeric,numeric) from public, anon, authenticated;

create function public.commerce_catalogue() returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(item order by approved_at desc), '[]'::jsonb) from (
    select p.approved_at, jsonb_build_object('id',p.id,'name',p.name,'brand',p.brand,'category',p.category,'photo_url',p.photo_url,
      'trip_code',t.code,'trip_name',t.name,'country',t.country,'departure_date',t.departure_date,'return_date',t.return_date,
      'product_variants',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'name',v.name,'sale_mode',v.sale_mode,
        'available', greatest(0,case when v.sale_mode='stock' then v.stock else v.preorder_capacity end - coalesce((
          select sum(i.quantity) from public.order_items i join public.orders o on o.id=i.order_id where i.variant_id=v.id and o.status <> 'cancelled'),0)),
        'unit_price_idr',public.commerce_price(v.local_price,v.weight_grams,p.category,p.margin_percent,t.exchange_rate_idr,t.fashion_cargo_per_kg,t.nonfashion_cargo_per_kg)) order by v.created_at)
        from public.product_variants v where v.product_id=p.id and v.active),'[]'::jsonb)) item
    from public.products p join public.trips t on t.code=p.trip_code
    where p.published and p.status='Ready' and t.status='Open PO'
  ) products;
$$;
revoke all on function public.commerce_catalogue() from public, anon, authenticated;
grant execute on function public.commerce_catalogue() to anon, authenticated;

create function public.commerce_place_order(p_request_id uuid, p_variant_id uuid, p_quantity integer,
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
 select pr.trip_code into v_trip from public.products pr join public.product_variants va on va.product_id=pr.id where va.id=p_variant_id;
 select * into t from public.trips where code=v_trip for update;
 select pr.* into p from public.products pr join public.product_variants va on va.product_id=pr.id where va.id=p_variant_id for update of pr;
 select * into v from public.product_variants where id=p_variant_id for update;
 if v.id is null or v.active is not true or p.published is not true or p.status is distinct from 'Ready' or t.status is distinct from 'Open PO' or p.trip_code is distinct from t.code then raise exception 'Produk atau trip sudah tidak menerima pesanan'; end if;
 price := public.commerce_price(v.local_price,v.weight_grams,p.category,p.margin_percent,t.exchange_rate_idr,t.fashion_cargo_per_kg,t.nonfashion_cargo_per_kg);
 if price is null or price <= 0 then raise exception 'Harga belum siap. Hubungi tim Elsewhere'; end if;
 if price <> p_expected_price then raise exception 'Harga berubah. Tutup form dan perbarui katalog sebelum memesan'; end if;
 select coalesce(sum(i.quantity),0) into reserved from public.order_items i join public.orders x on x.id=i.order_id where i.variant_id=v.id and x.status <> 'cancelled';
 if reserved+p_quantity > (case when v.sale_mode='stock' then v.stock else v.preorder_capacity end) then raise exception 'Stok atau kuota tidak mencukupi. Perbarui katalog'; end if;
 insert into public.orders(request_id,trip_code,customer_name,phone,address,notes,total_idr)
 values(p_request_id,t.code,trim(p_name),p_phone,trim(p_address),trim(coalesce(p_notes,'')),price*p_quantity) returning * into o;
 insert into public.order_items(order_id,product_id,variant_id,product_name,variant_name,quantity,unit_price_idr,sale_mode,pricing_snapshot)
 values(o.id,p.id,v.id,p.name,v.name,p_quantity,price,v.sale_mode,
 jsonb_build_object('local_price',v.local_price,'weight_grams',v.weight_grams,'currency',t.currency_code,'exchange_rate_idr',t.exchange_rate_idr,
 'category',p.category,'margin_percent',coalesce(p.margin_percent,case when p.category ~* 'makanan|food|snack|minuman' then 20 else 25 end),
 'fashion_cargo_per_kg',t.fashion_cargo_per_kg,'nonfashion_cargo_per_kg',t.nonfashion_cargo_per_kg));
 return jsonb_build_object('order_code',o.order_code,'total_idr',o.total_idr);
end $$;
revoke all on function public.commerce_place_order(uuid,uuid,integer,numeric,text,text,text,text) from public, anon, authenticated;
grant execute on function public.commerce_place_order(uuid,uuid,integer,numeric,text,text,text,text) to anon, authenticated;

create function public.commerce_record_payment(p_request_id uuid,p_order_id uuid,p_amount numeric,p_reference text,p_receipt_path text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare o public.orders; result uuid; booked numeric;
begin
 if not public.commerce_editor() then raise exception 'Akses ditolak: hanya owner/editor'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 select id into result from public.order_payments where request_id=p_request_id; if found then return result; end if;
 select * into o from public.orders where id=p_order_id for update;
 if o.id is null or o.status='cancelled' then raise exception 'Pesanan tidak dapat dibayar'; end if;
 select coalesce(sum(amount_idr),0) into booked from public.order_payments where order_id=o.id;
 if p_amount is null or p_amount <= 0 or p_amount+booked > o.total_idr then raise exception 'Nominal melebihi sisa tagihan (termasuk pembayaran menunggu verifikasi)'; end if;
 if p_receipt_path is not null and p_receipt_path not like o.id::text || '/%' then raise exception 'Bukti pembayaran tidak valid'; end if;
 insert into public.order_payments(request_id,order_id,amount_idr,reference,receipt_path,created_by)
 values(p_request_id,o.id,p_amount,trim(p_reference),p_receipt_path,auth.uid()) returning id into result;
 return result;
end $$;
create function public.commerce_verify_payment(p_payment_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare payment public.order_payments; o public.orders;
begin
 if not public.commerce_editor() then raise exception 'Akses ditolak: hanya owner/editor'; end if;
 select * into payment from public.order_payments where id=p_payment_id;
 select * into o from public.orders where id=payment.order_id for update;
 if o.id is null or o.status='cancelled' then raise exception 'Pesanan tidak dapat dibayar'; end if;
 update public.order_payments set verified_at=coalesce(verified_at,now()),verified_by=coalesce(verified_by,auth.uid()) where id=p_payment_id;
end $$;
create function public.commerce_remove_pending_payment(p_payment_id uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
 if not public.commerce_editor() then raise exception 'Akses ditolak: hanya owner/editor'; end if;
 perform 1 from public.orders where id=(select order_id from public.order_payments where id=p_payment_id) for update;
 delete from public.order_payments where id=p_payment_id and verified_at is null;
 if not found then raise exception 'Hanya pembayaran belum diverifikasi yang dapat dihapus'; end if;
end $$;
create function public.commerce_update_order(p_order_id uuid,p_status text,p_courier text default '',p_tracking text default '')
returns void language plpgsql security definer set search_path = '' as $$
declare o public.orders; paid numeric; seq text[] := array['new','confirmed','purchased','arrived','packed','shipped','completed'];
begin
 if not public.commerce_editor() then raise exception 'Akses ditolak: hanya owner/editor'; end if;
 select * into o from public.orders where id=p_order_id for update;
 if o.id is null or o.status in ('cancelled','completed') then raise exception 'Pesanan sudah ditutup'; end if;
 if p_status is null then raise exception 'Status wajib diisi'; end if;
 if p_status='cancelled' then
   if o.status not in ('new','confirmed') or exists(select 1 from public.order_payments where order_id=o.id) then raise exception 'Pembatalan hanya untuk pesanan belum dibeli dan tanpa catatan pembayaran'; end if;
 elsif p_status <> o.status and (array_position(seq,p_status) is null or array_position(seq,p_status) <> array_position(seq,o.status)+1) then raise exception 'Perbarui status secara berurutan'; end if;
 select coalesce(sum(amount_idr),0) into paid from public.order_payments where order_id=o.id and verified_at is not null;
 if p_status in ('shipped','completed') and (paid < o.total_idr or length(trim(coalesce(p_courier,'')))=0 or length(trim(coalesce(p_tracking,'')))=0) then raise exception 'Lunasi pembayaran dan isi kurir serta resi sebelum dikirim'; end if;
 if length(p_courier)>100 or length(p_tracking)>100 then raise exception 'Kurir atau resi terlalu panjang'; end if;
 update public.orders set status=p_status,courier=trim(coalesce(p_courier,'')),tracking_number=trim(coalesce(p_tracking,'')),updated_at=now() where id=o.id;
end $$;
revoke all on function public.commerce_record_payment(uuid,uuid,numeric,text,text), public.commerce_verify_payment(uuid), public.commerce_remove_pending_payment(uuid), public.commerce_update_order(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.commerce_record_payment(uuid,uuid,numeric,text,text), public.commerce_verify_payment(uuid), public.commerce_remove_pending_payment(uuid), public.commerce_update_order(uuid,text,text,text) to authenticated;

-- Private payment receipts; public product photos retain public delivery.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('order-receipts','order-receipts',false,5242880,array['image/jpeg','image/png','image/webp','application/pdf']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy commerce_storage_guard on storage.objects as restrictive for all to authenticated
 using (bucket_id not in ('order-receipts','product-images') or public.commerce_member())
 with check (bucket_id not in ('order-receipts','product-images') or public.commerce_member());
create policy commerce_receipts_anon_guard on storage.objects as restrictive for all to anon
 using (bucket_id <> 'order-receipts') with check (bucket_id not in ('order-receipts','product-images'));
create policy commerce_storage_members on storage.objects for all to authenticated
 using (bucket_id in ('order-receipts','product-images') and public.commerce_member())
 with check (bucket_id in ('order-receipts','product-images') and public.commerce_member());
create policy commerce_storage_insert_guard on storage.objects as restrictive for insert to authenticated
 with check (bucket_id not in ('order-receipts','product-images') or public.commerce_editor());
create policy commerce_storage_update_guard on storage.objects as restrictive for update to authenticated
 using (bucket_id not in ('order-receipts','product-images') or public.commerce_editor())
 with check (bucket_id not in ('order-receipts','product-images') or public.commerce_editor());
create policy commerce_storage_delete_guard on storage.objects as restrictive for delete to authenticated
 using (bucket_id not in ('order-receipts','product-images') or public.commerce_editor());
commit;
