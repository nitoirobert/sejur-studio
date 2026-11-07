# Baza de date (Supabase) — pe scurt

Migrații: `supabase/migrations/0001_core.sql` (tabele), `0002_rls.sql` (securitate), `0003_storage.sql` (poze), `0004_functions.sql` (funcții). Date de test: `supabase/seed.sql`.
Reguli: fiecare tabel are `id uuid`, `created_at`, `updated_at` (se schimbă singur la update) și RLS. Banii sunt **întregi în bani** (1 leu = 100), cu `check (>= 0)`, moneda implicită `RON`. Datele sunt `date`; o rezervare ocupă `[check_in, check_out)` (ziua plecării e liberă).

## Tabele

| Tabel | Ce ține |
|---|---|
| `organizations` | firma proprietarului: name, slug, country, date de facturare (legal_name, cui, reg_com, billing_address), stripe_account_id |
| `organization_members` | cine aparține firmei (user_id, role `owner`) |
| `profiles` | profilul contului: full_name, phone |
| `properties` | proprietatea: nume, slug (unic), descriere, adresă, oraș, lat/lng, ore check-in/out, `checkin_instructions` (privat), politică de anulare, facilități (`amenities` jsonb), `status` `activa` / `ascunsa` |
| `units` | unitatea: tip (`camera`, `apartament`, `garsoniera`, `casuta` — ca în `mock-units.ts`), max_guests, bedrooms, beds, bathrooms, area_m2, descriere, facilități, position, `is_published` |
| `unit_prices` | prețuri pe noapte (bani): `base` (una pe unitate), `weekend`, `season` (cu date_from/date_to), min_nights, priority |
| `photos` | poze: property_id, unit_id (opțional), storage_path (obligatoriu `<organization_id>/<property_id>/<fișier>` al aceluiași rând), position (0..n-1), is_cover (max una pe proprietate), alt |
| `guests` | oaspete, GDPR minim: doar full_name, email, phone |
| `bookings` | rezervarea: unit, guest (se pune null dacă oaspetele e șters), check_in/check_out, `stay` (generat), status, source, adulți, copii, total_amount, hold_expires_at, câmpuri Stripe, public_token |
| `payments` | plăți (scrise doar de webhook-ul Stripe): amount, refunded_amount, status, id-uri Stripe |
| `cancellation_policies` | reguli de rambursare (jsonb) |
| `ical_feeds` | feed-uri iCal importate pe unitate |
| `sync_conflicts` | suprapuneri găsite la sincronizarea iCal |

Fiecare rând copil primește automat `organization_id` de la părinte (trigger `enforce_organization`); un rând legat de altă firmă e refuzat (42501).

**Status rezervare:** `hold` (în plată, expiră), `confirmed`, `blocked` (iCal sau blocare manuală), `cancelled`, `expired`. Doar `hold`, `confirmed`, `blocked` ocupă zile: constraint-ul `bookings_no_overlap` refuză suprapunerea pe aceeași unitate (cod `23P01`). **Sursă:** `direct`, `booking`, `airbnb`, `altul`.

**Cont nou:** triggerul de pe `auth.users` creează o organizație nouă, membrul `owner` și profilul. Nu citește firma sau rolul din metadata (doar `full_name`, ca nume).

## Funcții

| Funcție | Cine | Ce face |
|---|---|---|
| `create_manual_booking(p_unit_id, p_check_in, p_check_out, p_full_name, p_email, p_phone, p_adults, p_children, p_total_amount) → uuid` | proprietar | oaspete + rezervare `confirmed` / `direct` într-o tranzacție; întâi trece în `expired` hold-urile expirate ale unității. Erori (mesaj): `unit_not_found`, `invalid_dates`, `invalid_guest`, `invalid_amount`, `booking_overlap` (cod 23P01) |
| `reorder_photos(p_property_id, p_photo_ids, p_cover_id default null)` | proprietar | lista trebuie să conțină exact toate pozele proprietății; poziții 0..n-1; opțional coperta. Erori: `property_not_found`, `photo_set_mismatch` |
| `dashboard_chart(p_from, p_to, p_property_id default null)` | proprietar | rezervările (confirmed, blocked, hold neexpirat) care se suprapun cu `[from, to)`, inclusiv cele începute înainte; max 366 zile. Coloane: booking_id, unit_id, property_id, check_in, check_out, status, source, guest_name, adults, children, total_amount, currency, hold_expires_at |
| `dashboard_kpis(p_day default null)` | proprietar | kpi_day, arrivals_today, departures_today, occupancy_pct, revenue_month, currency (vezi regulile mai jos) |
| `bucharest_today(p_now default now())` | proprietar | data de azi în `Europe/Bucharest` |
| `public_busy_ranges(p_unit_id, p_from, p_to)` | oricine | doar intervalele ocupate `[busy_from, busy_to)` ale unei unități publicate dintr-o proprietate activă; max 400 zile; începutul e tăiat la ieri (Europe/Bucharest), fără istoric |

### Reguli KPI (`dashboard_kpis`)
- **Ziua:** `p_day`, altfel azi în `Europe/Bucharest`.
- **Sosiri / plecări azi:** rezervări `confirmed` sau `blocked` cu `check_in` / `check_out` = ziua.
- **Ocupare (%):** nopți ocupate (`confirmed` sau `blocked`, inclusiv blocările manuale) în `[ziua, ziua + 30)` / (toate unitățile × 30) × 100, o zecimală. Hold-urile nu se numără.
- **Încasări luna aceasta (bani):** suma `amount - refunded_amount` a plăților `succeeded` cu `created_at` în luna calendaristică a zilei, socotită în `Europe/Bucharest` (o plată la 23:30 UTC pe 31 martie intră în aprilie).

### Valori fixe din seed
Ziua A = prima zi a lunii curente (Bucharest). `dashboard_kpis(A)` logat ca `owner1@example.com`:
arrivals_today **3**, departures_today **1**, occupancy_pct **31.7** (57 nopți / 180), revenue_month **808000** bani (8.080 lei).

## Ce citește anon (pagina publică a lui Robert)
- `properties` cu `status = 'activa'`, fără coloana `checkin_instructions` (cere coloanele explicit, nu `select *`).
- `units` publicate ale proprietăților active, `unit_prices` și `photos` ale lor.
- zilele ocupate doar prin `public_busy_ranges(...)`.
- Nimic din: guests, bookings, payments, profiles, organization_members, organizations, ical_feeds, sync_conflicts, cancellation_policies. Nicio scriere.
- Pagina publică folosește un client **fără sesiune** (cheia anon, fără cookie-uri): un proprietar logat vede, ca `authenticated`, doar datele firmei lui.

## Poze (Storage)
Bucket privat `photos`, max 10 MB, doar `image/jpeg`, `image/png`, `image/webp`, `image/avif` (fără SVG). Calea: `<organization_id>/<property_id>/<fișier>`; un rând din `photos` nu poate indica folderul altei firme sau altei proprietăți (constraint `photos_storage_path_owner`). Proprietarul citește/scrie/șterge doar în folderul firmei lui. Anon poate citi (URL semnat) doar fișierele înregistrate în `photos` pentru proprietăți active.

## Conturi de test (seed, doar local / proiect de dev)
`owner1@example.com` (org 1: 2 proprietăți, 6 unități, 22 rezervări pe 60 de zile) și `owner2@example.com` (org 2: 1 proprietate ascunsă). Parola: `Parola-Test-123`.

## Comenzi
`npm run db:reset:dev` (reaplică migrațiile + seed; refuză dacă proiectul legat nu e cel de test `enqnxbktjwcqydghvenu`), `npm run db:test` (teste pgTAP din `supabase/tests/`), `npm run db:types` (scrie `supabase/types.ts`). Supabase CLI v3: scripturile folosesc `--remote` (proiectul legat); cer `SUPABASE_ACCESS_TOKEN` și `SUPABASE_DB_PASSWORD` exportate în shell.

## Drepturi pe funcții
`0002_rls.sql` revocă global (pentru toate schemele) dreptul implicit EXECUTE de la `PUBLIC`. Orice funcție nouă, inclusiv cele adăugate de o extensie, are nevoie de un `grant execute` explicit către `anon` și/sau `authenticated`, altfel nu poate fi apelată.

## Mai târziu
- `public_busy_ranges`: `busy_from` poate dezvălui check-in-ul original al unui sejur lung; de tăiat la începutul ferestrei.
- `cancellation_policies` nu e încă citibil de anon (pagina publică nu poate afișa politica).
- Hold-urile trecute de `hold_expires_at` blochează zilele până devin `expired`; sincronizarea iCal / checkout-ul trebuie să le expire.
- `on delete restrict` pe `bookings` / `payments` poate bloca ștergerea unei organizații.
