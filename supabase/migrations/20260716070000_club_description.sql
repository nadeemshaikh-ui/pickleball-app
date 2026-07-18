-- Powers the club dashboard's About section (app/clubs/[id]/page.tsx).
-- Existing `clubs public read` / `clubs admin update` RLS already covers
-- any new nullable column — no policy change needed.
alter table clubs add column description text;
