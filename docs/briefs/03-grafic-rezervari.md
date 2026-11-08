# Brief 03: graficul rezervărilor și rezervarea manuală (pasul 4 din PLAN-DASHBOARD)

Plan: `docs/PLAN-DASHBOARD.md` §1 „Prezentare” punctele 2–4. Contractul bazei de date: `docs/DB.md`, împreună cu `docs/untangle-db.md`, intră înainte de construcție (pasul 0). Se pornește din brief 02: shell-ul, KPI-urile și `src/lib/supabase/`.

## Pasul 0: baza de date curățată ✅ (7 nov: aplicată pe proiectul de probă, 269 de teste pgTAP trec)
qa-reviewer citește migrațiile 0005–0009 și `docs/untangle-db.md`. Dacă verdictul nu blochează, PM le aplică pe proiectul de probă `enqnxbktjwcqydghvenu` (`db:reset:dev`) și rulează `db:test`, care trebuie să treacă integral. `supabase/types.ts` se regenerează cu `npm run db:types`. Abia după aceea începe construcția.

## Scop
Pe Prezentare, sub KPI-uri, e graficul rezervărilor:
- rânduri pe unități, grupate pe proprietate (grupul se poate plia), coloane pe zile, cu vedere de 7, 14 sau 30 de zile;
- butoanele ‹ Azi ›, filtru pe proprietate, linia „azi” și weekendurile nuanțate;
- bare de la check-in până la ziua dinaintea check-out-ului, colorate după stare: confirmată plin bleumarin, `hold` hașurat, blocată sau iCal nisip. O iconiță arată sursa;
- clic pe o bară deschide panoul lateral cu detaliile, doar pentru citire;
- alături, lista „Sosiri următoare” (5 rânduri) și ocuparea pe proprietăți.

Clic și tragere pe zilele libere ale unei unități deschide formularul scurt: nume, email, telefon, adulți, copii și sumă în lei. Se trimite prin `create_manual_booking`, iar rezervarea apare imediat (optimist) în grafic și în KPI. Datele vin din `dashboard_chart(p_from, p_to, p_property_id)`. Pe telefon graficul se derulează orizontal, coloana cu unități rămâne fixă, iar formularul se deschide ca foaie de jos.

## Verificări
1. Pentru owner1 graficul arată exact barele din `dashboard_chart` pe interval, iar o bară se termină înaintea zilei de check-out.
2. Rezervarea manuală nouă apare ca bară și schimbă KPI-ul fără reîncărcare. După reîncărcare e tot acolo.
3. Pe o suprapunere apare mesaj în română (`booking_overlap`), iar bara optimistă dispare. Tot în română sunt erorile pentru date invalide, oaspete invalid și sumă invalidă.
4. „450,50” lei se salvează ca 45050 bani. Adulți ≥ 1, copii ≥ 0. Zod validează pe server, iar organizația se ia din sesiune.
5. owner2 nu vede nicio bară a lui owner1. Un `p_property_id` străin dă listă goală sau eroare, nu date.
6. Navigarea ‹ Azi ›, schimbarea vederii 7/14/30 și filtrul păstrează starea în URL (`?de=&zile=&proprietate=`).
7. Tastatură: Tab ajunge pe bare, Enter deschide detaliile, Esc închide panoul. Barele au `aria-label` cu numele oaspetelui și datele.
8. Capturi la 1440, 768 și 390, zi și noapte. Fără scroll orizontal pe pagină, doar în interiorul graficului. 30 de zile × 6 unități se desenează în sub 100 ms (măsurat). Consola fără erori.
9. `npm run lint`, `typecheck`, `build`, `test:e2e` și `db:test` trec. `/` neschimbată.

10. Action-ul cheamă `requireViewer()` înainte de RPC. Zod e `.strict()` și primește doar unit_id, date, nume 1–80, email opțional, telefon ≤ 32, adulți 1–20, copii 0–20 și sumă. `organization_id`, `status` sau `source` trimise de client nu au efect. Un `unit_id` al altei org dă `unit_not_found` în română și nu creează niciun rând. Nicio eroare Postgres brută nu ajunge în UI sau în payload. Se verifică printr-o cerere directă din Playwright și prin vitest pe schemă.
11. Parsare lei: „450,50”, „450”, „1.234,50” și „450.50” dau 45050, 45000, 123450 și 45050. „450,505”, „-1”, „abc” și orice sumă peste 2147483647 sunt refuzate cu `invalid_amount`. `check_out > check_in`, maxim 366 de nopți. Vitest.
12. Europe/Bucharest: nopțile cu schimbare de oră, 29 martie și 25 octombrie, dau 7 coloane distincte. Calculele de zile se fac pe șiruri sau în UTC, niciodată cu +86400000 pe ora locală. Tragerea peste zilele 10–12 trimite check_out=13. „Azi” vine de pe server (`bucharest_today()`). Cu `timezoneId` America/New_York se vede aceeași zi „azi”.
13. Concurență: două taburi rezervă aceeași unitate peste aceleași zile și în DB rămâne exact 1 rând. Tabul care pierde arată `booking_overlap`, iar bara optimistă și KPI-ul revin la valorile de dinainte. Dublu-clicul creează o singură rezervare. Abort sau eroarea 500 fac rollback și formularul își păstrează datele. După succes există 1 bară, nu două, inclusiv după reîncărcare.
14. Margini: o rezervare care trece de capătul ferestrei apare tăiată la margine, iar una cu `check_out = de` nu apare. Un hold activ e hașurat și blochează. Un hold expirat nu apare și nu blochează. Valori URL greșite revin la valorile implicite, fără 500. O proprietate străină nu arată nicio unitate.
15. Fiecare navigare face 1 apel `dashboard_chart` și 1 interogare de unități. Mediana a 5 montări ale graficului de 30×6 în build-ul de producție e sub 100 ms. Tragerea de 2 secunde nu produce long task-uri peste 50 ms. Verificarea 9 include și `npm test`.

## Rămase din brief 02 (QA: pass with notes)
- web-engineer:
  - `Sidebar.tsx:157`: `submitted` revine la false dacă ieșirea din cont eșuează;
  - `server.ts:14`: `x-forwarded-proto` tratat ca în Next (`includes('https')`);
  - `KpiCards.tsx:24`: în loc de NBSP literal, `" "`.
- frontend-tester:
  - `03-kpi.spec.ts:24`: venitul calculat din datele seed, nu un literal care se strică la schimbarea lunii;
  - `12-cookie-secrete.spec.ts:19`: testul pică dacă nu verifică niciun fișier.

## Team
- **qa-reviewer** #untangle: recenzia migrațiilor 0005–0009, doar citire, înainte de construcție
- **web-engineer** (opus / high: grafic nou cu selecție prin tragere): `src/app/dashboard/page.tsx`, `src/app/dashboard/actions.ts`, `src/components/dashboard/chart/`, `src/components/dashboard/booking/`, `src/components/dashboard/KpiCards.tsx`, `src/components/dashboard/Placeholders.tsx`, `src/lib/dates/`, `messages/ro.json` (doar `Dashboard.*`), `src/app/globals.css` (doar adăugare)
- **frontend-tester**: `e2e/`, `docs/briefs/03-capturi/`
- **qa-reviewer** și **design-reviewer**: verdict după teste
