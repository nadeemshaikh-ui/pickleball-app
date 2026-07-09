create table sessions (
  id text primary key,
  created_at timestamptz not null default now(),
  format text not null check (format in ('scramble', 'squad_rivalry')),
  players jsonb not null,
  squads jsonb,
  round_count int not null,
  status text not null default 'setup' check (status in ('setup', 'in_progress', 'completed'))
);

create table rounds (
  id uuid primary key default gen_random_uuid(),
  session_id text not null references sessions(id) on delete cascade,
  round_number int not null,
  court int not null check (court in (1, 2)),
  team_a jsonb not null,
  team_b jsonb not null,
  sitting_out jsonb not null,
  score_a int,
  score_b int,
  unique (session_id, round_number, court)
);

-- No auth in v1: open policies scoped to anon key usage only.
alter table sessions enable row level security;
alter table rounds enable row level security;

create policy "anon full access sessions" on sessions
  for all using (true) with check (true);

create policy "anon full access rounds" on rounds
  for all using (true) with check (true);
