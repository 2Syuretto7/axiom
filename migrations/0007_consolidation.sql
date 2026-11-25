-- A lesson finished weakly is followed by a short consolidation set: a few fresh questions on that lesson.
-- They are stored with the fresh recall questions, so no question is ever written twice for a lesson, whatever it was for.
alter table review_questions add column purpose text not null default 'recall' check (purpose in ('recall', 'consolidation'));
