# Axiom

A personal university for the mathematics, science and engineering of machine learning.

## Run locally

```bash
cp .env.example .env.local   # point DATABASE_URL at a local Postgres
npm install
npm run migrate
npm run dev
```

## Checks

| Command | What it does |
| --- | --- |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript |
| `npm run lessons` | Checks every lesson and mini-capstone: answers, predicted outputs, reference solutions and hidden tests, run under the same Python the browser uses |
| `npm test` | Unit and database tests (Vitest) |
| `npm run e2e` | Builds the app and runs browser tests at laptop, tablet and phone sizes |
| `LIVE_URL=... npm run e2e` | Read-only smoke test of the deployed site |

## Mini-capstones

A mini-capstone closes a cluster. It is one small project in stages that needs several of the cluster's lessons at once, and it teaches nothing new. Learn gives it straight after the lesson that finishes the cluster. One lives at `content/capstones/<cluster>.yaml`, and its questions use the same format and checks as a lesson's.

What is planned after them, capstones and job-readiness, is in [ROADMAP.md](ROADMAP.md).

## Reviews

Every finished lesson comes back for review at growing gaps: about 4 days after it is finished, then about 2 weeks, 7 weeks and 20 weeks if it is recalled each time, and within days if it is missed. The schedule is the FSRS-4.5 memory model (`src/lib/review/schedule.ts`), which brings a lesson back when the chance of recalling it has fallen to 90%.

A review is one question with one try. The question is always new: it is written by the model for that one review, from the lesson and the list of every review question the learner has already had on it. It is shown only if it is not a repeat of any of those or of the lesson's own questions, and if a second, independent pass that is not told the answer solves it and reaches the same answer. Once answered, a question is never shown again. If no new question can be written, no review is given; an old question is never used instead.

Learn gives reviews between lessons, never in the middle of one, and at most three in a row while new material is waiting. Reviews need `ANTHROPIC_API_KEY`, like the tutor, and each question's cost is recorded in `review_questions`.

## Tutor

The tutor sits beside the lesson and the editor (a third tab on a phone). It is told the lesson in progress, the lessons already finished and what comes next. With each message it is also told which questions are solved, every answer given to each question so far, the question last worked on, and the code in the editor.

It first works out what a message is about, and answers accordingly:

- A question not yet solved. The tutor never gives the solution. It judges whether the learner can solve the question without help. If so, it does not nudge at all. If not, it gives one hint written for that moment. It does not discuss the question openly until the question is solved.
- A solved question. Open discussion: the answer, other approaches, where the idea leads.
- The lesson but not a question. It teaches in full.
- Anything else. It answers plainly.

There is no hint ladder. Lessons carry no prepared hints and questions have no Hint button; the tutor is the only source of hints. Each reply opens with a line the learner never sees, in which the tutor states what it judged the message to be about and whether it gave a hint (`src/lib/tutor/turn.ts`). That judgement is stored with the reply in `tutor_messages`, and `attempts.hints_used` records how many hints the tutor had given on a question when each answer was submitted. This is the hint signal that mastery reads.

It needs `ANTHROPIC_API_KEY` in the deployment. It runs on Claude Opus 5.5 at high effort (`AXIOM_TUTOR_MODEL` and `AXIOM_TUTOR_EFFORT` change that). Its spend is not capped; the cost of each reply is recorded in `tutor_messages`. Tests use a stand-in for the API (`tests/e2e/mock-anthropic.mjs`), so CI needs no key.

## Layout

- `migrations/` plain SQL, applied in order by `scripts/migrate.ts` during every build
- `src/lib/auth/` passphrase generation, Argon2id hashing, sessions, rate limiting
- `src/app/` screens: home, sign-in, learn
- `content/` the lessons and mini-capstones, and `graph/` the clusters and what each needs
- `src/lib/capstones/` the mini-capstone format and its checks
- `src/lib/review/` spaced repetition: when a finished lesson comes back, and the fresh question written for each review
- `src/lib/tutor/` the tutor beside each lesson: what it is told, what it costs, its conversation
- `tests/` unit tests and browser tests

The EFF large word list in `src/lib/auth/eff-wordlist.json` is published by the Electronic Frontier Foundation under CC BY 3.0 US.
