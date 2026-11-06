# Plan de lucru: PMS + rezervări directe (MVP)

Stare: **plan, nimic implementat încă.** Data: 2026-11-06.

---

## 0. Unelte și skill-uri

### Ce avem deja
| Unealtă | Stare | Folosită pentru |
|---|---|---|
| Node 26 / npm 11 / git 2.56 | instalat | tot proiectul |
| Supabase CLI (prin `npx supabase`) | funcționează | migrații, tipuri TS, teste DB |
| Vercel (conector MCP) | conectat | deploy, variabile de mediu, loguri |
| Browser integrat (Claude) | disponibil | verific vizual fiecare pagină după implementare |
| Skill `code-review`, `security-review`, `simplify` | disponibile | review după fiecare funcție importantă (RLS, plăți) |
| Skill `dataviz` | disponibil | KPI-urile din dashboard |

### Pluginuri recomandate (de activat din cardul din chat)
| Plugin | De ce |
|---|---|
| **supabase** (oficial) | best practices Postgres/RLS + acces MCP la proiect (vede tabelele reale) |
| **Stripe** (oficial) | Connect (alegerea tipului de cont), Checkout, webhook-uri, carduri de test |
| **frontend-design** (Anthropic) | UI „soft UI" consecvent, nu generic |
| **resend** | emailuri de confirmare (React Email), livrabilitate |

### Lipsesc pe calculator
- **Docker Desktop** — necesar pentru Supabase local (`supabase start`). Fără el lucrăm direct pe un proiect Supabase cloud de dev (vezi Decizia D1).
- **Stripe CLI** — pentru webhook-uri în local (`stripe listen`). Necesar abia la pasul 7.
- **Repo git** — folderul nu e încă repo. Îl inițializăm la pasul 0 (și un repo GitHub privat pentru colaborare).

---

## 1. Decizii de luat înainte de cod

| # | Întrebare | Recomandarea mea |
|---|---|---|
| D1 | Supabase local (Docker) sau proiect cloud de dev? | **Local cu Docker** (migrațiile se testează sigur, resetare ușoară) + un proiect cloud separat pentru producție |
| D2 | Login proprietar: magic link sau email + parolă? | **Email + parolă**, cu magic link ca opțiune ulterior (magic link-urile ajung des în spam la început) |
| D3 | Regiune date | **EU (Frankfurt)** pentru Supabase și `fra1` pentru funcțiile Vercel — GDPR |
| D4 | Durata hold-ului la plată | **30 min**, nu 10-15: Stripe Checkout nu permite expirare sub 30 min. Alternativ 15 min + expirăm manual sesiunea Stripe din cron |
| D5 | Plan Vercel | **Pro** când avem clienți: Hobby e doar necomercial și cron-ul rulează doar o dată pe zi |
| D6 | Cron pentru iCal (la 5-15 min) | **Supabase `pg_cron` + `pg_net`** care apelează un endpoint protejat din Next.js (gratuit, independent de Vercel) |
| D7 | Tip cont Stripe Connect | **Express**, cu direct charges + comision aplicație (de confirmat cu skill-ul Stripe `connect-recommend` la pasul 7) |

---

## 2. Arhitectură (pe scurt)

- **Next.js (App Router) + TypeScript strict + Tailwind v4.**
- **i18n:** `next-intl`. Texte în `messages/ro.json` (mai târziu `en.json`). Fără prefix de limbă în URL acum (`/dashboard`, nu `/ro/dashboard`), dar structura permite adăugarea lui. Formatare cu `Intl` pe `ro-RO`: dată `06.11.2026`, preț `450 lei`.
- **Supabase:** Auth + Postgres. Clienți cu `@supabase/ssr` (server/browser), middleware pentru sesiune.
- **Securitate:** RLS pe toate tabelele; fiecare rând are `organization_id`. Cheia `service_role` doar pe server (webhook-uri, cron), niciodată în browser.
- **Bani:** întregi în **bani** (1 leu = 100), monedă `RON`. Niciodată `float`.
- **Date calendaristice:** tip `date` (fără oră), intervale `[check_in, check_out)` — ziua plecării e liberă pentru următorul oaspete. Fus orar proprietate: `Europe/Bucharest`.
- **Teste:** Vitest (logică prețuri/disponibilitate), teste SQL pe baza locală (anti-suprapunere, RLS), Playwright mai târziu pentru fluxul de rezervare.

### Structura folderelor (propusă)
```
src/
  app/
    (auth)/login/            pagina de login
    (dashboard)/             layout cu sidebar
      calendar/ rezervari/ oaspeti/ proprietati/ setari/
    (public)/p/[slug]/       pagina publică a unității
    api/                     webhook Stripe, cron iCal
  components/ui/             carduri, butoane, inputuri (soft UI)
  lib/
    supabase/                clienți server/browser
    pricing/                 calcul preț (funcții pure + teste)
    availability/            disponibilitate (funcții pure + teste)
  i18n/                      config next-intl
messages/ro.json
supabase/
  migrations/                fișiere SQL numerotate
  seed.sql                   date de test (proprietăți, unități)
  tests/                     teste SQL
```

---

## 3. Schema bazei de date

Toate tabelele: `id uuid`, `created_at`, `updated_at`, RLS activ.

| Tabel | Câmpuri cheie |
|---|---|
| `organizations` | name, slug, stripe_account_id, country='RO' |
| `organization_members` | organization_id, user_id (→ auth.users), role (`owner`) |
| `properties` | organization_id, name, slug, address, city, timezone, check_in_time, check_out_time, checkin_instructions |
| `units` | property_id, name, type (`apartament`/`camera`/`garsoniera`), max_guests, description, amenities (jsonb), photos, is_published |
| `unit_prices` | unit_id, kind (`base`/`weekend`/`season`), price_per_night (bani), date_from, date_to, min_nights, priority |
| `guests` | organization_id, full_name, email, phone — **minim de date** |
| `bookings` | organization_id, unit_id, guest_id, check_in, check_out, `stay daterange` (generat), status, source, adults, children, total_amount, currency, hold_expires_at, stripe_checkout_session_id, stripe_payment_intent_id, public_token |
| `payments` | booking_id, amount, status, stripe_ids, refunded_amount |
| `cancellation_policies` | organization_id, name, reguli (ex. rambursare 100% până la X zile înainte) |
| `ical_feeds` | unit_id, url, provider (`booking`/`airbnb`/`altul`), last_sync_at, last_status, last_error |
| `sync_conflicts` | unit_id, feed_id, booking_id, external_uid, interval, rezolvat |

### Anti dublă rezervare (cel mai important lucru din schemă)
```sql
create extension if not exists btree_gist;

alter table bookings add constraint bookings_no_overlap
  exclude using gist (unit_id with =, stay with &&)
  where (status in ('hold', 'confirmed', 'blocked'));
```
- `hold` = în curs de plată (expiră), `confirmed` = plătit / manual, `blocked` = venit din iCal sau blocare manuală.
- `cancelled` / `expired` nu blochează datele.
- Un job `pg_cron` la fiecare minut trece hold-urile expirate în `expired`; în plus, la orice încercare de rezervare curățăm întâi hold-urile expirate ale unității.
- Rezervările din iCal intră tot în `bookings` (source = `booking`/`airbnb`), deci constraint-ul le acoperă. Dacă una se suprapune cu o rezervare directă → nu se inserează, se scrie în `sync_conflicts` și proprietarul primește alertă.

---

## 4. Etape (o funcție odată, fiecare cu test)

### Etapa 0 — Pregătire (fără cod de aplicație)
- `git init`, `.gitignore`, repo GitHub privat.
- `CLAUDE.md` cu regulile de lucru (română, pași mici, explicații pentru coleg, fără secrete în cod).
- `.env.example` cu toate variabilele (fără valori).
- Instalare Docker Desktop (dacă D1 = local) și Stripe CLI (poate aștepta până la etapa 7).
- **Test:** `git status` curat, `.env.local` ignorat de git.

### Etapa 1 — Primul task (împărțit în 6 pași mici)
1. **Proiect Next.js + TS + Tailwind**, ESLint, Prettier, Vitest. Tokeni de design: fundal crem, accent albastru închis, raze mari, umbre fine, font serif pentru titluri + sans pentru text.
   *Test:* `npm run dev` → pagina de start; `npm test` trece.
2. **i18n cu `next-intl`**, `messages/ro.json`, niciun text scris direct în componente.
   *Test:* schimb un text în `ro.json` → se schimbă pe pagină.
3. **Conectare Supabase** (clienți + middleware de sesiune).
   *Test:* pagină de diagnostic temporară care arată „conectat".
4. **Migrații** pentru toată schema + RLS + constraint + `seed.sql`.
   *Test:* `npx supabase db reset` rulează fără erori; teste SQL: două rezervări suprapuse pe aceeași unitate → eroare; aceeași dată pe unități diferite → OK; check-out = check-in al următorului → OK; un utilizator nu vede datele altei organizații.
5. **Pagina de login** (+ creare cont și organizație la prima logare).
   *Test:* creez cont → ajung în dashboard; logout → sunt trimis la login; fără sesiune nu pot deschide `/proprietati`.
6. **Lista de proprietăți** (+ formular „Adaugă proprietate" și unități).
   *Test:* adaug o proprietate cu 2 unități → apar în listă; alt cont nu le vede.

### Etapa 2 — Calendar
Grilă unități × zile, scroll orizontal, rezervare manuală (click pe zile libere → formular oaspete). Shell-ul de dashboard: sidebar îngust cu iconuri, salut + rezumatul zilei.
*Test:* rezervare manuală apare în calendar; încercarea de suprapunere afișează mesaj clar în română.

### Etapa 3 — Prețuri
Reguli: bază, weekend (nopțile de vineri și sâmbătă), sezon (interval), minim nopți. Funcție pură `calculeazaPret()` cu prioritate sezon > weekend > bază.
*Test:* teste Vitest pentru cazuri de margine (sejur peste granița de sezon, o noapte, sub minimul de nopți, an bisect).

### Etapa 4 — iCal
Export: URL secret per unitate (`.ics`). Import: cron la 10 min, parsare, upsert pe `external_uid`, ștergere rezervări anulate în sursă, conflicte → alertă, afișare „ultima sincronizare acum X min".
*Test:* feed de test local cu 3 evenimente → 3 blocări în calendar; modific feed-ul → se actualizează.

### Etapa 5 — Pagina publică
Poze mari, facilități, calendar cu zile libere, selecție date + oaspeți → preț total live → „Rezervă". Mobile first, un singur buton principal.
*Test:* deschis pe telefon (viewport 375px) în browser; prețul total coincide cu calculul din etapa 3.

### Etapa 6 — Plată (Stripe Checkout + Connect)
Onboarding Connect în Setări. Flux: date oaspete → `hold` în DB (constraint-ul garantează exclusivitatea) → sesiune Checkout → **confirmare doar din webhook** (`checkout.session.completed`), eliberare la `checkout.session.expired` / plată eșuată / cron. Webhook idempotent.
*Test:* cu Stripe CLI + carduri de test: plată reușită → `confirmed`; card refuzat → datele se eliberează; două ferestre pe aceleași date → a doua primește „indisponibil".

### Etapa 7 — Anulare și rambursare
Politici setabile, calcul sumă de rambursat, refund prin Stripe, status actualizat din webhook.
*Test:* anulare cu 10 zile înainte vs. 1 zi înainte → sume diferite, conform politicii.

### Etapa 8 — Emailuri
Resend (regiune EU) + React Email: confirmare cu link `public_token`, instrucțiuni check-in (cu X zile înainte), notificare proprietar.
*Test:* rezervare de test → email primit, link funcțional.

### Etapa 9 — Lansare
Export CSV pentru SmartBill/Oblio, politică de confidențialitate + termeni, backup criptat (Supabase PITR/backup zilnic), domeniu, Vercel Pro, monitorizare erori. Review de securitate pe RLS și webhook-uri.

---

## 5. Variabile de mediu (vor fi în `.env.example`)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # doar server
NEXT_PUBLIC_SITE_URL=
STRIPE_SECRET_KEY=                # etapa 6
STRIPE_WEBHOOK_SECRET=            # etapa 6
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
RESEND_API_KEY=                   # etapa 8
CRON_SECRET=                      # etapa 4, protejează endpoint-ul de sync
```

---

## 6. GDPR (de la început, nu la final)
- Oaspete: doar nume, email, telefon. Fără CNP/act de identitate în MVP.
- Date găzduite în UE; DPA semnate cu Supabase, Vercel, Stripe, Resend.
- Ștergere/anonimizare oaspeți la cerere și după perioada de retenție.
- Loguri fără date personale.

## 7. Riscuri cunoscute
- **iCal nu e în timp real** (Booking actualizează feed-ul cu întârziere) → suprapunerile rămân posibile; de aceea alerta + afișarea orei ultimului sync. Soluția reală mai târziu: Channex.
- **Stripe Connect în România** cere verificare KYC pentru fiecare proprietar → onboarding-ul trebuie testat devreme cu un cont real.
- **Design:** capturile sunt doar referință de stil (crem, carduri rotunjite, accent albastru); nu copiem elemente sau branding din ele.
