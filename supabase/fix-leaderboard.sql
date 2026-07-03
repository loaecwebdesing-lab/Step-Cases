-- Fix: leaderboard only shows your own profile
-- Run once in Supabase → SQL Editor

-- Public read for all profiles (leaderboard)
drop policy if exists "Profiles are viewable by everyone" on public.profiles;
create policy "Profiles are viewable by everyone"
  on public.profiles for select
  to anon, authenticated
  using (true);

-- Allow roles to actually query the table
grant usage on schema public to anon, authenticated;
grant select on table public.profiles to anon, authenticated;
grant insert, update on table public.profiles to authenticated;
