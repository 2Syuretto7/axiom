-- The hint ladder is gone. Hints now come only from the tutor, which writes each one for the moment it is asked.
-- Every statement here is safe to run on a database that already has the change.
drop table if exists hint_views;

-- What the tutor judged each message to be about, and whether its reply gave a hint on an unsolved question.
-- attempts.hints_used now counts these: the tutor's hints on the question before the answer was submitted.
alter table tutor_messages
  add column if not exists about text check (about in ('unsolved', 'solved', 'lesson', 'other')),
  add column if not exists question_id text,
  add column if not exists hint boolean not null default false;
create index if not exists tutor_messages_hints on tutor_messages (user_id, concept_id, question_id) where hint;
