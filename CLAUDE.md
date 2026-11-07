@AGENTS.md

# Sejur Studio: instructions for every agent (Taka's and Robert's)

Direct-booking product for small property owners in Romania: a public booking site and an owner panel.

## Before any work
1. `git pull`
2. Read `docs/STATUS.md` (where we are), `docs/DECISIONS.md` (settled, do not reopen), `docs/ROADMAP.md` (the full plan), and the current brief in `docs/briefs/`.
3. Database contract: `docs/DB.md`. Never change a migration that is already on `main`; add a new one.

## Who owns what
- Robert: public site, `src/app/page.tsx`, `src/components/browse/`.
- Taka: owner panel and DB, `src/app/dashboard/`, `src/app/login/`, `src/app/cont-nou/`, `src/components/dashboard/`, `src/lib/supabase/`, `src/proxy.ts`, `supabase/`.
- Shared: `src/app/globals.css` (add tokens, do not change existing ones), `messages/ro.json` (Robert's keys at the top level, panel keys under `Dashboard.*`), `src/app/layout.tsx` (change only after agreeing).

## Rules
- Code goes through a branch, then a PR, then a preview, then a merge into `main`. Plans and docs go straight to `main`.
- One working tree per writer. If you need another branch while someone else works, use `git worktree add`.
- UI in Romanian with correct diacritics (ș ț with comma below). Code and commits in English.
- Secrets never go in the repo. Only the public Supabase URL and anon key may be public.
- When you finish something, update its row in `docs/STATUS.md` in the same commit. After each brief, add 3 lines to `docs/LESSONS.md`.
