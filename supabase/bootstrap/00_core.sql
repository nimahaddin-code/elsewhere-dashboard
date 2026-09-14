-- New empty Supabase projects only. Do not run against the existing source project.
begin;
create table public.workspace_members (
  email text not null,
  display_name text not null,
  role text default 'editor'::text not null,
  created_at timestamptz default now() not null
);
create table public.workspace_settings (
  id int2 default 1 not null,
  collected_fund int8 default 0 not null,
  target_orders int4 default 50 not null,
  confirmed_orders int4 default 0 not null,
  fashion_cargo_per_kg int8 default 95000 not null,
  nonfashion_cargo_per_kg int8 default 100000 not null,
  minimum_margin_percent numeric default 25 not null,
  updated_at timestamptz default now() not null
);
create table public.trips (
  code text not null,
  name text not null,
  country text not null,
  city text default ''::text not null,
  currency_code text not null,
  currency_symbol text not null,
  departure_date date,
  return_date date,
  status text default 'Planning'::text not null,
  collected_fund int8 default 0 not null,
  target_orders int4 default 50 not null,
  confirmed_orders int4 default 0 not null,
  fashion_cargo_per_kg int8 default 95000 not null,
  nonfashion_cargo_per_kg int8 default 100000 not null,
  minimum_margin_percent numeric default 25 not null,
  created_by uuid,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
create table public.trip_expenses (
  id uuid default gen_random_uuid() not null,
  trip_code text default 'TRIP-001'::text not null,
  category text not null,
  item text not null,
  estimate int8 default 0 not null,
  actual int8 default 0 not null,
  status text default 'Belum dibayar'::text not null,
  created_by uuid,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
create table public.products (
  id uuid default gen_random_uuid() not null,
  product_code text not null,
  name text not null,
  brand text default ''::text not null,
  source_url text default ''::text not null,
  store_location text default ''::text not null,
  category text default 'Fashion'::text not null,
  product_type text default ''::text not null,
  color text default ''::text not null,
  size text default ''::text not null,
  material text default ''::text not null,
  price_thb numeric default 0 not null,
  weight_grams int4 default 0 not null,
  margin_percent numeric,
  photo_url text default ''::text not null,
  notes text default ''::text not null,
  status text default 'Draft'::text not null,
  created_by uuid,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  trip_code text default 'TRIP-001'::text not null,
  local_price numeric default 0 not null,
  published bool default false not null,
  approved_at timestamptz,
  approved_by uuid,
  currency_code text default 'MYR'::text not null,
  currency_symbol text default 'RM'::text not null,
  fashion_cargo_per_kg int8 default 95000 not null,
  nonfashion_cargo_per_kg int8 default 100000 not null
);
create table public.product_variants (
  id uuid default gen_random_uuid() not null,
  product_id uuid not null,
  name text not null,
  sku text default ''::text not null,
  local_price numeric default 0 not null,
  weight_grams int4 default 0 not null,
  stock int4 default 0 not null,
  active bool default true not null,
  created_by uuid,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
create table public.product_categories (
  id uuid default gen_random_uuid() not null,
  name text not null,
  default_margin_percent numeric default 25 not null,
  active bool default true not null,
  created_by uuid,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
alter table public.workspace_members add constraint workspace_members_email_check CHECK ((email = lower(email)));
alter table public.workspace_members add constraint workspace_members_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'editor'::text, 'viewer'::text])));
alter table public.workspace_members add constraint workspace_members_pkey PRIMARY KEY (email);
alter table public.trip_expenses add constraint trip_expenses_estimate_check CHECK ((estimate >= 0));
alter table public.trip_expenses add constraint trip_expenses_actual_check CHECK ((actual >= 0));
alter table public.trip_expenses add constraint trip_expenses_status_check CHECK ((status = ANY (ARRAY['Belum dibayar'::text, 'DP dibayar'::text, 'Sudah dibayar'::text])));
alter table public.trip_expenses add constraint trip_expenses_pkey PRIMARY KEY (id);
alter table public.workspace_settings add constraint workspace_settings_id_check CHECK ((id = 1));
alter table public.workspace_settings add constraint workspace_settings_collected_fund_check CHECK ((collected_fund >= 0));
alter table public.workspace_settings add constraint workspace_settings_target_orders_check CHECK ((target_orders > 0));
alter table public.workspace_settings add constraint workspace_settings_confirmed_orders_check CHECK ((confirmed_orders >= 0));
alter table public.workspace_settings add constraint workspace_settings_fashion_cargo_per_kg_check CHECK ((fashion_cargo_per_kg >= 0));
alter table public.workspace_settings add constraint workspace_settings_nonfashion_cargo_per_kg_check CHECK ((nonfashion_cargo_per_kg >= 0));
alter table public.workspace_settings add constraint workspace_settings_minimum_margin_percent_check CHECK ((minimum_margin_percent >= (0)::numeric));
alter table public.workspace_settings add constraint workspace_settings_pkey PRIMARY KEY (id);
alter table public.products add constraint products_price_thb_check CHECK ((price_thb >= (0)::numeric));
alter table public.products add constraint products_weight_grams_check CHECK ((weight_grams >= 0));
alter table public.products add constraint products_margin_percent_check CHECK (((margin_percent IS NULL) OR (margin_percent >= (0)::numeric)));
alter table public.products add constraint products_status_check CHECK ((status = ANY (ARRAY['Draft'::text, 'Ready'::text, 'Archived'::text])));
alter table public.products add constraint products_pkey PRIMARY KEY (id);
alter table public.products add constraint products_product_code_key UNIQUE (product_code);
alter table public.product_variants add constraint product_variants_local_price_check CHECK ((local_price >= (0)::numeric));
alter table public.trips add constraint trips_status_check CHECK ((status = ANY (ARRAY['Planning'::text, 'Open PO'::text, 'On trip'::text, 'Completed'::text, 'Archived'::text])));
alter table public.trips add constraint trips_collected_fund_check CHECK ((collected_fund >= 0));
alter table public.trips add constraint trips_target_orders_check CHECK ((target_orders > 0));
alter table public.trips add constraint trips_confirmed_orders_check CHECK ((confirmed_orders >= 0));
alter table public.trips add constraint trips_fashion_cargo_per_kg_check CHECK ((fashion_cargo_per_kg >= 0));
alter table public.trips add constraint trips_nonfashion_cargo_per_kg_check CHECK ((nonfashion_cargo_per_kg >= 0));
alter table public.trips add constraint trips_minimum_margin_percent_check CHECK ((minimum_margin_percent >= (0)::numeric));
alter table public.trips add constraint trips_pkey PRIMARY KEY (code);
alter table public.products add constraint products_local_price_check CHECK ((local_price >= (0)::numeric));
alter table public.product_variants add constraint product_variants_weight_grams_check CHECK ((weight_grams >= 0));
alter table public.product_variants add constraint product_variants_stock_check CHECK ((stock >= 0));
alter table public.product_variants add constraint product_variants_pkey PRIMARY KEY (id);
alter table public.products add constraint products_fashion_cargo_per_kg_check CHECK ((fashion_cargo_per_kg >= 0));
alter table public.products add constraint products_nonfashion_cargo_per_kg_check CHECK ((nonfashion_cargo_per_kg >= 0));
alter table public.product_categories add constraint product_categories_default_margin_percent_check CHECK ((default_margin_percent >= (0)::numeric));
alter table public.product_categories add constraint product_categories_pkey PRIMARY KEY (id);
alter table public.product_categories add constraint product_categories_name_key UNIQUE (name);
alter table public.trip_expenses add constraint trip_expenses_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public.products add constraint products_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public.trips add constraint trips_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public.products add constraint products_trip_code_fkey FOREIGN KEY (trip_code) REFERENCES trips(code) ON UPDATE CASCADE ON DELETE RESTRICT;
alter table public.trip_expenses add constraint trip_expenses_trip_code_fkey FOREIGN KEY (trip_code) REFERENCES trips(code) ON UPDATE CASCADE ON DELETE RESTRICT;
alter table public.products add constraint products_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id);
alter table public.product_variants add constraint product_variants_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
alter table public.product_variants add constraint product_variants_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public.product_categories add constraint product_categories_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public.workspace_members enable row level security;
revoke all on public.workspace_members from anon, authenticated;
alter table public.workspace_settings enable row level security;
revoke all on public.workspace_settings from anon, authenticated;
alter table public.trips enable row level security;
revoke all on public.trips from anon, authenticated;
alter table public.trip_expenses enable row level security;
revoke all on public.trip_expenses from anon, authenticated;
alter table public.products enable row level security;
revoke all on public.products from anon, authenticated;
alter table public.product_variants enable row level security;
revoke all on public.product_variants from anon, authenticated;
alter table public.product_categories enable row level security;
revoke all on public.product_categories from anon, authenticated;
commit;
