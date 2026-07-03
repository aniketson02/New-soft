-- Hearth — Family Operating System
-- Phase 1 schema: families, members, lists, captures, proposals, items

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.families (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  invite_code text not null unique default encode(gen_random_bytes(4), 'hex'),
  created_at  timestamptz not null default now()
);

create table public.members (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references public.families (id) on delete cascade,
  user_id      uuid references auth.users (id) on delete cascade,
  display_name text not null,
  role         text not null default 'adult' check (role in ('adult', 'kid')),
  created_at   timestamptz not null default now(),
  unique (family_id, user_id)
);

create table public.lists (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references public.families (id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);

-- Raw inputs dumped by family members (photo of a flyer, voice note, pasted
-- text). The extraction pipeline turns these into proposals.
create table public.captures (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references public.families (id) on delete cascade,
  created_by   uuid references auth.users (id) on delete set null,
  kind         text not null check (kind in ('photo', 'voice', 'text')),
  storage_path text,
  text_content text,
  status       text not null default 'pending'
               check (status in ('pending', 'processing', 'done', 'error')),
  error        text,
  created_at   timestamptz not null default now()
);

-- AI-extracted structured suggestions awaiting one-tap confirmation.
-- payload holds the extracted item as JSON (type, title, due_at, owner hint…).
create table public.proposals (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references public.families (id) on delete cascade,
  capture_id uuid references public.captures (id) on delete cascade,
  payload    jsonb not null,
  status     text not null default 'pending'
             check (status in ('pending', 'accepted', 'dismissed')),
  created_at timestamptz not null default now()
);

-- Confirmed board content: calendar events, tasks, and list entries.
create table public.items (
  id                 uuid primary key default gen_random_uuid(),
  family_id          uuid not null references public.families (id) on delete cascade,
  type               text not null check (type in ('event', 'task', 'list_entry')),
  title              text not null,
  notes              text,
  owner_member_id    uuid references public.members (id) on delete set null,
  list_id            uuid references public.lists (id) on delete cascade,
  due_at             timestamptz,
  recurrence         text, -- iCal RRULE string; null = one-off
  status             text not null default 'open' check (status in ('open', 'done')),
  source_proposal_id uuid references public.proposals (id) on delete set null,
  created_by         uuid references auth.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index items_family_due_idx on public.items (family_id, status, due_at);
create index proposals_family_status_idx on public.proposals (family_id, status);
create index captures_family_status_idx on public.captures (family_id, status);
create index members_user_idx on public.members (user_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger items_updated_at
  before update on public.items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.families  enable row level security;
alter table public.members   enable row level security;
alter table public.lists     enable row level security;
alter table public.captures  enable row level security;
alter table public.proposals enable row level security;
alter table public.items     enable row level security;

-- security definer so policies can check membership without recursing into
-- the members table's own RLS.
create or replace function public.is_family_member(p_family_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.members
    where family_id = p_family_id and user_id = auth.uid()
  );
$$;

create policy "members can read their family"
  on public.families for select
  using (public.is_family_member(id));

create policy "members can read fellow members"
  on public.members for select
  using (public.is_family_member(family_id));

create policy "adults manage member profiles"
  on public.members for all
  using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));

create policy "family members full access"
  on public.lists for all
  using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));

create policy "family members full access"
  on public.captures for all
  using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));

create policy "family members full access"
  on public.proposals for all
  using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));

create policy "family members full access"
  on public.items for all
  using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));

-- ---------------------------------------------------------------------------
-- RPCs — family creation and invite-code join go through security definer
-- functions because a user has no row access until they are a member.
-- ---------------------------------------------------------------------------

create or replace function public.create_family(p_name text, p_display_name text)
returns public.families
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family public.families;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  insert into public.families (name) values (p_name) returning * into v_family;

  insert into public.members (family_id, user_id, display_name)
  values (v_family.id, auth.uid(), p_display_name);

  insert into public.lists (family_id, name) values (v_family.id, 'Groceries');

  return v_family;
end;
$$;

create or replace function public.join_family(p_invite_code text, p_display_name text)
returns public.families
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family public.families;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into v_family from public.families
  where invite_code = lower(p_invite_code);

  if v_family.id is null then
    raise exception 'invalid invite code';
  end if;

  insert into public.members (family_id, user_id, display_name)
  values (v_family.id, auth.uid(), p_display_name)
  on conflict (family_id, user_id) do nothing;

  return v_family;
end;
$$;

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.items;
alter publication supabase_realtime add table public.proposals;

-- ---------------------------------------------------------------------------
-- Storage bucket for photo/voice captures
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('captures', 'captures', false)
on conflict (id) do nothing;

create policy "family members read captures"
  on storage.objects for select
  using (
    bucket_id = 'captures'
    and public.is_family_member(((storage.foldername(name))[1])::uuid)
  );

create policy "family members upload captures"
  on storage.objects for insert
  with check (
    bucket_id = 'captures'
    and public.is_family_member(((storage.foldername(name))[1])::uuid)
  );
