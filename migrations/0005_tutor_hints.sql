-- The hint ladder is gone. Hints now come only from the tutor, which writes each one for the moment it is asked.
drop table hint_views;

-- What the tutor judged each message to be about, and whether its reply gave a hint on an unsolved question.
-- attempts.hints_used now counts these: the tutor's hints on the question before the answer was submitted.
alter table tutor_messages
  add column about text check (about in ('unsolved', 'solved', 'lesson', 'other')),
  add column question_id text,
  add column hint boolean not null default false;
create index tutor_messages_hints on tutor_messages (user_id, concept_id, question_id) where hint;
