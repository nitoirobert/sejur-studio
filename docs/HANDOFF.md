# Predare pentru agentul lui Robert (9 nov 2026)

Citește întâi acest fișier, apoi `docs/STATUS.md`, `docs/DECISIONS.md` (1–14), `docs/DB.md`.

## 1. Unde e codul (important)
- Codul la zi e pe ramura **`owner-dashboard`** (ultimul commit `4abc1e8`), nu pe `main`. `main` are doar documentele vechi.
- **sejurstudio.ro rulează codul din `owner-dashboard`** (commitul `f523e7b`), publicat de Taka pe Vercel (echipa `chiubra`).
- Înainte de orice lucru: `git fetch && git switch owner-dashboard && git pull`. Lucrează pe o ramură nouă din ea, apoi PR spre `owner-dashboard`. Mutarea în `main` o facem împreună, printr-un PR separat.

## 2. Ce am lucrat (Taka)
- **Baza de date**, migrațiile 0001–0013, cu 620 de teste pgTAP care trec. O singură bază Supabase (`enqnxbktjwcqydghvenu`, Frankfurt), folosită și de sejurstudio.ro (decizia 14). Nu modifica o migrație existentă; adaugă una nouă.
- **Panoul gazdei** (`/dashboard`): login, graficul rezervărilor, rezervare manuală, proprietăți, unități, poze, prețuri. Nou: `/dashboard/rezervari`, lista cererilor noi pe care gazda le acceptă sau le refuză (`src/components/dashboard/requests/`).
- **Conturi gazdă / oaspete** (0012): AuthModal pe site cu email și parolă. Google e pregătit și așteaptă cheile. Apple arată „În curând”.
- **Rezervarea oaspetelui** (brief 07, migrația 0013):
  - formularul de pe `/cazare/[id]` (`src/components/booking/BookingCard.tsx`, `src/lib/booking/*`). Funcția `create_public_booking` calculează prețul doar pe server; limita de încercări pe IP e în `rate-limit.ts`;
  - pagina de stare `/rezervare/[token]`;
  - contul oaspetelui: `/cont/rezervari` și `/cont/favorite` (tabelul `favorites`, cu RLS doar pe rândurile proprii).

## 3. Ce am schimbat în fișierele tale (cu acordul lui Taka)
- **Site-ul public nu mai citește din mock-units, ci din baza reală**, prin `src/lib/catalog/{anon,map,server}.ts`.
- Atinse: `src/app/page.tsx`, `src/app/cazare/[id]/page.tsx`, `src/app/sitemap.ts`, `src/components/browse/*` (inclusiv `PropertyView`, `ViewToggle`, `filters.ts`, `AuthModal.tsx`), `messages/*` (namespace-urile noi `BookingRequest`, `BookingStatus`, `Account`, în toate cele 6 limbi).
- Testul vizual al paginii principale (`home.visual`) nu are referințe noi: baza are 5 unități și 0 poze. Refă-l după ce pui poze reale.

## 4. Ce urmează (în ordine)
1. **Brief 08**, plata avansului și anularea: Stripe Connect (banii direct la gazdă), politică flexibilă sau strictă, rambursări. Stripe merge doar în modul de test până există firma (decizia 12). *Așteaptă cheile de test Stripe de la Taka.*
2. **Brief 09**, emailuri automate (confirmare, înainte de sosire, cerere de recenzie) și mesaje între oaspete și gazdă, cu Resend. *Așteaptă cheia Resend.*
3. **Brief 10**, recenzii verificate: doar de la cine a stat.
4. **Brief 11**, pagini legale (termeni, confidențialitate), cu datele firmei Sejur Studio de completat; facturi după înființarea firmei (decizia 13).
5. Copii de rezervă ale bazei. Planul gratuit nu are restaurare.
6. Logarea cu Google, când Taka dă Client ID și secret. Adresa de redirect: `https://enqnxbktjwcqydghvenu.supabase.co/auth/v1/callback`.
7. Mici reparații rămase de la revizia brief 07:
   - legături spre `/cont/rezervari` și `/cont/favorite` în meniul AuthModal când oaspetele e autentificat (pe telefon, la 390 px, nu le poate deschide acum);
   - semnarea URL-urilor pozelor pusă în cache (`src/lib/catalog/server.ts`);
   - `BOOKING_RATE_LIMIT_MAX` și `BOOKING_RATE_LIMIT_WINDOW_SECONDS` adăugate în `.env.example`;
   - pe preview, fără cheia de serviciu, limita de încercări se sare (`rate-limit.ts`).
8. Testele e2e 25–27 (rezervare oaspete, cont oaspete, fluxul gazdei) sunt scrise doar parțial și n-au fost rulate până la capăt.

## 5. Pe partea ta (site public), din ROADMAP
- Rezervarea în 3 pași sub 60 de secunde, pe noul `BookingCard`.
- Animațiile, cu `prefers-reduced-motion`.
- Țintele de viteză: LCP sub 2 s pe 4G, CLS 0, Lighthouse ≥ 95.
- SEO: `LodgingBusiness`.

Spune-i lui Taka înainte să schimbi ceva în `src/lib/booking/`, `src/lib/catalog/` sau `supabase/`.

## 6. Reguli care nu se schimbă
- **Nu șterge contul `nume@exemplu.ro` și organizația „nitoi robert”** din bază.
- Secretele nu intră niciodată în git: cheia de serviciu e doar în Vercel (`SUPABASE_SERVICE_ROLE_KEY`) și în `.env.test.local` (ignorat de git).
- Nu atinge înregistrările DNS de mail ale sejurstudio.ro.
- Fără `git stash`, `reset`, `checkout` sau `clean` pe munca altuia. Un al doilea branch se face cu `git worktree add`.
- Testele: `npx vitest run`, e2e cu `E2E_BASE_URL=http://localhost:<port> npx playwright test --workers=1`. Pozele din `docs/briefs/0*-capturi/` se rescriu la fiecare rulare; nu le pune în commit decât dacă le-ai refăcut intenționat.
