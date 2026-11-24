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
| `npm test` | Unit and database tests (Vitest) |
| `npm run e2e` | Builds the app and runs browser tests at laptop, tablet and phone sizes |
| `LIVE_URL=... npm run e2e` | Read-only smoke test of the deployed site |

## Tutor

The tutor sits beside the lesson and the editor (a third tab on a phone). It is told the lesson in progress, the lessons already finished and what comes next, and it sees the code in the editor when a question is asked.

It needs `ANTHROPIC_API_KEY` in the deployment. It stops answering once a month's spend reaches `AXIOM_TUTOR_MONTHLY_USD` (USD 20 unless set), and shows the spend so far under the question box. Tests use a stand-in for the API (`tests/e2e/mock-anthropic.mjs`), so CI needs no key.

## Layout

- `migrations/` plain SQL, applied in order by `scripts/migrate.ts` during every build
- `src/lib/auth/` passphrase generation, Argon2id hashing, sessions, rate limiting
- `src/app/` screens: home, sign-in, learn
- `src/lib/tutor/` the tutor beside each lesson: what it is told, what it costs, its conversation
- `tests/` unit tests and browser tests

The EFF large word list in `src/lib/auth/eff-wordlist.json` is published by the Electronic Frontier Foundation under CC BY 3.0 US.
