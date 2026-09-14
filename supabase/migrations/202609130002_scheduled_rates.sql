-- Supabase infrastructure setup, after the commerce migrations.
-- Extension and schedule creation is transactional. No API key or Vercel cron required.
begin;
create schema if not exists extensions;
create extension if not exists http with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.commerce_refresh_rates() returns void
language plpgsql security definer set search_path='' as $$
declare currency text; response record;
begin
 if not pg_try_advisory_xact_lock(hashtextextended('elsewhere-fx-refresh',0)) then return; end if;
 perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS','5000');
 for currency in select distinct currency_code from public.trips where status <> 'Archived' and currency_code ~ '^[A-Z]{3}$' order by currency_code loop
   begin
     select * into response from extensions.http_get('https://open.er-api.com/v6/latest/'||currency);
     if response.status<>200 then raise exception 'Provider HTTP %',response.status; end if;
     perform public.commerce_accept_rate(currency,response.content::jsonb);
   exception when others then
     update public.commerce_exchange_rates set checked_at=now(),last_error=left(sqlerrm,200) where currency_code=currency;
     raise warning 'Exchange rate refresh failed for %: %',currency,sqlerrm;
   end;
 end loop;
end $$;
revoke all on function public.commerce_refresh_rates() from public,anon,authenticated;
select cron.schedule('elsewhere-hourly-rates','7 * * * *','select public.commerce_refresh_rates();');
select cron.schedule('elsewhere-expire-unpaid','17 * * * *','select public.commerce_expire_unpaid_orders();');
select public.commerce_refresh_rates();
-- Fail setup rather than report success with no usable initial rate.
do $$ begin
 if exists(select 1 from public.trips where country='Malaysia' and public.commerce_current_rate(currency_code) is null) then
 raise exception 'Initial Malaysia exchange rate unavailable; retry setup when provider is reachable';
 end if;
end $$;
commit;
