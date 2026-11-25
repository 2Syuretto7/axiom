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

## Recall, by spaced repetition

Every lesson opens with a Recall part, and its questions are one set of exactly three, no more and no fewer. They are not written in the lesson files: a lesson's `recall` part holds only its opening words, and the lesson check refuses a question there. Which earlier ideas the three ask about is chosen by spaced repetition. A finished lesson is not given again as a screen of its own.

The ideas that are due come first, the most forgotten first. If fewer than three are due, the ideas due soonest fill the set. The three are on three different ideas whenever three earlier lessons are finished. After only one or two finished lessons an idea is asked about more than once, each time with a different question. The very first lesson has no earlier idea, so it alone has no recall questions.

When an idea is due is decided by the FSRS-4.5 memory model (`src/lib/review/schedule.ts`), which brings it back when the chance of recalling it has fallen to 90%: about 4 days after its lesson is finished, then about 2 weeks, 7 weeks and 20 weeks if it is recalled each time, and within days if it is missed.

Each idea is recalled with one question, one try and no hints. The question is always new: it is written by the model for that one occasion, from the idea's lesson and the list of every recall question the learner has already had on it. It is shown only if it is not a repeat of any of those or of the lesson's own questions, and if a second, independent pass that is not told the answer solves it and reaches the same answer. Once answered, a question is never shown again. If a new question cannot be written, its place stays empty until the next visit; an old question is never used instead.

These questions do not count towards finishing the lesson they appear in. They need `ANTHROPIC_API_KEY`, like the tutor, and each question's cost is recorded in `review_questions`.

## Timed and untimed questions

System One questions (`system: s1`, shown as Quick) are fast retrieval, so they are timed. A timed question is hidden until the learner presses Start, then a countdown runs: 30 seconds for a choice, 60 for a number, a prediction or an ordering, 3 minutes for code, or the question's own `seconds`. If the time runs out the attempt is a miss; a lesson question can be started again, and a fresh recall question, which gets one try, is missed. The limit is enforced on the server.

System Two questions (`system: s2`, shown as Think) are slow reasoning. They are never timed, and no time is measured or stored for them.

## Tutor

The tutor sits beside the lesson and the editor (a third tab on a phone). It is told the lesson in progress, the lessons already finished and what comes next, and it sees the code in the editor when a question is asked.

It needs `ANTHROPIC_API_KEY` in the deployment. Its spend is not capped; the cost of each reply is recorded in `tutor_messages`. Tests use a stand-in for the API (`tests/e2e/mock-anthropic.mjs`), so CI needs no key.

## Layout

- `migrations/` plain SQL, applied in order by `scripts/migrate.ts` during every build
- `src/lib/auth/` passphrase generation, Argon2id hashing, sessions, rate limiting
- `src/app/` screens: home, sign-in, learn
- `content/` the lessons and mini-capstones, and `graph/` the clusters and what each needs
- `src/lib/capstones/` the mini-capstone format and its checks
- `src/lib/review/` spaced repetition: which earlier ideas a lesson's Recall part brings back, and the fresh question written for each
- `src/lib/tutor/` the tutor beside each lesson: what it is told, what it costs, its conversation
- `tests/` unit tests and browser tests

The EFF large word list in `src/lib/auth/eff-wordlist.json` is published by the Electronic Frontier Foundation under CC BY 3.0 US.
