# Baza de date (Supabase) — pe scurt

Migrații: `supabase/migrations/0001_core.sql` (tabele), `0002_rls.sql` (securitate), `0003_storage.sql` (poze), `0004_functions.sql` (funcții), `0005`–`0009` (curățare: vezi `docs/untangle-db.md`), `0010_public_booking.sql` (rezervare publică, unități, pg_cron), `0011_photos_hardening.sql` (poze doar WebP cu nume uuid, un singur preț de weekend pe unitate), `0012_guest_accounts.sql` (conturi de oaspete fără firmă), `0013_guest_booking.sql` (cererea legată de cont, favorite, lista de cereri a gazdei, limita pe IP), `0015_avatars.sql` (bucket public `avatars` pentru poza de profil, `<user_id>/avatar.webp`, scrie doar proprietarul; URL-ul stă în `user_metadata.custom_avatar_url`), `0016_guest_profile.sql` (tabel `reviews`: o recenzie pe rezervare, doar autorul rezervării, doar după check-out la o rezervare confirmată, fără citire publică încă; `my_payments()` plățile contului fără id-uri Stripe; `delete_my_account()` refuză conturile de gazdă). Nume, telefon și preferințele de notificare (`notify`) stau în `user_metadata`, fără tabel. Date de test: `supabase/seed.sql`.
Reguli: fiecare tabel are `id uuid`, `created_at`, `updated_at` (se schimbă singur la update) și RLS. Banii sunt **întregi în bani** (1 leu = 100), cu `check (>= 0)`, moneda implicită `RON`. Datele sunt `date`; o rezervare ocupă `[check_in, check_out)` (ziua plecării e liberă).

## Tabele

| Tabel | Ce ține |
|---|---|
| `organizations` | firma proprietarului: name, slug, country, date de facturare (legal_name, cui, reg_com, billing_address), stripe_account_id |
| `organization_members` | cine aparține firmei (user_id, role `owner`) |
| `profiles` | profilul contului: full_name, phone |
| `properties` | proprietatea: nume, slug (unic), descriere, adresă, oraș, lat/lng, ore check-in/out, `checkin_instructions` (privat), politică de anulare, facilități (`amenities` jsonb), `status` `activa` / `ascunsa` |
| `units` | unitatea: tip (`camera`, `apartament`, `garsoniera`, `casuta` — ca în `mock-units.ts`), max_guests, bedrooms, beds, bathrooms, area_m2, descriere, facilități, position, `is_published` |
| `unit_prices` | prețuri pe noapte (bani): `base` (una pe unitate), `weekend` (una pe unitate, din 0011: index unic `unit_prices_one_weekend_idx`, a doua dă 23505), `season` (oricâte) (cu date_from/date_to), min_nights, priority |
| `photos` | poze: property_id, unit_id (opțional), storage_path (obligatoriu `<organization_id>/<property_id>/<fișier>` al aceluiași rând), position (0..n-1), is_cover (max una pe proprietate), alt |
| `guests` | oaspete, GDPR minim: doar full_name, email, phone |
| `bookings` | rezervarea: unit, guest (se pune null dacă oaspetele e șters), check_in/check_out, `stay` (generat), status, source, adulți, copii, total_amount, hold_expires_at (obligatoriu la `hold`), `stripe_checkout_session_id`, public_token, `user_id` (contul oaspetelui care a trimis cererea, din 0013; null fără cont); o rezervare importată are `ical_feed_id` + `external_uid` (unice împreună) |
| `payments` | plăți (scrise doar de webhook-ul Stripe): amount, refunded_amount, status, id-uri Stripe (`stripe_payment_intent_id` e doar aici); starea rambursării e un constraint: `refunded` = toată suma, `partially_refunded` = între 0 și sumă, restul = 0 |
| `cancellation_policies` | reguli de rambursare (jsonb) |
| `ical_feeds` | feed-uri iCal importate pe unitate; `provider` folosește același enum ca `bookings.source`, dar nu poate fi `direct` |
| `sync_conflicts` | suprapuneri găsite la sincronizarea iCal; „rezolvat” = `resolved_at is not null` |
| `favorites` | inimile oaspetelui (0013): user_id, unit_id, unic pe pereche; fiecare cont vede și scrie doar ale lui |
| `rate_limit_hits`, `rate_limit_salt` | contorul limitei pe IP (0013): un rând pe cerere acceptată, IP-ul doar ca hash; nicio rolă API nu le citește |

`organization_id` se trimite **explicit** la fiecare insert pe un tabel copil (NOT NULL). Cheile străine sunt compuse (`(părinte_id, organization_id)`), deci un rând legat de altă firmă e refuzat de bază cu `23503` (nu mai există trigger). Tot așa: poza și unitatea ei sunt în aceeași proprietate; feed-ul, rezervarea și conflictul sunt ale aceleiași unități; `bookings.source` = `provider` al feed-ului. Ștergerea unei unități cu rezervări e refuzată (`23503`); ștergerea unei organizații întregi merge. Cheile de legătură nu se mai pot schimba cât timp sunt folosite (`23503`): o unitate cu poze nu se mută în altă proprietate; `provider` sau `unit_id` al unui feed cu rezervări și `unit_id` al unei rezervări importate sau legate de un conflict rămân fixe. La plăți, `status` și `refunded_amount` se schimbă împreună (`23514` altfel).

**Status rezervare:** `hold` (în plată, expiră), `confirmed`, `blocked` (iCal sau blocare manuală), `cancelled`, `expired`. Doar `hold`, `confirmed`, `blocked` ocupă zile: constraint-ul `bookings_no_overlap` refuză suprapunerea pe aceeași unitate (cod `23P01`). Un `hold` are mereu `hold_expires_at` (`23514` altfel). `status` nu are valoare implicită: fiecare insert îl trimite (`23502` altfel). **Sursă:** `direct`, `booking`, `airbnb`, `altul`.

**Cont nou:** triggerul de pe `auth.users` creează o organizație nouă, membrul `owner` și profilul. Nu citește firma sau rolul din metadata (doar `full_name`, ca nume). Din 0012, un cont de **oaspete** (metadata `account_type = 'guest'`, sau Google / Apple) primește doar profilul, fără organizație.

## Funcții

| Funcție | Cine | Ce face |
|---|---|---|
| `create_manual_booking(p_unit_id, p_check_in, p_check_out, p_full_name, p_email, p_phone, p_adults, p_children, p_total_amount) → uuid` | proprietar | oaspete + rezervare `confirmed` / `direct` într-o tranzacție; întâi trece în `expired` hold-urile expirate ale unității. Limite (0010): date finite (fără `infinity`), max 366 nopți, nume 1–80, email ≤ 254, telefon ≤ 32, adulți 1–20, copii 0–20. Erori (mesaj): `unit_not_found`, `invalid_dates`, `invalid_guest`, `invalid_amount`, `booking_overlap` (cod 23P01) |
| `reorder_photos(p_property_id, p_photo_ids, p_cover_id default null)` | proprietar | lista trebuie să conțină exact toate pozele proprietății; poziții 0..n-1; opțional coperta. Erori: `property_not_found`, `photo_set_mismatch` |
| `reorder_units(p_property_id, p_unit_ids)` | proprietar | ca `reorder_photos`: exact toate unitățile proprietății, poziții 0..n-1. Erori: `property_not_found`, `unit_set_mismatch` |
| `save_unit(...) → uuid` | proprietar | creează sau editează unitatea și prețul ei de bază, într-o tranzacție (vezi „Rezervare publică”) |
| `public_quote`, `create_public_booking`, `public_booking_status`, `confirm_booking`, `decline_booking` | vezi „Rezervare publică” | contractul cu site-ul public |
| `my_bookings`, `pending_requests`, `pending_requests_count`, `is_public_unit`, `rate_limit_hit` | vezi „Oaspete, cereri, limita pe IP (0013)” | contul oaspetelui, cererile din panou, contorul pe IP |
| `dashboard_chart(p_from, p_to, p_property_id default null)` | proprietar | rezervările (confirmed, blocked, hold neexpirat) care se suprapun cu `[from, to)`, inclusiv cele începute înainte; max 366 zile. Coloane: booking_id, unit_id, property_id, check_in, check_out, status, source, guest_name, adults, children, total_amount, currency, hold_expires_at |
| `dashboard_kpis(p_day default null)` | proprietar | kpi_day, arrivals_today, departures_today, occupancy_pct, revenue_month, currency (vezi regulile mai jos) |
| `bucharest_today(p_now default now())` | proprietar | data de azi în `Europe/Bucharest` |
| `expire_holds(p_unit_id default null) → integer` | proprietar, `service_role` (webhook Stripe, cron) | trece în `expired` hold-urile cu `hold_expires_at <= now()` (ale unității, sau toate cele vizibile: proprietarul doar pe ale firmei lui, `service_role` pe toate); întoarce câte. Singurul loc unde se expiră hold-uri: îl apelează și `create_manual_booking`; îl vor apela jobul pg_cron și webhook-ul Stripe |
| `is_live_booking(p_status, p_hold_expires_at) → boolean` | proprietar, `service_role` | „ocupă calendarul acum”: `confirmed`, `blocked` sau `hold` cu `hold_expires_at > now()` (exact complementul lui `expire_holds`); folosită de `dashboard_chart` și `public_busy_ranges`. SQL simplu, fără `SET`, deci planner-ul o inline-ează |
| `public_busy_ranges(p_unit_id, p_from, p_to)` | oricine | doar intervalele ocupate `[busy_from, busy_to)` ale unei unități publicate dintr-o proprietate activă; max 400 zile; începutul e tăiat la ieri (Europe/Bucharest), fără istoric |

### Reguli KPI (`dashboard_kpis`)
- **Ziua:** `p_day`, altfel azi în `Europe/Bucharest`.
- **Sosiri / plecări azi:** rezervări `confirmed` sau `blocked` cu `check_in` / `check_out` = ziua.
- **Ocupare (%):** nopți ocupate (`confirmed` sau `blocked`, inclusiv blocările manuale) în `[ziua, ziua + 30)` / (toate unitățile × 30) × 100, o zecimală. Hold-urile nu se numără.
- **Încasări luna aceasta (bani):** suma `amount - refunded_amount` a plăților `succeeded` sau `partially_refunded` (cele rambursate integral nu mai contează) cu `created_at` în luna calendaristică a zilei, socotită în `Europe/Bucharest` (o plată la 23:30 UTC pe 31 martie intră în aprilie). Orizontul de 30 de zile e scris într-un singur loc în funcție. Moneda e `RON` fixă.

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
Bucket privat `photos`, max 10 MB, doar `image/webp` (din 0011; panoul convertește orice poză în WebP). Calea: `<organization_id>/<property_id>/<uuid>.webp`; un rând din `photos` nu poate indica folderul altei firme sau altei proprietăți (constraint `photos_storage_path_owner`). Proprietarul citește/scrie/șterge doar în folderul firmei lui. Anon poate citi (URL semnat) doar fișierele înregistrate în `photos` pentru proprietăți active.

## Conturi de test (seed, doar local / proiect de dev)
`owner1@example.com` (org 1: 2 proprietăți, 6 unități, 22 rezervări pe 60 de zile) și `owner2@example.com` (org 2: 1 proprietate ascunsă). Parola: `Parola-Test-123`.

## Comenzi
`npm run db:reset:dev` (reaplică migrațiile + seed; refuză dacă proiectul legat nu e cel de test `enqnxbktjwcqydghvenu`), `npm run db:test` (teste pgTAP din `supabase/tests/`), `npm run db:types` (scrie `supabase/types.ts`). Supabase CLI v3: scripturile folosesc `--remote` (proiectul legat); cer `SUPABASE_ACCESS_TOKEN` și `SUPABASE_DB_PASSWORD` exportate în shell.

## Drepturi pe funcții
`0002_rls.sql` revocă global (pentru toate schemele) dreptul implicit EXECUTE de la `PUBLIC`. Orice funcție nouă, inclusiv cele adăugate de o extensie, are nevoie de un `grant execute` explicit către `anon` și/sau `authenticated`, altfel nu poate fi apelată. `expire_holds` și `is_live_booking` au EXECUTE explicit pentru `authenticated` și `service_role`, niciodată pentru `PUBLIC` sau `anon`.

## Rezervare publică

Site-ul public rezervă **doar** prin funcțiile de mai jos (client fără sesiune, cheia anon) și nu scrie direct în tabele. Prețul se calculează doar în bază; clientul nu trimite nicio sumă. Toate funcțiile din 0010 au `set search_path = ''` și `grant execute` explicit. Erorile aruncate au ca mesaj doar codul (de ex. `invalid_guest`), fără text Postgres; aplicația citește `error.message`.

### `public_quote(p_unit_id uuid, p_check_in date, p_check_out date, p_adults int default 1, p_children int default 0)`
`anon`, `authenticated`; `security definer`, `stable`. Întoarce **un rând**: `nights int`, `total bigint` (bani), `currency text` (`RON`), `nightly jsonb` (`{"2027-06-04": 32000, ...}`, o cheie `YYYY-MM-DD` pe noapte, indiferent de `DateStyle`), `ok boolean`, `reason text`. La refuz: `ok = false`, `reason` setat, `nights`/`total`/`nightly` = null. Nu aruncă erori pentru date greșite.

**Ordinea motivelor (fixă, primul care se potrivește câștigă):**
1. `unit_not_found`: unitate inexistentă, nepublicată, dintr-o proprietate `ascunsa`, sau `p_unit_id` null. Același răspuns pentru toate (nu se poate afla dacă unitatea există).
2. `invalid_dates`: check-in sau check-out null sau infinit (`infinity`), `check_out <= check_in`, check-in înainte de azi (`Europe/Bucharest`; azi e acceptat), check-in peste 2 ani (după azi + 730 zile), peste 366 de nopți.
3. `invalid_guest`: adulți null sau în afara 1–20, copii null sau în afara 0–20.
4. `too_many_guests`: adulți + copii > `units.max_guests`.
5. `no_price`: unitatea nu are preț de bază > 0, sau o noapte iese cu preț 0.
6. `min_nights`: nopțile sunt sub cel mai mare `min_nights` dintre regulile aplicate efectiv nopților.
7. `invalid_amount`: totalul depășește 2.147.483.647 bani (nu încape în `bookings.total_amount`); calculat în bigint, fără eroarea 22003.
8. `unavailable`: zilele se suprapun cu o rezervare care ocupă acum calendarul (`is_live_booking`: `confirmed`, `blocked`, `hold` neexpirat). Un hold trecut de `hold_expires_at`, încă nemăturat, nu blochează.

**Prețul pe noapte** (noaptea D = de la D la D+1): sezonul cu `date_from <= D < date_to` (`date_to` e exclusiv: noaptea `date_to` are deja prețul normal), altfel weekendul (nopțile de **vineri și sâmbătă**, `isodow` 5 și 6), altfel baza. `date_from`/`date_to` contează doar la `season`. **La egalitate** (două sezoane pe aceeași noapte; o regulă weekend e cel mult una pe unitate, din 0011): câștigă `priority` mai mare, apoi `created_at` cel mai nou, apoi `id` mai mare, deci rezultatul e determinist.

### `create_public_booking(p_unit_id uuid, p_check_in date, p_check_out date, p_full_name text, p_email text, p_phone text, p_adults int default 1, p_children int default 0)`
`anon`, `authenticated`; `security definer`. Întoarce un rând: `booking_id uuid`, `public_token uuid`, `total bigint`, `hold_expires_at timestamptz`. Creează în aceeași tranzacție oaspetele (în firma unității) și rezervarea: `hold`, sursa `direct`, `total_amount` = totalul din `public_quote`, `hold_expires_at = now() + 24h`.

Ordinea verificărilor:
1. motivele lui `public_quote`, în ordinea de mai sus (aceleași coduri, `unit_not_found` primul);
2. `invalid_dates` dacă sunt peste **30 de nopți** (limita hold-ului public);
3. `invalid_guest`: nume 1–80 după trim; email obligatoriu, ≤ 254, de forma `x@y.z` fără spații; telefon obligatoriu, ≤ 32, doar cifre, spații și `+ ( ) . -`, cel puțin 6 caractere;
4. `expire_holds(p_unit_id)`, apoi limitele anti-abuz → `too_many_requests`: cel mult **3** hold-uri vii pe același email (pe toate unitățile; comparat după `trim`, fără diferență între litere mari și mici) și cel mult **20** hold-uri vii pe unitate;
5. o suprapunere apărută între timp → `unavailable`.

Numele, emailul și telefonul se salvează după `trim` (emailul își păstrează literele). Coduri SQLSTATE: `unit_not_found` P0002, `unavailable` 23P01, `too_many_requests` P0001, restul 22023. Două cereri simultane pe aceeași unitate sau același email se așteaptă una pe alta (advisory lock în tranzacție). Limita pe IP și Turnstile stau în server action (baza vede doar IP-ul serverului).

### `public_booking_status(p_token text)`
`anon`, `authenticated`; `security definer`. Coloane: `status booking_status`, `check_in date`, `check_out date`, `property_name text`, `unit_name text`, `total_amount int`, `currency text`. **Fără** email, telefon, nume oaspete, `checkin_instructions`, `organization_id`, `guest_id`. Un `hold` trecut de `hold_expires_at` apare ca `expired`, chiar dacă jobul nu l-a mutat încă. Token greșit, malformat (nu e uuid canonic) sau null: zero rânduri, fără eroare (niciodată 22P02).

### `confirm_booking(p_booking_id uuid)` și `decline_booking(p_booking_id uuid)` → void
Doar `authenticated`, pe rezervările firmei lui (`security definer` cu verificare `is_org_member`). Rezervare inexistentă sau a altei firme: `booking_not_found` (P0002).
- `confirm_booking`: `hold` viu → `confirmed`, `hold_expires_at = null`. Hold expirat (mutat sau nu în `expired`) → `hold_expired`; orice altă stare → `invalid_status` (22023).
- `decline_booking`: doar `hold` → `cancelled`; orice altă stare → `invalid_status`.
- Webhook-ul Stripe (brief 07, `service_role`) nu e membru de firmă: va avea nevoie de o funcție proprie sau de o extindere a acesteia.

### Panou: unități (brief 04)
- `save_unit(p_property_id uuid, p_name text, p_type text, p_max_guests int, p_bedrooms int, p_beds int, p_bathrooms int, p_area_m2 int, p_description text, p_amenities jsonb, p_is_published boolean, p_base_price int, p_unit_id uuid default null) → uuid` (id-ul unității). `authenticated`, `security invoker`. Fără `p_unit_id` creează unitatea la final (`position` = max + 1); cu el o editează. Scrie unitatea și prețul de bază (unul pe unitate, upsert) în aceeași tranzacție. Erori: `property_not_found` / `unit_not_found` (P0002); `invalid_unit` (22023: nume 1–80, tip din enum, max_guests 1–50, bedrooms 0–50, beds 0–100, bathrooms 0–50, area_m2 null sau 1–10000, descriere ≤ 4000 și goală → null, amenities listă de texte ≤ 50 și null → `[]`, is_published obligatoriu); `invalid_price` (22023: preț de bază 1–2.100.000.000 bani).
- `reorder_units(p_property_id uuid, p_unit_ids uuid[])`: vezi tabelul de funcții.
- **O unitate publicată are mereu preț de bază > 0** (triggere de constraint, verificate la commit): publicarea fără preț, sau un preț de bază pus pe 0 sau șters la o unitate publicată → `no_price` (23514). „Unitate, apoi preț” în aceeași tranzacție e acceptat. Rândurile existente nu sunt reverificate.
- Storage (`photos`): scrierea cere calea `<organization_id al firmei tale>/<id-ul unei proprietăți a acelei firme>/<uuid>.webp`, toate trei uuid canonice cu litere mici (din 0011; `poza-mea.webp` sau `.jpg` sunt refuzate cu 42501). Citirea și ștergerea rămân pe tot folderul firmei.

### Job pg_cron
`pg_cron` e disponibil pe planul gratuit. Un singur job, `expire-holds`, la `*/5 * * * *`, rulează `select public.expire_holds()`. `cron.schedule` actualizează jobul după nume, deci migrația rulată din nou nu îl dublează. Funcțiile `cron.*` păstrează EXECUTE pentru `PUBLIC`, dat de `supabase_admin` (nu-l putem revoca), dar `anon` și `authenticated` nu au USAGE pe schema `cron`, deci nu le pot apela (42501).

### Drepturi (0010)
- `anon` are EXECUTE pe exact 4 funcții: `public_quote`, `create_public_booking`, `public_booking_status`, `public_busy_ranges`.
- Doar `authenticated`: `confirm_booking`, `decline_booking`, `save_unit`, `reorder_units` (plus cele de dinainte).
- `PUBLIC`: nimic. Anon nu citește și nu scrie direct în `bookings` sau `guests`.

## Oaspete, cereri, limita pe IP (0013)

**Legătura cu contul.** `bookings.user_id` (FK `auth.users`, `on delete set null`) e scris **doar** de `create_public_booking`, din `auth.uid()` al apelantului: fără parametru, fără potrivire după email. Anon → null; un JWT al unui cont șters → null (fără 23503). Semnătura, verificările și drepturile lui `create_public_booking` sunt cele din 0010 (o singură funcție în `pg_proc`). Nicio politică nouă pe `bookings` sau `guests`: oaspetele nu citește tabelele, doar `my_bookings()`. Gazda scrie `bookings` prin drepturi pe coloane care lasă afară `user_id` (insert/update pe `user_id` → 42501; restul coloanelor merg ca înainte). **O coloană nouă pe `bookings` trebuie adăugată și în aceste `grant insert (...)` / `grant update (...)`, altfel panoul primește 42501 la scriere.** `supabase/types.ts` arată totuși `user_id` în `Insert`/`Update` (generatorul nu citește drepturile pe coloane): nu-l trimiteți.

### `my_bookings(p_limit int default 20, p_offset int default 0)`
Doar `authenticated` (anon → 42501); `security definer`, filtrează `user_id = auth.uid()` (nu RLS-ul gazdei: owner1 ca oaspete vede doar cererile lui). Cele mai noi întâi (`created_at desc, id desc`). Coloane: `booking_id`, `public_token` (pentru linkul spre `/rezervare/[token]`), `status` (hold expirat → `expired`), `check_in`, `check_out`, `unit_id`, `unit_name`, `property_name`, `city`, `adults`, `children`, `total_amount`, `currency`, `hold_expires_at`, `created_at`, `total_count` (toate rândurile, pentru paginare). **Fără** `checkin_instructions`, `organization_id`, `guest_id`, `user_id`, nume / email / telefon. Erori: `invalid_page` (22023) dacă limita nu e 1–100 sau offset < 0.

### `pending_requests(p_limit int default 50, p_offset int default 0)` și `pending_requests_count() → integer`
Doar `authenticated`; `security invoker` (RLS-ul gazdei) plus filtrul explicit `is_org_member`. Hold-urile **vii** (`is_live_booking`) ale firmelor apelantului; un hold expirat nu apare. Cel mai urgent întâi (`hold_expires_at`, apoi `created_at`, `id`). Coloane: `booking_id`, `unit_id`, `property_id`, `unit_name`, `property_name`, `check_in`, `check_out`, `adults`, `children`, `total_amount`, `currency`, `hold_expires_at`, `created_at`, `guest_name`, `guest_email`, `guest_phone`, `total_count`. **Fără** `public_token`, `user_id`, `guest_id`, `organization_id`. Insigna = `pending_requests_count()` = `total_count` al listei (același predicat). Un cont de oaspete primește 0. Erori: `invalid_page` (22023).

### `favorites`
`user_id` (implicit `auth.uid()`, cascadă la ștergerea contului), `unit_id` (cascadă la ștergerea unității), `unique (user_id, unit_id)` (`favorites_user_unit_key`), index pe `unit_id`. RLS: select și delete cu `user_id = (select auth.uid())`; insert cu același WITH CHECK plus `is_public_unit(unit_id)` (unitate publicată dintr-o proprietate activă; altfel 42501). Fără update (nici politică, nici drept). Anon: nimic. Gazda nu vede cine i-a dat inimă. Clic dublu: `upsert` cu `onConflict: 'user_id,unit_id'`, `ignoreDuplicates: true` (= `on conflict do nothing`), deci fără 23505. Lista: `select unit_id, created_at` din `favorites`, apoi detaliile unităților prin clientul fără sesiune (o unitate ascunsă între timp pur și simplu lipsește).

### `rate_limit_hit(p_bucket text, p_ip text, p_max int default 5, p_window_seconds int default 3600)`
Doar `service_role` (server action; singura folosire a cheii de serviciu). Întoarce un rând: `allowed boolean`, `hits integer` (cereri acceptate în fereastră, inclusiv aceasta), `retry_after_seconds integer` (0 când e permis). Fereastră glisantă: cel mult `p_max` cereri acceptate pe `(bucket, ip)` în ultimele `p_window_seconds`; una refuzată nu se numără. IP-ul (după `trim` + litere mici) se stochează doar ca `sha256(sare | bucket | ip)`, sarea fiind generată în bază la migrare (`rate_limit_salt`, nu e în repo). Rândurile mai vechi de o zi se șterg la fiecare apel. Erori: `invalid_rate_limit` (22023): bucket `^[a-z][a-z0-9_]{0,39}$`, ip 1–100 caractere, max 1–1.000.000, fereastră 1–86.400 s. Resetare în teste: `delete from rate_limit_hits where bucket = '<bucket>'` cu cheia de serviciu.

### Drepturi (0013)
- `anon` are tot EXECUTE pe exact 4 funcții (cele din 0010).
- `authenticated` (și `service_role`, implicit Supabase, ca toate funcțiile de proprietar): `my_bookings`, `pending_requests`, `pending_requests_count`, `is_public_unit`. Niciodată `anon` sau `PUBLIC`.
- Doar `service_role`: `rate_limit_hit`. Tabelele `rate_limit_*`: RLS fără politici, niciun drept pentru `anon` / `authenticated` / `service_role` (doar funcția, `security definer`).
- Toate au `set search_path = ''`. `security definer`: `my_bookings`, `is_public_unit`, `rate_limit_hit`; `security invoker`: `pending_requests`, `pending_requests_count`.

## Mai târziu
- `public_busy_ranges`: `busy_from` poate dezvălui check-in-ul original al unui sejur lung; de tăiat la începutul ferestrei.
- `cancellation_policies` nu e încă citibil de anon (pagina publică nu poate afișa politica).
- Hold-urile trecute de `hold_expires_at` blochează zilele (constraint-ul nu poate folosi `now()`) până rulează `expire_holds()`; de programat jobul pg_cron (PLAN.md D6). Cititorii (`dashboard_chart`, `public_busy_ranges`, `public_quote`) le ignoră deja. **Rezolvat în 0010:** jobul pg_cron `expire-holds` rulează la 5 minute, iar `create_public_booking` cheamă întâi `expire_holds(unit)`.
- `public_busy_ranges` e `security definer`: regula „unitate publicată dintr-o proprietate activă” e repetată acolo; de ținut la fel cu `properties_public` / `units_public`.
