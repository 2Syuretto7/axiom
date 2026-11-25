-- A lesson finished weakly is followed by a short consolidation set: a few fresh questions on that lesson.
-- They are stored with the fresh recall questions, so no question is ever written twice for a lesson, whatever it was for.
alter table review_questions add column purpose text not null default 'recall' check (purpose in ('recall', 'consolidation'));

-- One recall question waits per lesson, as before. A consolidation set may have several waiting.
drop index review_questions_waiting;
create unique index review_questions_waiting on review_questions (user_id, concept_id) where answered_at is null and purpose = 'recall';
