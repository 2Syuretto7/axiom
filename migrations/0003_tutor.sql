-- The tutor's conversation, one thread per lesson, so it follows the learner across devices.
-- Rows are never deleted: clearing a conversation only hides it, so the month's spend stays true.
create table tutor_messages (
  id bigint generated always as identity primary key,
  user_id uuid not null references users(id) on delete cascade,
  concept_id text not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  -- What this reply cost, in millionths of a US dollar. Zero for the learner's own messages.
  cost_micro_usd bigint not null default 0,
  cleared_at timestamptz,
  created_at timestamptz not null default now()
);
create index tutor_messages_by_thread on tutor_messages (user_id, concept_id, id);
create index tutor_messages_by_time on tutor_messages (user_id, created_at);
