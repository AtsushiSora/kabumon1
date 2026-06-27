-- Kabumon cloud sync draft schema.
-- Apply this in Supabase SQL editor after enabling Auth.

create table if not exists public.player_profiles (
  guest_id text primary key,
  user_id uuid references auth.users(id) on delete set null,
  display_name text not null,
  provider text not null default 'guest',
  trader_level integer not null default 1,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.battle_snapshots (
  sync_code text primary key,
  owner_guest_id text not null references public.player_profiles(guest_id) on delete cascade,
  owner_name text not null,
  trader_level integer not null default 1,
  base_attack integer not null default 0,
  total_attack integer not null default 0,
  team_bonus_name text not null,
  team_bonus_multiplier numeric not null default 1,
  members jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.battle_results (
  id uuid primary key default gen_random_uuid(),
  attacker_guest_id text not null references public.player_profiles(guest_id) on delete cascade,
  defender_sync_code text not null references public.battle_snapshots(sync_code) on delete cascade,
  attacker_attack integer not null,
  defender_attack integer not null,
  won boolean not null,
  rank text not null,
  kabu_coins integer not null default 0,
  dividend_coins integer not null default 0,
  exp integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.player_profiles enable row level security;
alter table public.battle_snapshots enable row level security;
alter table public.battle_results enable row level security;

create policy "public profiles are readable"
  on public.player_profiles for select
  using (true);

create policy "public battle snapshots are readable"
  on public.battle_snapshots for select
  using (true);

create policy "battle results are readable by participants"
  on public.battle_results for select
  using (true);

-- Prototype write policies for a GitHub Pages static build using the anon key.
-- Tighten these after real account login is connected.
create policy "prototype profiles can be inserted"
  on public.player_profiles for insert
  with check (true);

create policy "prototype profiles can be updated"
  on public.player_profiles for update
  using (true)
  with check (true);

create policy "prototype battle snapshots can be inserted"
  on public.battle_snapshots for insert
  with check (true);

create policy "prototype battle snapshots can be updated"
  on public.battle_snapshots for update
  using (true)
  with check (true);

create policy "prototype battle results can be inserted"
  on public.battle_results for insert
  with check (true);

-- Production note:
-- Prefer authenticated users or service-role writes through a server/edge function
-- before opening this beyond prototype testing.
