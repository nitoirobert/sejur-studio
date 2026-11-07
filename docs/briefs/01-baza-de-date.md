# Brief 01 — Pasul 0 + 1: pregătire și baza de date

Plan: `docs/PLAN-DASHBOARD.md` (§2 schema, §3 pașii 0-1, §4b performanță). Schema de bază: `PLAN.md` §3 și §6 (GDPR). Ramura: `owner-dashboard`. Nu se face commit (Taka decide).

## Scop
Supabase local (Docker) cu toată schema MVP + adăugirile dashboardului, RLS, anti-suprapunere, Storage și date de test, plus uneltele de test. Nicio pagină încă.

## Ce se face
- `npm install`; adaugă `@supabase/ssr @supabase/supabase-js zod @dnd-kit/core @dnd-kit/sortable`, dev: `vitest @playwright/test`; scripturi `test`, `typecheck`, `db:reset`, `db:test`, `db:types`.
- `npx supabase init`; migrații numerotate în `supabase/migrations/` (`0001_core.sql`, `0002_rls.sql`, `0003_storage.sql`, `0004_functions.sql`...).
- Toate tabelele din `PLAN.md` §3 + §2 din plan (photos, profiles, câmpuri noi). `id uuid`, `created_at`, `updated_at` (trigger), bani `integer` în bani cu `check (>= 0)`, `currency` implicit `RON`, date `date`, `stay daterange` generat `[check_in, check_out)`, `check (check_out > check_in)`, constraint `bookings_no_overlap`.
- Trigger pe `auth.users`: creează `organizations` + `organization_members` (`owner`) + `profiles`.
- RLS pe fiecare tabel prin `is_org_member()` `stable security definer`, `(select auth.uid())`. `units`/`unit_prices`/`photos` legate de organizație. Bucket `photos` privat, căi `<organization_id>/...`, max 10 MB, doar `image/*`.
- Funcții: `create_manual_booking(...)` (oaspete + rezervare într-o tranzacție; la suprapunere ridică eroare cu cod clar), `reorder_photos(...)`, `dashboard_chart(from, to, property_id)`, `dashboard_kpis(day)` (fus `Europe/Bucharest`).
- Indexuri din §4b. `supabase/seed.sql`: 2 conturi de test, 2 organizații, org 1 cu 2 proprietăți / 6 unități / ~20 rezervări pe 60 zile (direct, booking, airbnb, hold, blocked), org 2 cu 1 proprietate.
- `.env.example` cu variabilele din `PLAN.md` §5. `docs/DB.md`: tabelele pe scurt, pentru Robert.

## Verificări (convenite de api-tester + qa-reviewer, 7 nov)
1. `npx supabase db reset` fără erori de 2 ori; seed exact: 2 conturi, 2 org, org 1 = 2 proprietăți / 6 unități / ~20 rezervări (direct, booking, airbnb, hold, blocked), org 2 = 1 proprietate; doar date false (`@example.com`).
2. Suprapunere pe aceeași unitate (confirmed/hold/blocked) → `23P01`; altă unitate, check-out = check-in următor, peste cancelled/expired → OK; `check_out <= check_in`, bani negativi, status necunoscut → refuzat; `currency` implicit `RON`; `stay = daterange(check_in, check_out, '[)')`.
3. RLS: niciun tabel `public` fără RLS; org 1 nu face select/insert/update/delete pe org 2 pe niciun tabel; update care mută rândul spre org 2 refuzat; units/unit_prices/photos sub proprietate din org 2 refuzat.
4. Storage `photos`: org 1 nu citește/scrie/șterge în `<org2_id>/`; >10 MB și non-`image/*` refuzate; anon vede doar pozele proprietăților active.
5. Funcțiile `security definer` au `search_path` fixat și nume calificate; EXECUTE revocat de la `public`/`anon` pe funcțiile proprietarului; apelate cu id-uri din alt org → eroare sau gol.
6. Cont nou → exact 1 org + 1 membru `owner` + 1 profil; al doilea cont → alt org; triggerul nu ia rol/org din `raw_user_meta_data`.
7. `create_manual_booking`: o tranzacție (fără oaspete orfan), eroare cu cod `booking_overlap`, curăță întâi hold-urile expirate ale unității, refuză unitate din alt org.
8. `reorder_photos`: poziții 0..n-1, max o copertă pe proprietate, refuz pe alt org.
9. `dashboard_chart` întoarce rezervările care se suprapun cu `[from, to)` (și cele începute înainte), filtrul pe proprietate; `dashboard_kpis(day)` în `Europe/Bucharest` (test la 23:30 UTC), valori fixe calculate din seed; regulile ocupare/încasări scrise în `docs/DB.md`.
10. Anon (pagina lui Robert): citește doar proprietăți `activa`, unități publicate, poze, prețuri și zile ocupate ca intervale (fără oaspete, status, sursă, sumă, token); 0 rânduri pe guests, bookings, payments, profiles, organization_members, ical_feeds, sync_conflicts și coloanele de facturare/Stripe; nicio scriere.
11. GDPR: `guests` = doar full_name, email, phone (+ id, org, timpi); ștergerea oaspetelui păstrează rezervarea (`on delete set null`).
12. Bani doar `integer` cu `check (>= 0)`; `updated_at` se schimbă la update; fiecare cheie străină și `organization_id` e prima coloană a unui index; indexurile din §4b există; nicio politică nu cheamă `auth.uid()` fără `(select ...)`.
13. `SUPABASE_SERVICE_ROLE_KEY` niciodată `NEXT_PUBLIC_*` și absent din `src/`; `.env.example` complet, fără valori, urmărit de git (`!.env.example` în `.gitignore`); `.env.local` ignorat.
14. `npm run lint`, `typecheck`, `test`, `db:test` trec; `db:types` fără diferențe după reset; `docs/DB.md` explică tabelele și ce citește anon.

## Note pentru construire
- Unitățile se aliniază cu mock-ul lui Robert (`src/lib/mock-units.ts`): tipurile lui (inclusiv `casuta`), plus bedrooms, bathrooms, area dacă le folosește. Citește mock-ul înainte de schemă.
- Accesul anon la poze: politică de citire pe bucket doar pentru proprietăți active (bucket privat). Disponibilitatea pentru anon: funcție `public_busy_ranges(unit_id, from, to)`.

## Team
- **api-engineer** (opus / high: schemă nouă, RLS, constraint): `supabase/migrations/`, `supabase/seed.sql`, `supabase/config.toml`, `package.json`, `package-lock.json`, `.env.example`, `.gitignore`, `vitest.config.ts`, `docs/DB.md`
- **api-tester**: teste SQL pgTAP, `supabase/tests/`
- **qa-reviewer**: citire, verdict
