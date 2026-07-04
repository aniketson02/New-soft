-- Growth infrastructure: email waitlist (landing page) and first-party
-- product analytics. Both tables are write-only from the client (no select
-- policies); reads happen via service role / SQL only.

create table public.waitlist (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  source     text,
  created_at timestamptz not null default now()
);

create unique index waitlist_email_idx on public.waitlist (lower(email));

alter table public.waitlist enable row level security;

create policy "public can join waitlist"
  on public.waitlist for insert
  to anon, authenticated
  with check (
    email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    and length(email) <= 254
  );

create table public.events (
  id         bigint generated always as identity primary key,
  name       text not null check (length(name) <= 64),
  props      jsonb,
  user_id    uuid default auth.uid(),
  anon_id    text check (length(anon_id) <= 64),
  created_at timestamptz not null default now()
);

create index events_name_time_idx on public.events (name, created_at);

alter table public.events enable row level security;

create policy "clients can record events"
  on public.events for insert
  to anon, authenticated
  with check (pg_column_size(props) < 2048);
