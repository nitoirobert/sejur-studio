# Brief 05: contractul de rezervare cu site-ul public (baza de date)

Site-ul lui Robert rezervă doar prin funcțiile de mai jos și nu scrie direct în tabele. Prețul se calculează doar în bază: suma trimisă de client e ignorată. Contractul se scrie întâi în `docs/DB.md`, la secțiunea nouă „Rezervare publică”, iar Robert îl citește înainte să lege pagina.

## Funcții noi (migrația `0010_public_booking.sql`)
1. **`public_quote(p_unit_id, p_check_in, p_check_out, p_adults, p_children)`**
   - Întoarce: nights, total (bani), currency, nightly (jsonb: dată → preț), ok, reason.
   - Prețul pe noapte: sezonul cu prioritatea cea mai mare care cuprinde noaptea, altfel weekendul (nopțile de vineri și sâmbătă), altfel prețul de bază.
   - Cazurile refuzate, fiecare cu `ok=false` și motivul lui:
     - unitate nepublicată sau proprietate ascunsă: `unit_not_found`;
     - prea multe persoane față de `max_guests`: `too_many_guests`;
     - sub nopțile minime ale oricărei reguli aplicate: `min_nights`;
     - zile ocupate: `unavailable`;
     - check-in înainte de azi (Europe/Bucharest) sau peste 366 de nopți: `invalid_dates`;
     - unitate fără preț de bază: `no_price`.
   - Se poate apela ca `anon`.
2. **`create_public_booking(p_unit_id, p_check_in, p_check_out, p_full_name, p_email, p_phone, p_adults, p_children)`**
   - Recalculează prețul prin `public_quote` și creează în aceeași tranzacție oaspetele și rezervarea: `hold`, sursa `direct`, `hold_expires_at = now() + 24h`.
   - Întoarce `booking_id`, `public_token`, total și `hold_expires_at`.
   - Emailul și telefonul sunt obligatorii, cu limite: nume 1–80, email ≤ 254, telefon ≤ 32, adulți 1–20, copii 0–20.
   - Anti-abuz în bază: cel mult 3 hold-uri active pe același email, cel mult 20 pe unitate și cel mult **30 de nopți** pe un hold public. Limita pe IP și Turnstile stau la Robert, în server action. Baza vede doar IP-ul serverului Vercel, deci acolo nu are sens. Peste limită întoarce `too_many_requests`.
   - Se poate apela ca `anon`.
3. **`public_booking_status(p_token)`**: doar starea, datele, numele proprietății și al unității, plus totalul. Fără date de contact. Se poate apela ca `anon`.
4. **`confirm_booking(p_booking_id)`** și **`decline_booking(p_booking_id)`**
   - Doar pentru proprietar (`authenticated`, aceeași organizație).
   - Confirmarea trece `hold` în `confirmed` și șterge `hold_expires_at`. Refuzul trece rezervarea în `cancelled`.
   - Mai târziu webhook-ul Stripe va confirma la fel, după avansul plătit (brief 07).
5. **`create_manual_booking`** primește aceleași limite de lungime și număr, plus maximum 366 de nopți (amânat din brief 03).
6. Jobul `pg_cron` care cheamă `expire_holds()` la fiecare 5 minute, dacă extensia e disponibilă pe planul gratuit. Dacă nu e, notează asta în `DB.md`.

7. Pentru brief 04 (panou):
   - `reorder_units(p_property_id, p_unit_ids)` lucrează ca `reorder_photos`;
   - `save_unit(...)` creează sau editează unitatea împreună cu prețul ei de bază, într-o tranzacție;
   - o unitate nu poate fi publicată fără un preț de bază > 0.
   - Politica Storage limitează scrierea la `<org>/<proprietatea ei>/<nume>.webp` (pentru verificarea 12 din brief 04).
   Toate sunt `security invoker`, pentru proprietar. Semnăturile se trimit devreme lui web-engineer.

Cele 3 funcții publice și confirm/decline sunt `security definer`, iar `create_manual_booking` rămâne `security invoker` (0008). Toate au `set search_path = ''` și un `grant execute` explicit (vezi DB.md, „Drepturi pe funcții”). Erorile se întorc ca text cu cod, nu ca mesaje Postgres brute.

## Verificări (pgTAP, `supabase/tests/14_public_booking.test.sql`)
1. Prețul aplică ordinea sezon > weekend > bază. Cazurile se aleg după ziua săptămânii (vinerea următoare, o duminică, o noapte din sezonul unității 4), ca să nu depindă de data rulării. Granițe:
   - noaptea `date_to` a sezonului are deja preț normal;
   - check-in vineri, 1 noapte = weekend;
   - check-in duminică = bază;
   - unitatea 1, vineri, 1 noapte → `min_nights`.
2. Fiecare motiv de refuz din `public_quote` are un test.
3. `create_public_booking`:
   - o sumă trimisă de client nu există ca parametru;
   - totalul salvat este egal cu cel din `public_quote`;
   - două apeluri pe aceleași zile lasă exact 1 rând, iar al doilea primește `unavailable`.
4. Ca `anon`:
   - nu poate apela `confirm_booking`, `decline_booking`, `create_manual_booking` sau `dashboard_chart`;
   - nu poate scrie direct în `bookings` sau `guests`;
   - nu poate citi `bookings` sau `guests` direct;
   - `public_booking_status` cu un token greșit nu întoarce nimic.
5. owner2 nu poate confirma sau refuza o rezervare a lui owner1 (`booking_not_found`).
6. Limitele anti-abuz se declanșează la al 4-lea hold pe același email (fără diferență între litere mari și mici, după `trim`) și la al 21-lea pe aceeași unitate.
7. Toate testele vechi (269) trec în continuare.

8. Enumerare: o unitate inexistentă, una nepublicată și una dintr-o proprietate ascunsă primesc același `unit_not_found`, verificat primul. La fel la `create_public_booking`.
9. Ordinea motivelor e fixă și scrisă în DB.md.
   - `invalid_dates` se dă și pentru `check_out <= check_in`, pentru NULL și pentru peste 30 de nopți pe un hold public.
   - Check-in azi e acceptat.
   - Persoanele (adulți + copii) se compară cu `max_guests`; 0 adulți e refuzat.
10. Un hold expirat, dar nemăturat, lasă zilele libere: `create_public_booking` cheamă întâi `expire_holds(unit)`, iar `public_booking_status` arată `expired`.
11. Două sezoane cu aceeași prioritate pe aceeași noapte, sau două reguli weekend: rezultatul e determinist (câștigă `created_at` cel mai nou), regulă scrisă în DB.md.
12. `confirm_booking` merge doar pe un `hold` viu.
    - Un hold expirat întoarce `hold_expired`.
    - Orice altă stare întoarce `invalid_status`.
    - `decline_booking` merge doar pe `hold`.
13. `public_booking_status` nu întoarce email, telefon, `checkin_instructions`, `organization_id` sau `guest_id`. Un token malformat primește același răspuns gol ca unul greșit, nu 22P02.
14. `has_function_privilege`:
    - `anon` are EXECUTE doar pe cele 3 funcții publice și pe `public_busy_ranges`;
    - confirm și decline merg doar pentru `authenticated`;
    - `PUBLIC` nu are nimic;
    - `anon` și `authenticated` nu pot apela `cron.schedule`.
15. Totalul se calculează în bigint, fără eroarea 22003 brută. Un email fără „@” sau un telefon cu litere dau `invalid_guest`. Textele se salvează după `trim`. Un preț de bază 0 dă `no_price`.
16. pg_cron are un singur job, `expire-holds`, la `*/5 * * * *`. Migrația rulată de două ori nu dublează jobul.
17. DB.md are secțiunea „Rezervare publică” (semnături, coloane, motive, limite, drepturi), iar `supabase/types.ts` e regenerat.

Rulare fără Docker:
- Migrația se aplică pe proiectul de probă cu `npx supabase db push` (proiectul legat `enqnxbktjwcqydghvenu`).
- Testele pgTAP se rulează prin Management API: `POST https://api.supabase.com/v1/projects/enqnxbktjwcqydghvenu/database/query` cu `SUPABASE_ACCESS_TOKEN`, fiecare fișier învelit în `begin … rollback`.
- Docker Desktop nu se pornește.

## Team
- **db-architect** #contract (opus / high: funcții publice, securitate): `supabase/migrations/0010_public_booking.sql`, `supabase/tests/14_public_booking.test.sql`, `supabase/seed.sql` (doar prețuri de test), `supabase/types.ts`, `docs/DB.md`
- **qa-reviewer**: verdict pe migrație înainte de push, apoi pe teste
