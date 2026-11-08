# Brief 03: runda 1 de reparații (8 nov)

Stare:
- e2e: 122 din 123 trec.
- QA a blocat graficul pe un test cu race, iar codul în sine ar fi „pass with notes”. Design a blocat pentru că importurile din Booking arată ca date stricate și numele unităților sunt tăiate pe telefon.
- Arborele e pe `untangle-db`, cu brief 02 și 03 necomise. Nu schimbați ramura și nu faceți commit.

## web-engineer (fișierele din `## Team` al brief 03, plus `Sheet.tsx`, `OverviewProvider.tsx`, `schema.ts`, `load.ts`)
Design (BLOCK):
1. **Rezervările blocate sau importate din iCal** (`BookingDetails.tsx:28,41-49`, `ChartGrid.tsx:345,390`):
   - titlul devine „Blocată · Booking.com” (sau numele sursei);
   - oaspeții și suma se ascund;
   - eticheta barei arată sursa, nu „Fără nume”.
2. **Coloana unităților** (`ChartGrid.tsx:99,158,262`): la 390, numele pe 2 rânduri la ~13px; de la xl, coloana de 14–15rem.

Design (note):
3. Pe telefon, rândul cu „Salvează rezervarea” rămâne lipit jos în foaie (`BookingForm.tsx:318`).
4. Pe telefon (<md), vederea implicită e de 7 zile, dacă `zile` lipsește din URL.
5. Booking.com și Airbnb au iconițe diferite pe bară (`ChartGrid.tsx:355`).
6. Sosirile și ocuparea stau pe două coloane doar de la lg (`BookingChart.tsx:208`).
7. Etichetele de stare încep cu majusculă din text, nu din CSS (`BookingDetails.tsx:72`, `BookingChart.tsx:331`).
8. Starea „Încă nu ai unități” are un link spre Proprietăți.
9. Un fade pe marginea dreaptă când graficul se poate derula.
10. Ocuparea are aceeași precizie peste tot: întreg.

QA:
11. `BookingChart.tsx:32`: `performance.mark` doar în browser.
12. `schema.ts:40`: o singură grupă cu punct fără virgulă („450.505”, „1.500”) se refuză cu `invalid_amount`. „1.234,50” rămâne valid.
13. `OverviewProvider.tsx:58-61`: erorile de redirect se aruncă mai departe (`unstable_rethrow` sau `isRedirectError`).
14. `Sheet.tsx:64,74`: foaia nu se închide cât timp se salvează.
15. Mărunțișuri:
    - `KpiCards.tsx:26`: `" "`;
    - `schema.ts:66`: numele fără caractere de control;
    - `ChartGrid.tsx:101`: rolul `table`, fără grid;
    - `load.ts:23-30`: „azi” vine dintr-un apel paralel sau din `bucharest_today`, nu înlănțuit după KPI.
    - Sosirile următoare nu se schimbă acum; rămân pentru brief-ul următor.

## frontend-tester (`e2e/`, `docs/briefs/03-capturi/`)
1. `14-rezervare.spec.ts:58-62` și `:125`: înainte de citirea din DB se așteaptă `booking-saved` sau să nu mai existe `[data-optimistic]`. `afterEach` nu șterge înainte de commit.
2. `:154-158`: dublu-clicul numără POST-urile action și se așteaptă exact 1.
3. `:144`: KPI-ul ambelor taburi se citește înainte de trimitere.
4. Un caz pentru `invalid_dates` (mesajul în română), unul pentru „450.505” refuzat și unul pentru foaia care nu se închide cât timp se salvează.
5. `17-capturi-perf.spec.ts:146`: dacă numărul de interogări de pe server nu se poate verifica, o notă cinstită în test, fără assert fals. Fără gărzile `if` moi din `13:54` și `17:43`.
6. Capturile se refac cu `locale: "ro-RO"`, `timezoneId: "Europe/Bucharest"` și un nume realist de oaspete, de exemplu „Ioana Marin”.

## Amânat (brief 04, db-architect)
`create_manual_booking` fără limite pe lungimea numelui, nopți și adulți, când e apelat direct.

## Rezultat (8 nov)
- e2e: 130 din 130. Design: pass with notes. QA: blocajul de la `Sheet.tsx` e reparat și dovedit de teste.
- Rămân pentru brief 04:
  - o bară iCal de 2 nopți afișează „Bo…”, așa că sub 3 nopți se arată doar iconița;
  - pe telefon, contul fără unități deschide 14 zile, nu 7;
  - etichetele „direct” și „alt calendar” se scriu cu majusculă;
  - limite în `create_manual_booking` (db-architect).
