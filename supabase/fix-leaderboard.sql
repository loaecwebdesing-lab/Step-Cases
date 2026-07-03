-- ============================================================
-- STEP CASES — Supabase setup complet
-- Colle tout ce fichier dans Supabase → SQL Editor → Run
-- Safe à relancer : utilise IF NOT EXISTS / OR REPLACE / DROP IF EXISTS
-- ============================================================

-- ── Table profiles (1 ligne par compte) ──────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique not null,
  avatar_emoji text not null default '🦊',
  avatar_color text not null default '#ff6b35',
  balance numeric not null default 10 check (balance >= 0),
  inventory jsonb not null default '[]'::jsonb,
  stats jsonb not null default '{
    "opened": 0, "spent": 0, "won": 0, "bestDrop": null,
    "knives": 0, "gloves": 0, "battles": 0, "battlesWon": 0,
    "upgrades": 0, "upgradesWon": 0
  }'::jsonb,
  last_bonus bigint not null default 0,
  xp numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_username_idx on public.profiles (username);
create index if not exists profiles_balance_idx on public.profiles (balance desc);

-- ── Création auto du profil à l'inscription ($10 de départ) ─
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, username, avatar_emoji, avatar_color, balance
  ) values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'avatar_emoji', '🦊'),
    coalesce(new.raw_user_meta_data->>'avatar_color', '#ff6b35'),
    10
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Mise à jour auto de updated_at ───────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ── Row Level Security ───────────────────────────────────────
alter table public.profiles enable row level security;

drop policy if exists "Profiles are viewable by everyone" on public.profiles;
create policy "Profiles are viewable by everyone"
  on public.profiles for select
  to anon, authenticated
  using (true);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ── Permissions (lecture publique du leaderboard) ─────────────
grant usage on schema public to anon, authenticated;
grant select on table public.profiles to anon, authenticated;
grant insert, update on table public.profiles to authenticated;

-- ── Fonction leaderboard : tous les vrais joueurs ─────────────
create or replace function public.get_leaderboard()
returns table (
  id uuid,
  username text,
  avatar_emoji text,
  avatar_color text,
  balance numeric,
  inventory jsonb,
  stats jsonb,
  xp numeric,
  created_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select
    p.id,
    p.username,
    p.avatar_emoji,
    p.avatar_color,
    p.balance,
    p.inventory,
    p.stats,
    p.xp,
    p.created_at
  from public.profiles p
  order by p.balance desc
  limit 100;
$$;

revoke all on function public.get_leaderboard() from public;
grant execute on function public.get_leaderboard() to anon, authenticated;
