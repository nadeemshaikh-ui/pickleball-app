-- Late Arrivals plan, Item 2: tracks which of a session's roster (players)
-- are not available for the current schedule. players stays the full
-- roster; absent_players is the subset excluded from schedule generation.
-- See lib/db.ts's activePlayers() helper — always derive the active
-- roster through it rather than inlining the subtraction elsewhere.
alter table sessions
  add column absent_players text[] not null default '{}';
