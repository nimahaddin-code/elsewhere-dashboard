-- Real per-trip checklist (replaces dashboard dummy tasks) and jastip itinerary.
begin;

create table public.trip_tasks (
  id uuid primary key default gen_random_uuid(),
  trip_code text not null references public.trips(code) on update cascade on delete cascade,
  text text not null check (length(btrim(text)) between 1 and 200),
  tag text not null default 'Lainnya' check (length(tag) between 1 and 40),
  done boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index trip_tasks_trip_idx on public.trip_tasks(trip_code, created_at);

-- One row per place to visit on a given day; `shops` holds the shops/items to explore there:
-- [{"id": "...", "name": "Padini", "items": "tote bag, dress", "done": false}]
create table public.trip_itinerary_stops (
  id uuid primary key default gen_random_uuid(),
  trip_code text not null references public.trips(code) on update cascade on delete cascade,
  day integer not null check (day between 1 and 60),
  position integer not null default 0,
  place text not null check (length(btrim(place)) between 1 and 120),
  note text not null default '' check (length(note) <= 500),
  shops jsonb not null default '[]'::jsonb check (jsonb_typeof(shops) = 'array'),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index trip_itinerary_stops_trip_idx on public.trip_itinerary_stops(trip_code, day, position);

do $$ declare t text; begin
  foreach t in array array['trip_tasks','trip_itinerary_stops'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('create policy commerce_member_read on public.%I for select to authenticated using (public.commerce_member())', t);
    execute format('create policy commerce_editor_insert on public.%I for insert to authenticated with check (public.commerce_editor())', t);
    execute format('create policy commerce_editor_update on public.%I for update to authenticated using (public.commerce_editor()) with check (public.commerce_editor())', t);
    execute format('create policy commerce_editor_delete on public.%I for delete to authenticated using (public.commerce_editor())', t);
  end loop;
end $$;

commit;
