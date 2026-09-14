-- Read-only schema/policy inventory before applying the commerce migration.
-- Export the result for rollback planning; this does not change any data.
select jsonb_pretty(jsonb_build_object(
  'columns', (select jsonb_agg(to_jsonb(c)) from (
    select table_name,column_name,data_type,udt_name,is_nullable,column_default
    from information_schema.columns where table_schema='public'
      and table_name in ('workspace_members','trips','trip_expenses','products','product_variants','product_categories','orders','order_items','order_payments')
    order by table_name,ordinal_position
  ) c),
  'constraints', (select jsonb_agg(to_jsonb(c)) from (
    select r.relname as table_name,c.conname,pg_get_constraintdef(c.oid) as definition
    from pg_constraint c join pg_class r on r.oid=c.conrelid join pg_namespace n on n.oid=r.relnamespace
    where n.nspname='public' and r.relname in ('workspace_members','trips','products','product_variants','orders','order_items','order_payments')
  ) c),
  'policies', (select jsonb_agg(to_jsonb(p)) from pg_policies p where schemaname='public' or (schemaname='storage' and tablename='objects')),
  'grants', (select jsonb_agg(to_jsonb(g)) from information_schema.role_table_grants g where table_schema in ('public','storage') and grantee in ('anon','authenticated')),
  'buckets', (select jsonb_agg(jsonb_build_object('id',id,'public',public)) from storage.buckets where id in ('product-images','order-receipts')),
  'commerce_functions', (select jsonb_agg(p.proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'commerce_%')
)) as migration_preflight;
