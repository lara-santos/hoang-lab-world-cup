create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  method text not null check (method in ('google', 'simple')),
  created_at timestamptz not null default now()
);

create table if not exists public.matches (
  id text primary key,
  group_name text not null,
  home_team text not null,
  away_team text not null,
  kickoff timestamptz not null,
  venue text not null,
  status text not null check (status in ('scheduled', 'live', 'finished')),
  home_score int,
  away_score int,
  updated_at timestamptz not null default now()
);

create table if not exists public.predictions (
  id text primary key,
  match_id text not null references public.matches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  user_name text not null,
  home_score int not null check (home_score >= 0),
  away_score int not null check (away_score >= 0),
  submitted_at timestamptz not null default now(),
  unique (match_id, user_id)
);

alter table public.profiles enable row level security;
alter table public.matches enable row level security;
alter table public.predictions enable row level security;

drop policy if exists "Profiles are visible to signed-in users" on public.profiles;
create policy "Profiles are visible to signed-in users"
on public.profiles for select
to authenticated
using (true);

drop policy if exists "Users can upsert their own profile" on public.profiles;
create policy "Users can upsert their own profile"
on public.profiles for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Matches are visible to signed-in users" on public.matches;
create policy "Matches are visible to signed-in users"
on public.matches for select
to authenticated
using (true);

drop policy if exists "Predictions reveal after kickoff or to owner" on public.predictions;
create policy "Predictions reveal after kickoff or to owner"
on public.predictions for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.matches
    where matches.id = predictions.match_id
    and matches.kickoff <= now()
  )
);

drop policy if exists "Users can insert their own unlocked predictions" on public.predictions;
create policy "Users can insert their own unlocked predictions"
on public.predictions for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.matches
    where matches.id = predictions.match_id
    and matches.kickoff > now()
  )
);

drop policy if exists "Users can update their own unlocked predictions" on public.predictions;
create policy "Users can update their own unlocked predictions"
on public.predictions for update
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.matches
    where matches.id = predictions.match_id
    and matches.kickoff > now()
  )
);

insert into public.matches (id, group_name, home_team, away_team, kickoff, venue, status, home_score, away_score)
values
  ('wc26-mex-rsa', 'Group A', 'Mexico', 'South Africa', '2026-06-11T15:00:00-04:00', 'Mexico City Stadium', 'finished', 2, 0),
  ('wc26-kor-cze', 'Group A', 'Korea Republic', 'Czechia', '2026-06-11T21:00:00-04:00', 'Guadalajara Stadium', 'finished', 1, 1),
  ('wc26-can-bih', 'Group B', 'Canada', 'Bosnia and Herzegovina', '2026-06-12T15:00:00-04:00', 'Toronto Stadium', 'finished', 1, 0),
  ('wc26-usa-par', 'Group D', 'USA', 'Paraguay', '2026-06-12T21:00:00-04:00', 'Los Angeles Stadium', 'finished', 4, 1),
  ('wc26-ger-cur', 'Group E', 'Germany', 'Curacao', '2026-06-15T12:00:00-04:00', 'Houston Stadium', 'finished', 7, 1),
  ('wc26-sau-uru', 'Group H', 'Saudi Arabia', 'Uruguay', '2026-06-15T15:00:00-04:00', 'Miami Stadium', 'scheduled', null, null),
  ('wc26-esp-cpv', 'Group H', 'Spain', 'Cabo Verde', '2026-06-15T18:00:00-04:00', 'Atlanta Stadium', 'scheduled', null, null),
  ('wc26-ira-nzl', 'Group G', 'IR Iran', 'New Zealand', '2026-06-15T21:00:00-04:00', 'Los Angeles Stadium', 'scheduled', null, null),
  ('wc26-fra-sen', 'Group I', 'France', 'Senegal', '2026-06-16T15:00:00-04:00', 'New York New Jersey Stadium', 'scheduled', null, null),
  ('wc26-arg-alg', 'Group J', 'Argentina', 'Algeria', '2026-06-16T21:00:00-04:00', 'Kansas City Stadium', 'scheduled', null, null),
  ('wc26-bra-hai', 'Group C', 'Brazil', 'Haiti', '2026-06-19T18:00:00-04:00', 'Philadelphia Stadium', 'scheduled', null, null),
  ('wc26-arg-aut', 'Group J', 'Argentina', 'Austria', '2026-06-22T18:00:00-04:00', 'Dallas Stadium', 'scheduled', null, null),
  ('wc26-eng-gha', 'Group L', 'England', 'Ghana', '2026-06-23T15:00:00-04:00', 'Boston Stadium', 'scheduled', null, null),
  ('wc26-sco-bra', 'Group C', 'Scotland', 'Brazil', '2026-06-24T15:00:00-04:00', 'Miami Stadium', 'scheduled', null, null)
on conflict (id) do update set
  group_name = excluded.group_name,
  home_team = excluded.home_team,
  away_team = excluded.away_team,
  kickoff = excluded.kickoff,
  venue = excluded.venue,
  status = excluded.status,
  home_score = excluded.home_score,
  away_score = excluded.away_score,
  updated_at = now();
