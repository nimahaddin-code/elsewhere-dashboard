-- Keep existing order references intact; use compact date-based codes for new orders.
alter table public.orders
  alter column order_code set default (
    'EW-' || to_char(current_date, 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4))
  );
