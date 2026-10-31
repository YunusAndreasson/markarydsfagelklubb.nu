-- Who to call and by when (docs/design.md, "Program"). The club's sign-ups have
-- always been a named person, a phone number and a last date, which until now
-- could only sit in an event's free text. Own table, nothing existing touched;
-- the columns inherit the events policies and grants, so they are as public as
-- the programme they are printed in. Who goes in them is the admin's call, and
-- no person's details belong in this file.
-- Re-runnable: see .claude/skills/new-migration.

alter table public.events
  add column if not exists contact_name text not null default '',
  add column if not exists contact_phone text not null default '',
  -- A day, not an instant: "senast 24 november" holds until that day is over.
  add column if not exists signup_deadline date;
