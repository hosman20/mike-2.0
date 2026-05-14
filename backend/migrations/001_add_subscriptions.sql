-- 001_add_subscriptions.sql
-- Stripe-backed subscription state + 14-day trial bootstrap.
--
-- The frontend talks directly to Supabase only for auth; the backend
-- service role does all writes (webhook + checkout completion). RLS is
-- enabled so a future shift to direct client reads is safe by default.
-- Idempotent — safe to re-run.

create extension if not exists "pgcrypto";

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  tier text not null default 'trial'
    check (tier in ('trial','starter','professional','enterprise')),
  status text not null default 'trialing'
    check (status in (
      'trialing',
      'active',
      'past_due',
      'canceled',
      'unpaid',
      'incomplete',
      'incomplete_expired'
    )),
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  monthly_token_limit bigint not null default 1000000,
  tokens_used_this_period bigint not null default 0,
  period_started_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_user_id_idx
  on public.subscriptions(user_id);

create index if not exists subscriptions_stripe_customer_id_idx
  on public.subscriptions(stripe_customer_id);

alter table public.subscriptions enable row level security;

drop policy if exists subscriptions_owner_select on public.subscriptions;
create policy subscriptions_owner_select
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- Service role bypasses RLS, so backend webhook / checkout writes do not
-- need an insert/update policy. The browser can only read its own row.

-- Auto-provision a trial subscription on user signup. The existing
-- `handle_new_user` trigger seeds `user_profiles`; this companion function
-- seeds `subscriptions` with a 14-day trial and 1M-token limit. Both
-- triggers run on the same `auth.users` insert.
create or replace function public.handle_new_user_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.subscriptions (
    user_id,
    tier,
    status,
    trial_ends_at,
    monthly_token_limit,
    period_started_at
  )
  values (
    new.id,
    'trial',
    'trialing',
    now() + interval '14 days',
    1000000,
    now()
  )
  on conflict do nothing;
  return new;
exception when others then
  -- Never block signup if subscription bootstrap fails.
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_subscription on auth.users;
create trigger on_auth_user_created_subscription
  after insert on auth.users
  for each row execute procedure public.handle_new_user_subscription();

-- Direct grant hardening — match the pattern used elsewhere in schema.sql.
revoke all on public.subscriptions from anon, authenticated;
