-- Fresh recall questions now live in the Recall part of a lesson, not on a screen of their own.
-- This is the lesson a question was shown in, so the lesson shows the same ones on every visit.
alter table review_questions add column shown_in text;
create index review_questions_by_lesson on review_questions (user_id, shown_in);
