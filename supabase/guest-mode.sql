create table if not exists public.players (
  id text primary key,
  name text not null,
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.guest_predictions (
  id text primary key,
  match_id text not null references public.matches(id) on delete cascade,
  user_id text not null references public.players(id) on delete cascade,
  user_name text not null,
  home_score int not null check (home_score >= 0),
  away_score int not null check (away_score >= 0),
  submitted_at timestamptz not null default now(),
  unique (match_id, user_id)
);

alter table public.players enable row level security;
alter table public.guest_predictions enable row level security;

drop policy if exists "Matches are visible to everyone" on public.matches;
create policy "Matches are visible to everyone"
on public.matches for select
to anon, authenticated
using (true);

drop policy if exists "Players are visible to everyone" on public.players;
create policy "Players are visible to everyone"
on public.players for select
to anon, authenticated
using (true);

drop policy if exists "Guests can create players" on public.players;
create policy "Guests can create players"
on public.players for insert
to anon, authenticated
with check (true);

drop policy if exists "Guests can update players" on public.players;
create policy "Guests can update players"
on public.players for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "Guest predictions reveal after kickoff" on public.guest_predictions;
create policy "Guest predictions reveal after kickoff"
on public.guest_predictions for select
to anon, authenticated
using (
  exists (
    select 1 from public.matches
    where matches.id = guest_predictions.match_id
    and matches.kickoff <= now()
  )
);

drop policy if exists "Guests can insert unlocked predictions" on public.guest_predictions;
create policy "Guests can insert unlocked predictions"
on public.guest_predictions for insert
to anon, authenticated
with check (
  exists (
    select 1 from public.matches
    where matches.id = guest_predictions.match_id
    and matches.kickoff > now()
  )
);

drop policy if exists "Guests can update unlocked predictions" on public.guest_predictions;
create policy "Guests can update unlocked predictions"
on public.guest_predictions for update
to anon, authenticated
using (true)
with check (
  exists (
    select 1 from public.matches
    where matches.id = guest_predictions.match_id
    and matches.kickoff > now()
  )
);
