-- Per-place content checklist (shots/ideas to film or photograph), filled in by the content helper.
begin;

alter table public.trip_itinerary_stops
  add column content jsonb not null default '[]'::jsonb check (jsonb_typeof(content) = 'array');

commit;
