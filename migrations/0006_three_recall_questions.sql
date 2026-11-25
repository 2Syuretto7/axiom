-- Every lesson's Recall part is now one set of exactly three fresh questions. When fewer than three earlier
-- lessons are finished, an idea is asked about more than once, so several questions may wait for the same idea.
drop index review_questions_waiting;
create index review_questions_unanswered on review_questions (user_id, concept_id) where answered_at is null;
