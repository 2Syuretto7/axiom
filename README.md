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
| `PREVIEW_URL=... npm run e2e` | Read-only smoke test of a deployed preview |

## Layout

- `migrations/` plain SQL, applied in order by `scripts/migrate.ts` during every build
- `src/lib/auth/` passphrase generation, Argon2id hashing, sessions, rate limiting
- `src/app/` screens: home, sign-in, learn
- `tests/` unit tests and browser tests

The EFF large word list in `src/lib/auth/eff-wordlist.json` is published by the Electronic Frontier Foundation under CC BY 3.0 US.
