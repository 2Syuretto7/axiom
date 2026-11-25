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

## Tutor

The tutor sits beside the lesson and the editor (a third tab on a phone). It is told the lesson in progress, the lessons already finished and what comes next, and it sees the code in the editor when a question is asked.

It needs `ANTHROPIC_API_KEY` in the deployment. Its spend is not capped; the cost of each reply is recorded in `tutor_messages`. Tests use a stand-in for the API (`tests/e2e/mock-anthropic.mjs`), so CI needs no key.

## Layout

- `migrations/` plain SQL, applied in order by `scripts/migrate.ts` during every build
- `src/lib/auth/` passphrase generation, Argon2id hashing, sessions, rate limiting
- `src/app/` screens: home, sign-in, learn
- `content/` the lessons and mini-capstones, and `graph/` the clusters and what each needs
- `src/lib/capstones/` the mini-capstone format and its checks
- `src/lib/tutor/` the tutor beside each lesson: what it is told, what it costs, its conversation
- `tests/` unit tests and browser tests

The EFF large word list in `src/lib/auth/eff-wordlist.json` is published by the Electronic Frontier Foundation under CC BY 3.0 US.
