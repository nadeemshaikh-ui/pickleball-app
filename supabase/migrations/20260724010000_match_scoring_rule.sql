-- Team Championship match-ending rule, chosen once at setup for the whole
-- tournament (see lib/matchScoring.ts). Nullable/unused by every other
-- format — their score validation is unrelated to this.
alter table sessions add column match_scoring_rule text;
alter table sessions add constraint sessions_match_scoring_rule_check
  check (match_scoring_rule is null or match_scoring_rule in ('golden_14', 'cap_16', 'cap_17'));
