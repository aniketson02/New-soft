-- Monetization: per-family plan, AI-capture metering, and redeemable unlocks.

alter table public.families
  add column plan text not null default 'free' check (plan in ('free', 'premium')),
  add column premium_since timestamptz;

-- Redeemable codes (sold via a Stripe Payment Link, or granted manually).
create table public.promo_codes (
  code               text primary key,
  kind               text not null default 'lifetime',
  redeemed_by_family uuid references public.families (id) on delete set null,
  redeemed_at        timestamptz,
  created_at         timestamptz not null default now()
);

alter table public.promo_codes enable row level security;
-- No client policies: only SECURITY DEFINER RPCs and service_role touch this.

-- Current-month AI usage + plan for the caller's family.
create or replace function public.get_usage()
returns json
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_family uuid;
  v_plan   text;
  v_used   int;
  v_limit  int := 15;  -- free AI captures per family per calendar month
begin
  select family_id into v_family from public.members
  where user_id = auth.uid() limit 1;
  if v_family is null then
    return null;
  end if;

  select plan into v_plan from public.families where id = v_family;

  select count(*) into v_used from public.captures
  where family_id = v_family
    and created_at >= date_trunc('month', now())
    and status <> 'error';

  return json_build_object(
    'plan', v_plan,
    'used', v_used,
    'limit', case when v_plan = 'premium' then null else v_limit end,
    'remaining', case when v_plan = 'premium' then null else greatest(v_limit - v_used, 0) end,
    'period_end', date_trunc('month', now()) + interval '1 month'
  );
end;
$$;

create or replace function public.redeem_promo(p_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family uuid;
  v_code   public.promo_codes;
begin
  select family_id into v_family from public.members
  where user_id = auth.uid() limit 1;
  if v_family is null then
    raise exception 'not in a family';
  end if;

  select * into v_code from public.promo_codes
  where code = lower(trim(p_code));

  if v_code.code is null then
    return json_build_object('ok', false, 'error', 'That code isn''t valid.');
  end if;
  if v_code.redeemed_by_family is not null then
    return json_build_object('ok', false, 'error', 'That code has already been used.');
  end if;

  update public.promo_codes
    set redeemed_by_family = v_family, redeemed_at = now()
    where code = v_code.code;
  update public.families
    set plan = 'premium', premium_since = now()
    where id = v_family;

  return json_build_object('ok', true);
end;
$$;

revoke execute on function public.get_usage() from anon;
revoke execute on function public.redeem_promo(text) from anon;
grant execute on function public.get_usage() to authenticated;
grant execute on function public.redeem_promo(text) to authenticated;
