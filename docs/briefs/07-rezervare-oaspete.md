# Brief 07: rezervarea oaspetelui, contul oaspetelui, fluxul complet al gazdei

Cerut de Taka pe 9 nov 2026. Plata cu cardul, emailurile, mesajele, recenziile, anularea și paginile legale vin în briefurile 08–11. Aici rezervarea e o **cerere**: un hold de 24 de ore pe care gazda îl confirmă sau îl refuză.

## Scop
1. Pe `/cazare/[id]` oaspetele alege camera, datele și numărul de oaspeți, vede prețul calculat de bază (`public_quote`), apoi trimite nume, email și telefon prin `create_public_booking`. Primește o pagină de stare `/rezervare/[token]` (`public_booking_status`). Merge fără cont. Cu cont, cererea e legată de contul lui.
2. Contul oaspetelui: `/cont/rezervari` (rezervările mele, cu starea fiecăreia) și `/cont/favorite` (o inimă pe cardul cazării și pe pagina ei).
3. Gazda vede cererile noi în panou (insignă în meniu, listă „De confirmat” pe `/dashboard/rezervari`) și le confirmă sau le refuză (`confirm_booking`, `decline_booking`). Totul e optimist și în română.

## Verificări de acceptare
1. Oaspete fără cont, telefon 390 și calculator 1440: alege datele și persoanele, vede prețul pe nopți, trimite cererea, ajunge pe pagina de stare „În așteptare”. Zilele apar ocupate pentru alt oaspete.
   - Lățimi exacte: 390×844 și 1440×900; la 390 fără scroll orizontal (`scrollWidth <= clientWidth`), formularul și butonul de trimitere vizibile fără zoom.
   - Unitatea: o unitate seed publicată a lui owner1 (`OWNER1_UNITS`), cu preț de bază; datele din `freeRange(unit, azi + 30, 2)`, niciodată date fixe. Prețul afișat pe nopți = `nightly` din `public_quote` pentru aceleași date (comparat, nu scris de mână).
   - Datele oaspetelui: nume `E2E Oaspete <runTag>`, email unic `e2e+g<runTag>@example.com`, telefon `+40 712 345 678`.
   - „Ocupat pentru alt oaspete”: context nou de browser (fără cookie-uri), aceleași date → zilele apar indisponibile și trimiterea dă mesajul pentru `unavailable`.
   - Pagina de stare: token greșit sau malformat → mesaj „nu am găsit rezervarea”, nu eroare 500. Pagina nu arată email, telefon sau nume.
2. Erorile bazei (`unavailable`, `too_many_guests`, `invalid_guest`, `too_many_requests`, `invalid_dates`) apar ca mesaje românești clare, fără text tehnic.
   - Câte un caz pe cod, provocat din UI unde se poate (persoane peste `max_guests`, email greșit, check-out înainte de check-in), altfel interceptat la server action cu răspunsul codului. Și `unit_not_found`, `min_nights`, `no_price` au mesaj.
   - `too_many_requests`: 3 cereri cu același email pe 3 intervale libere, a 4-a e refuzată; emailul e unic pe rulare ca să nu se adune între rulări.
   - Textul afișat nu conține codul (`unavailable`, `P0001`, `23P01`), nici „error”/„null”; are diacritice cu virgulă (ș ț).
3. Oaspete cu cont: cererea apare în `/cont/rezervari`. Un alt cont nu o vede. Anon nu poate citi rezervările altcuiva (test pgTAP).
   - Două conturi oaspete `e2e+guest-a<runTag>` / `e2e+guest-b<runTag>@example.com`, create cu cheia admin (email confirmat) și intrate o singură dată, ca să nu ardem limita de autentificare (30 / 5 min).
   - În listă: proprietatea, datele, starea în română („În așteptare”, „Confirmată”, „Anulată”, „Expirată”); la 390 și 1440.
4. Favorite: adaugă sau scoate din favorite, iar lista rămâne după reîncărcare. Fără cont, inima deschide fereastra de intrare în cont.
   - Inima pe card (pagina de căutare) și pe `/cazare/[id]`; starea e aceeași în ambele locuri după reîncărcare.
   - Clic dublu rapid nu lasă două rânduri (verificat cu cheia admin) și nici o inimă greșită.
   - Ștergerea contului e2e șterge și favoritele lui (cascadă), verificat în teardown.
5. Gazda: insigna arată numărul de cereri, „Confirmă” trece rezervarea în confirmată (grafic + pagina de stare a oaspetelui), „Refuză” o anulează. Un hold expirat apare ca expirat. O gazdă nu vede cererile altei gazde.
   - Insigna: numărul citit înainte (N), +1 după o cerere nouă, −1 după confirmare; nu se compară cu o cifră fixă (seed-ul are deja hold-uri).
   - Expirarea fără așteptare de 24 h: testul pune `hold_expires_at = now() − 1 min` cu cheia admin (nu așteaptă jobul pg_cron) → panoul și pagina de stare arată „Expirată”, „Confirmă” dă mesajul pentru `hold_expired`. Ora din UI („expiră în …”) se verifică cu `page.clock` fixat, nu cu ceasul real.
   - Izolare: owner2 nu vede în listă și nu poate confirma (apel direct → `booking_not_found`) cererea pe unitatea lui owner1.
   - UI optimist: butonul se dezactivează la clic; un clic dublu nu dă eroare.
6. **Fluxul complet al gazdei**, cap-coadă într-un singur test e2e: cont nou → proprietate → cameră → poze → preț → publicare → oaspetele o găsește pe site → cere → gazda confirmă → apare în grafic și în cifre.
   - Cont `e2e+<timestamp>@example.com`, proprietate `E2E Flux <runTag>`, o poză generată în test (ca în `20-poze.spec.ts`); doar 1440 (390 e acoperit de 1 și 5). Timeout propriu de 180 s.
   - Condiție: `/cazare/[id]` citește azi din `src/lib/mock-units` (pagini statice). O unitate publicată în test trebuie să se deschidă pe site **fără rebuild** (pagină dinamică sau revalidare), altfel verificarea nu se poate face.
   - „În cifre”: KPI-ul de venit sau de ocupare se schimbă față de valoarea citită înainte de confirmare.
7. Prețul nu vine niciodată din browser. Limita pe IP stă în server action. axe fără erori pe paginile noi. 0 erori în consolă.
   - Preț: cererea trimisă cu un câmp `total`/`price` modificat (interceptat) → `total_amount` din bază = totalul din `public_quote`.
   - Limita pe IP: pragul și fereastra se citesc din env; testele rulează de pe același IP, deci e nevoie de o cale de resetare sau un prag mare în mediul de test, plus un test care atinge pragul și vede mesajul românesc.
   - Turnstile (dacă intră acum): cheile de test Cloudflare care trec mereu în `.env.test.local`.
   - axe pe `/cazare/[id]` cu formularul deschis, `/rezervare/[token]`, `/cont/rezervari`, `/cont/favorite`, `/dashboard/rezervari`, la 390 și 1440. Consola ascultată pe tot fluxul (0 `error`, 0 `pageerror`).
8. typecheck, lint, unit, build, pgTAP și întreaga suită e2e trec.
   - Suita e2e trece de 2 ori la rând pe același proiect (fără date rămase între rulări), cu `workers: 1` și `retries: 0`.
9. Curățenie după e2e: teardown-ul șterge toți oaspeții „E2E …” cu rezervările lor (inclusiv cele create de `create_public_booking`), toate conturile `e2e+…` cu favoritele lor și proprietățile „E2E …”; owner1/owner2 și rezervările seed rămân neatinse (numărul de rezervări seed e același înainte și după).
10. Capturi pentru fiecare stare raportată (formular, preț, stare „În așteptare/Confirmată/Expirată”, erori, cont, favorite, panou cu insignă), la 390 și 1440, în `docs/briefs/07-capturi/`.

### Verificările qa-reviewer (gate 2), pe scurt; textul complet în raportul lui
11. Legarea cererii de cont doar prin `auth.uid()` citit în `create_public_booking`: fără `p_user_id`, fără legare după email, niciodată. pgTAP: cererea fără cont pe emailul X nu apare la contul X; contul A care trimite cu emailul lui B o vede doar A.
12. O singură `create_public_booking` în `pg_proc`; apelată de anon creează cererea fără cont.
13. Server action: client cu sesiune doar dacă `getUser()` întoarce un utilizator, altfel client fără sesiune; `service_role` niciodată pentru rezervare.
14. `my_bookings()`: doar `authenticated` (anon → 42501), filtrează după legătura cu `auth.uid()`, nu după RLS-ul gazdei (owner1 ca oaspete vede doar cererea lui); fără `checkin_instructions`, `organization_id`, `guest_id`, contacte; hold expirat = `expired`; paginat.
15. Nicio politică nouă pe `bookings`/`guests` pentru oaspete; coloana de legătură nu poate fi scrisă de oaspete (pgTAP).
16. `favorites`: RLS select/insert/delete pe `user_id = (select auth.uid())` cu USING + WITH CHECK, fără update; `unique (user_id, unit_id)`, index pe fiecare FK; doar unități publicate din proprietăți active; cascadă la ștergerea contului/unității; gazda nu vede cine i-a dat inimă; 23505 la clic dublu nu ajunge în UI; pgTAP A vs B.
17. Limita pe IP: **5 cereri / IP / oră**, contor într-un tabel din 0013 (nu Map în memorie), apelat de server action printr-o funcție doar pentru `service_role` (singura folosire a cheii de serviciu, doar pentru contor; IP-ul stocat ca hash). IP din `x-vercel-forwarded-for` / `x-real-ip`. Prag și fereastră din env, mare în testele e2e, plus un test care atinge pragul.
18. Validare strictă (zod strictObject): unit_id, check_in, check_out, adulți, copii, nume, email, telefon; `total=1` trimis din browser → totalul din `public_quote`.
19. `/rezervare/[token]`: `Referrer-Policy: no-referrer`, `noindex`, `Cache-Control: no-store`; tokenul nu apare în titlu, loguri sau linkuri externe; token greșit = aceeași pagină „Rezervare negăsită”; `pending_requests` și panoul nu întorc `public_token`.
20. Clic dublu / două taburi pe „Trimite” = o singură rezervare.
21. Confirmă și Refuză în paralel: una câștigă, cealaltă primește `invalid_status` și rândul revine la starea reală; hold expirat nemutat de cron → `hold_expired`, „Cererea a expirat”, butoanele dispar.
22. Insigna = lista „De confirmat” = hold-urile vii ale firmei; `pending_requests()` doar `authenticated`, `is_org_member`, paginat; numărul scade fără reîncărcare.
23. Oaspete pe `/dashboard/rezervari` → `/`; `confirm_booking` de la oaspete → `booking_not_found`; `/cont/*` merg pentru oaspete și gazdă (fără `requireViewer`), fără cont → fereastra de intrare sau `/login?next=` prin `safeNext`; contul din `/cont-nou` primește firmă, cel din fereastra site-ului nu.
24. Mesaje și pentru `unit_not_found`, `no_price`, `min_nights`, `invalid_amount`, `hold_expired`, plus un mesaj general pentru rețea / cod necunoscut.
25. Anon are EXECUTE tot pe exact 4 funcții; funcțiile noi doar `authenticated` (sau `service_role` pentru contor), `search_path = ''`; `05_functions_security.test.sql` actualizat.
26. Zilele și expirarea în `Europe/Bucharest` (test cu `timezoneId: 'America/New_York'`); la #6 se schimbă ocuparea (încasările nu, fără plată).

### Decizie PM (Taka: „fă asta”, rezervarea trebuie să meargă cap-coadă)
Site-ul public trece de pe `src/lib/mock-units` pe baza reală în acest brief: căutarea, harta, `/cazare/[id]` (dinamic, uuid), sitemap și datele structurate citesc unitățile publicate prin clientul fără sesiune. Pozele prin URL semnat. Aspectul paginilor lui Robert rămâne neschimbat; se schimbă doar sursa datelor. Robert e anunțat de Taka.

## Team
- **db-architect**: tabelul `favorites` (user_id, unit_id, RLS doar pe proprii), legarea cererii de contul oaspetelui (`guests.user_id` sau o coloană pe `bookings`) în `create_public_booking`, funcția `my_bookings()` pentru oaspete, funcția `pending_requests()` sau ce mai trebuie panoului. Plus contorul pentru limita pe IP. Căi: `supabase/migrations/0013_guest_booking.sql`, `supabase/tests/17_guest_booking.test.sql`, `supabase/tests/05_functions_security.test.sql`, `supabase/types.ts`, `docs/DB.md`. Trimite contractul (semnăturile) celor doi web-engineers.
- **web-engineer #public**: fluxul de rezervare, pagina de stare, contul oaspetelui, inima. Căi: `src/components/booking/`, `src/app/cazare/[id]/`, `src/app/rezervare/`, `src/app/cont/rezervari/`, `src/app/cont/favorite/`, `src/lib/booking/`, `messages/` (cheile noi în toate cele 6 limbi, inclusiv cele trimise de #panel), sursa de date a site-ului: `src/lib/mock-units.ts`, `src/lib/use-units.ts`, `src/lib/search/`, `src/lib/catalog/` (nou), `src/app/sitemap.ts`, `src/lib/seo/`, `src/components/property/`, `src/app/page.tsx`. În fișierele lui Robert din `src/components/browse/` (`PropertyBrowser.tsx`, `UnitPanel.tsx`, `UnitCard.tsx`, `SiteHeader.tsx`, `AuthModal.tsx`) doar punctul de legătură, fără schimbări de aspect.
- **web-engineer #panel**: cererile în panou. Căi: `src/app/dashboard/rezervari/`, `src/components/dashboard/requests/`, `src/components/dashboard/Sidebar.tsx` (insigna), `src/components/dashboard/booking/`. Cheile de text le trimite lui #public.
- **frontend-tester**: `e2e/25-rezervare-oaspete.spec.ts`, `e2e/26-cont-oaspete.spec.ts`, `e2e/27-flux-gazda.spec.ts`, `e2e/cleanup.teardown.ts`, `e2e/support/`, `docs/briefs/07-capturi/`.
- **qa-reviewer**: verdict, fără scrieri.
