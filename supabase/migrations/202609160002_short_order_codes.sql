-- Keep existing references intact; make new order references short and searchable.
alter table public.orders
  alter column order_code set default (
    'EW-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))
  );