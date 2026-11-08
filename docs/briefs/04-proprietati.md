# Brief 04: proprietăți, unități, poze, prețuri (pașii 5–7 din PLAN-DASHBOARD)

Plan: `docs/PLAN-DASHBOARD.md` §3 pașii 5–7 și regulile de sub tabel. Contractul bazei: `docs/DB.md` (tabelele există deja, cu RLS; `reorder_photos` există). Pornește din brief 03: shell, `src/lib/supabase/`, `Sheet.tsx`, `parseLei` din `booking/schema.ts`.

## Scop
`/dashboard/proprietati`:
- listă de carduri: copertă, nume, oraș, nr. unități, stare activă / ascunsă;
- butonul „Adaugă proprietate”.

`/dashboard/proprietati/[id]` are taburi în URL (`?tab=`): Detalii, Unități, Poze, Prețuri.
- **Detalii**: nume, descriere, adresă, oraș, pin pe hartă (maplibre, deja instalat), ore check-in/out, instrucțiuni de check-in (private), facilități (bife dintr-o listă fixă), activă / ascunsă. Slug generat din nume, unic, editabil.
- **Unități**: listă cu ordinea prin tragere (`position`) și formular: nume, tip, capacitate, dormitoare, paturi, băi, m², descriere, facilități, publicată da/nu, preț de bază în lei.
- **Poze**: încărcare multiplă în bucket-ul `photos`, la calea `<org>/<property>/<uuid>.webp`, redimensionate în browser (canvas, max 2000 px, WebP). Ordinea prin tragere se salvează prin `reorder_photos`. Coperta, alt text obligatoriu, ștergere (rândul și fișierul), poza legată opțional de o unitate.
- **Prețuri** pe unitate: bază, weekend (vineri și sâmbătă noapte), sezoane cu interval de date, preț și nopți minime. O previzualizare arată prețul pe noapte pentru următoarele 30 de zile, cu aceeași regulă ca în baza de date (vezi brief 05: sezon > weekend > bază).

Pe telefon: formularele sunt pe o coloană, iar taburile se derulează orizontal. Fiecare salvare e un server action cu zod `strictObject` și `requireViewer()`, iar organizația vine din sesiune.

## Rămase din brief 03
- Pe o bară iCal sub 3 nopți se vede doar iconița.
- Contul fără unități deschide pe telefon 7 zile.
- „Direct” și „Alt calendar” se scriu cu majusculă.

## Verificări
1. owner1 adaugă o proprietate: apare în listă și în filtrul graficului. owner2 nu o vede, nici prin URL direct (404).
2. O unitate nouă apare ca rând în grafic. Prețul „450,50” se salvează ca 45050. O unitate cu rezervări nu se poate șterge: apare un mesaj în română, nu eroarea Postgres.
3. Ordinea unităților și a pozelor rămâne după reîncărcare. Coperta e una singură.
4. Poze:
   - Fișierul original de 11 MB, un PDF sau un SVG sunt refuzate cu mesaj **înainte** de redimensionare. Același fișier urcat direct în Storage (fără UI) e refuzat de bucket.
   - O poză JPEG de 4000 px ajunge în Storage sub 2000 px, ca WebP.
   - La ștergere dispare și fișierul.
   - owner2 nu poate citi fișierele lui owner1.
5. Prețuri:
   - Un sezon cu `date_to <= date_from` e refuzat. Ecranul arată ultima noapte (inclusiv), dar în bază `date_to` e exclusiv: sezonul 1–31 aug se salvează cu `date_to` = 1 sept.
   - Două sezoane care se suprapun pe aceeași unitate: câștigă cel cu prioritatea mai mare, iar dacă au aceeași prioritate, salvarea e refuzată cu mesaj. Refuzul e în server action, pentru că baza nu are constraint pentru asta. Cel mult o regulă weekend pe unitate.
   - Previzualizarea pe 30 de zile se potrivește cu `public_quote` din brief 05 pe 3 cazuri, verificat după ce 0010 e pe proiectul de probă.
6. Slug duplicat, inclusiv unul al altei firme (ascuns prin RLS, deci se tratează 23505): se propune automat `-2`. Diacriticele se transliterează: „Casa Ștefăniță” → `casa-stefanita`. Câmpurile de text au limite de lungime, iar zod refuză orice cheie în plus (`organization_id` trimis de client nu are efect).
7. Capturi la 1440, 768 și 390, zi și noapte, pentru listă și pentru fiecare tab. Fără scroll orizontal pe pagină. Axe fără erori serioase. Consola curată.
8. `lint`, `typecheck`, `build`, `test`, `test:e2e` trec, iar `/` rămâne neschimbată.
9. owner2 trimite la fiecare server action (proprietate, unitate, preț, poză, ordine, copertă) id-uri ale lui owner1: nimic nu se schimbă și primește „nu există”. 0 rânduri modificate înseamnă eroare, nu succes tăcut.
10. După salvare, `anon` nu poate citi `checkin_instructions`, iar textul nu apare pe `/`.
11. La o proprietate ascunsă sau o unitate nepublicată, `anon` nu mai vede rândurile (properties, units, unit_prices, photos) și nici fișierele.
12. Storage:
   - o cale cu altă firmă, altă proprietate, `..` sau alt nume decât `<uuid>.webp` e refuzată;
   - dacă rândul din `photos` nu se scrie, fișierul urcat se șterge;
   - WebP-ul salvat nu are EXIF sau GPS.
13. Ștergerea unei unități fără rezervări șterge și fișierele pozelor ei. După orice ștergere, pozițiile rămân 0..n-1. Fără copertă, cardul nu se strică.
14. Valori:
   - tipul are exact valorile din enum: `camera`, `apartament`, `garsoniera`, `casuta`;
   - capacitatea 0, lat/lng în afara intervalului, un preț negativ, „abc” sau o sumă peste 21.000.000 lei primesc mesaj în română, nu eroare Postgres;
   - facilitățile acceptă doar cheile din lista fixă.
15. O unitate nouă și prețul ei de bază (> 0) se salvează împreună. O unitate fără preț de bază nu poate fi publicată.
16. Ordinea unităților după tragere: pozițiile 0..n-1, fără dubluri, și după două trageri rapide una după alta.

## Team
- **web-engineer** #proprietati (opus / high: formulare noi, upload și tragere): `src/app/dashboard/proprietati/`, `src/components/dashboard/property/`, `src/components/dashboard/photos/`, `src/components/dashboard/prices/`, `src/lib/images/`, `src/components/dashboard/chart/` (doar cele 3 rămase), `messages/ro.json` (doar `Dashboard.*`), `src/app/globals.css` (doar adăugare)
- **frontend-tester**: `e2e/` (fișiere noi 19+), `docs/briefs/04-capturi/`
- **qa-reviewer** și **design-reviewer**: verdict după teste
