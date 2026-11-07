# Plan: zona proprietarului (dashboard)

Stare: plan, nimic implementat. Data: 2026-11-07. Autori: Taka (dashboard), Robert (pagina publică).
Se citește împreună cu `PLAN.md` (arhitectură, schemă, GDPR). Pagina publică (`src/app/page.tsx`, `src/components/browse/`) nu se atinge.

---

## 1. Ce construim

Un panou pentru proprietar, centrat pe **graficul rezervărilor** (unități × zile), cu sticlă („glass") peste fundalul de plajă al site-ului, în culorile paginii publice: crem + un singur accent bleumarin, aceeași temă zi/noapte.

### Aspect
- **Fundal:** același `SceneBackground` (plaja zi / noapte), deja în `layout.tsx`.
- **Sticlă:** panouri translucide crem (`backdrop-blur`, bordură albă fină, umbra soft). Noaptea: sticlă bleumarin. Tokeni noi în `globals.css`: `--color-glass`, `--color-glass-strong`, `--color-glass-line`, `--shadow-glass` (și variantele din `.dark`).
- **Sidebar vertical în stânga**, doar 4 intrări: Prezentare, Proprietăți, Rezervări, Setări. Sus logo Sejur Studio, jos avatar + ieșire. Se strânge la iconuri pe ecrane medii; pe telefon devine meniu (buton ☰ + sertar).
- **Fără bară de butoane sus.** Antetul conținutului: titlul paginii (serif) + salut, în dreapta doar comutatorul zi/noapte.
- Lățime completă, `px-4` pe telefon, `px-6` pe desktop. Carduri `rounded-card`, accent doar pe elementul activ.

### Prezentare (pagina principală)
1. **4 carduri KPI** (ca în referință, cu săgeata din colț care duce la Rezervări filtrate): Sosiri azi, Plecări azi, Ocupare (următoarele 30 zile, %), Încasări luna aceasta (lei).
2. **Graficul rezervărilor**, pe toată lățimea:
   - rânduri = unitățile, grupate pe proprietate (grup pliabil); coloane = zile (7 / 14 / 30, scroll orizontal);
   - bare de la check-in la check-out (`[check_in, check_out)`), cu numele oaspetelui; culoare după stare: confirmată (bleumarin plin), în plată (`hold`, hașurat), blocată / iCal (nisip), sursa marcată cu o iconiță (direct / Booking / Airbnb);
   - linia „azi”, weekendurile ușor nuanțate, butoane ‹ Azi › și filtru după proprietate;
   - click pe bară → panou lateral cu detaliile rezervării (doar citire).
3. **Sosiri următoare** (listă scurtă, 5 rânduri) lângă un mini-rezumat al ocupării pe proprietăți.

4. **Rezervare manuală** (decizia Taka, 7 nov): click pe zile libere ale unei unități → formular scurt (oaspete, adulți, copii, sumă) → rezervare `confirmed`, source `direct`. Se creează printr-o singură funcție Postgres (o tranzacție: oaspete + rezervare); suprapunerea e oprită de constraint, iar mesajul apare în română. Așa testăm graficul cap-coadă.

---

## 2. Schema (se stabilește cu Robert ÎNAINTE de cod)

Repo-ul nu are încă `supabase/`. Pornim de la schema din `PLAN.md` §3 și adăugăm doar ce cere dashboardul:

| Tabel | Adăugat față de PLAN.md |
|---|---|
| `properties` | description, lat, lng, cancellation_policy_id, amenities (jsonb), status (`activa`/`ascunsa`) |
| `units` | type include `cabana`, beds; prețul de bază = rând `unit_prices` cu kind `base` (bani) |
| `photos` (nou, în loc de `units.photos`) | organization_id, property_id, unit_id (opțional), storage_path, position, is_cover, alt |
| `profiles` (nou) | user_id, full_name, phone |
| `organizations` | date de facturare: legal_name, cui, reg_com, billing_address |

Plus: bucket Storage `photos` cu politici RLS pe calea `<organization_id>/...`, trigger care creează organizația + membrul `owner` la primul cont.
**Regula:** schema intră printr-un PR separat, aprobat de amândoi; după aceea nimeni nu o schimbă fără să-l anunțe pe celălalt.

---

## 3. Pași (câte unul, fiecare cu test, oprire și verificare după fiecare)

| # | Pas | Test |
|---|---|---|
| 0 | Ramura `owner-dashboard`, Supabase local (Docker e instalat), Vitest + Playwright, `.env.example` | `npx supabase start` merge, `git status` curat, `.env.local` ignorat |
| 1 | Migrații: schema din §2 + RLS + anti-suprapunere + Storage + `seed.sql` (2 proprietăți, 6 unități, ~20 rezervări pe 60 zile) | `supabase db reset` fără erori; teste SQL: suprapunere → eroare, alt cont nu vede nimic |
| 2 | Autentificare: login / cont nou / ieșire, protecție `/dashboard` (în Next 16 `middleware` se numește `proxy`, de verificat în docs), organizație creată automat | cont nou → ajung în panou; fără sesiune → trimis la login |
| 3 | Shell-ul: sidebar de sticlă, meniu pe telefon, stări de încărcare / gol / eroare | captură desktop + 390 px, zi și noapte |
| 4 | Prezentare: KPI + graficul rezervărilor + sosiri următoare + rezervare manuală din grafic | adaug o rezervare din grafic → apare ca bară și în KPI; peste una existentă → mesaj în română; bara începe la check-in și se termină înainte de check-out |
| 5 | Proprietăți: listă + formular (nume, descriere, adresă, pin pe hartă cu maplibre deja instalat, ore check-in/out, politică de anulare, facilități, activă / ascunsă) | adaug, editez, ascund; alt cont nu o vede |
| 6 | Unități în fiecare proprietate (tip, capacitate, paturi, descriere, facilități, preț de bază în lei → salvat în bani) | „450,50” → 45050; apare ca rând nou în grafic |
| 7 | Poze: încărcare multiplă, ordine prin tragere, copertă, ștergere, alt text, redimensionare în browser înainte de upload, doar imagini ≤ 10 MB | fișier de 11 MB / PDF → refuzat cu mesaj; ordinea rămâne după reîncărcare |
| 8 | Rezervări: tabel paginat, filtre după proprietate și interval de date, doar citire | filtrul de dată folosește suprapunerea de interval, nu doar check-in |
| 9 | Setări: profil, schimbare parolă, date de facturare | parola nouă funcționează la relogare |

La final: code-review + security-review (RLS, Storage, server actions), verificare vizuală completă.

**Reguli pentru toți pașii:** zod pe fiecare formular și server action; autorizare verificată pe server în fiecare action; bani doar în întregi; date `date` + `Europe/Bucharest`; texte doar în `messages/ro.json` sub cheia `Dashboard.*` (Robert folosește restul, ca să nu ne călcăm); culori noi doar în `globals.css`.

---

## 4. Dependențe noi (aprobate de Taka, 7 nov)
`@supabase/ssr`, `@supabase/supabase-js`, `zod`, `vitest`, `@playwright/test`, `@dnd-kit/core` + `@dnd-kit/sortable` (ordinea pozelor). Redimensionarea pozelor cu canvas în browser, fără pachet nou.

## 4b. Performanță (să meargă la orice trafic)
- **Bază de date:** index pe fiecare `organization_id` și pe fiecare cheie străină; `bookings (unit_id, check_in)`; GiST pe `stay` (vine din constraint); index parțial pe rezervările active; `organization_members (user_id, organization_id)`.
- **RLS rapid:** politicile folosesc `(select auth.uid())` și o funcție `is_org_member(org)` `stable security definer`, nu subinterogări repetate pe rând.
- **Un singur drum la bază pe ecran:** graficul și KPI-urile vin din funcții SQL (`dashboard_chart(from, to, property)`, `dashboard_kpis(day)`), nu din zeci de cereri.
- **Scrieri atomice:** rezervarea manuală și ordinea pozelor = câte o funcție Postgres (tranzacție), fără curse între cereri.
- **Liste:** paginare pe server (limită fixă), filtre pe server; nimic nu încarcă toate rândurile.
- **Next 16:** pagini Server Components, date per utilizator nememorate între utilizatori; datele publice ale lui Robert memorate cu tag-uri și invalidate (`revalidateTag`) când proprietarul salvează.
- **Poze:** redimensionate în browser (max 2000 px, WebP) + miniatură 400 px; căi imuabile în Storage, cache lung; afișate prin `next/image`.
- **Infrastructură:** Supabase Frankfurt + Vercel `fra1` (aceeași regiune), conexiuni prin pooler-ul Supabase.

---

## 5. Lucru în doi
- Repo-ul e deja pe GitHub (`nitoirobert/sejur-studio`). Taka are nevoie de acces de colaborator; lucrăm pe `owner-dashboard`, intrăm în `main` doar prin PR.
- Fișiere comune, de atins cu grijă: `globals.css` (doar adăugăm tokeni), `messages/ro.json` (doar `Dashboard.*`), `layout.tsx` (nu îl schimbăm).
- Pluginul Supabase activat în Claude, ca să vadă tabelele reale.
