# Handover — brief 01 (7 nov)
- Plan: docs/PLAN-DASHBOARD.md. Brief: docs/briefs/01-baza-de-date.md (gate 1 + 2 done, checks agreed).
- Branch `owner-dashboard`, nothing committed, no node_modules yet. Docker Desktop was started (needed for `npx supabase start`).
- Next: gate 3 — spawn api-engineer (opus/high) with the brief + Team paths; api-tester writes `supabase/tests/` in parallel, using the error code `booking_overlap`. Then qa-reviewer.
- Taka's decisions: we own the schema, Robert approves via PR; manual booking from the chart in scope; deps approved; site must scale.
- Robert's page (`src/app/page.tsx`, `src/components/browse/`) is off limits. i18n only under `Dashboard.*`.
- Waits on Robert: collaborator access for `takadaner`. No push/commit without Taka's word.
