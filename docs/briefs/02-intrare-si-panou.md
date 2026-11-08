# Brief 02 — Pașii 2 + 3: intrarea în cont și scheletul panoului

Plan: `docs/PLAN-DASHBOARD.md` §1 (aspect), §3 pașii 2-3. Baza de date: `docs/DB.md` (brief 01, pe `main`). Ramura: `owner-dashboard` (Taka a aprobat publicarea pe `main` după verificări). Inspirație: `design/referinte/` — meniul vertical tip capsulă „Wander” (iconuri în pătrate moi, activul plin bleumarin, logo sus), salutul mare serif + subtitlu („Hello, Explorer”), carduri moi crem cu umbră fină, totul pe fundalul de plajă (`SceneBackground`, zi/noapte).

## Scop
Proprietarul își face cont, intră, vede panoul cu sticlă peste plajă: meniu în stânga (Prezentare, Proprietăți, Rezervări, Setări), salut, comutator zi/noapte, iese. Pe Prezentare: cele 4 carduri KPI cu date reale din `dashboard_kpis`; graficul vine în brief 03 (aici doar locul lui, stare „în curând”). Celelalte 3 pagini: stare goală frumoasă.

## Ce se face
- Supabase SSR (`@supabase/ssr`): client server + client browser în `src/lib/supabase/`; în Next 16 `middleware` = `proxy` (citește `node_modules/next/dist/docs/` înainte). Fără sesiune → `/login`; cu sesiune pe `/login` → `/dashboard`.
- Pagini `/login`, `/cont-nou` (email, parolă, nume), ieșire din meniu. Erori în română (parolă greșită, email folosit, parolă scurtă). Server actions cu zod, autorizare pe server.
- Proiectul de probă (`enqnxbktjwcqydghvenu`): confirmarea pe email oprită, ca să meargă contul nou fără mail; Site URL `http://localhost:3000`.
- Shell `/dashboard/*`: sidebar de sticlă (se strânge la iconuri pe ecran mediu, sertar ☰ pe telefon), antet = titlu serif + „Bună, <prenume>”, comutatorul de temă existent în dreapta; fără bară de butoane sus. Stări încărcare / gol / eroare.
- Tokeni noi doar adăugați în `globals.css` (`--color-glass`, `--color-glass-strong`, `--color-glass-line`, `--shadow-glass` + `.dark`). Texte doar în `messages/ro.json` sub `Dashboard.*`. `layout.tsx` și pagina lui Robert nu se ating.

## Verificări
1. Cont nou → direct în `/dashboard`, „Bună, <prenume>” (primul cuvânt, cu diacritice); în bază pentru user id exact 1 org + 1 membru `owner` + 1 profil cu `full_name`.
2. Fără sesiune orice `/dashboard/*` → `/login`; cu sesiune `/login` → `/dashboard`.
3. KPI `owner1` = `dashboard_kpis(azi)` cu sesiunea lui, lei formatat ro; `owner2` fără cifrele lui owner1; cont nou 0 / 0 / 0% / 0 lei, consola curată.
4. Erori în română fixate în spec: parolă/email greșit (un singur text „Email sau parolă greșită”), email folosit, parolă scurtă, nume gol; erorile brute Supabase/Postgres nu apar; la 429 mesaj în română (rate limit activ).
5. Meniu 4 intrări, activul cu `aria-current`, Tab/Enter; sertarul se închide cu Esc, clic în afară și alegerea unei intrări, focusul revine pe ☰; sertar la 390, iconuri la 768, complet la 1440; fără scroll orizontal la 390/768.
6. Capturi `docs/briefs/02-capturi/<pagină>-<lățime>-<zi|noapte>.png` pentru login, cont-nou, Prezentare (locul graficului „în curând”) și cele 3 stări goale, la 1440 și 390; ș ț cu virgulă; axe fără probleme AA pe sticlă.
7. `/` identică înainte/după (`toHaveScreenshot`, maxDiffPixelRatio 0.01, animații oprite); `npm run lint`, `typecheck`, `build`, `test:e2e` trec.
8. `next` la login/cont nou acceptă doar căi interne (`/…`, nu `//`, `/\`, schemă, host); altfel `/dashboard`. Test cu `https://evil.com`, `//evil.com`, `/\evil.com`.
9. `src/proxy.ts` reîmprospătează sesiunea cu `getUser()`/`getClaims()` și scrie cookie-urile pe răspuns; nicio decizie pe `getSession()`; matcher exclude `_next/static`, imagini, fișiere publice; `/` fără redirect și fără apel auth. Token expirat → merge fără login; cookie falsificat → `/login`.
10. Fiecare server action și pagină `/dashboard` verifică userul pe server; organizația din sesiune + RLS, niciodată din client. Zod: `full_name` 1–80 cu trim, email, parolă cu minimul egal cu `minimum_password_length` (config.toml + proiectul de probă). Acțiune apelată fără cookie → eroare, fără date.
11. Ieșirea = acțiune POST cu `signOut()`, cookie-urile `sb-*` șterse; `/dashboard/*` dinamic, `Cache-Control: no-store`. După ieșire, Înapoi + reîncărcare → `/login`, fără KPI în HTML.
12. Cookie-uri `Secure` + `SameSite=Lax` în producție; public doar URL + anon/publishable key; `grep -rn "service_role\|SERVICE_ROLE" src/ e2e/` gol.
13. Conturile e2e `e2e+<timestamp>@example.com` se șterg după rulare (admin API, cheia service doar în `.env.test.local`, gitignored, niciodată în `src/`); cascada șterge org/membru/profil; `owner1`/`owner2` neatinse.

Setări auth pe proiectul cloud (confirmare oprită, Site URL, minim parolă, rate limit) se pun prin Management API cu tokenul din secrete — `config.toml` singur nu ajunge. Risc acceptat pe proiectul de probă: „email folosit” arată că emailul există; revedem înainte de producție.

## Team
- **web-engineer** (opus / high: model nou — auth SSR + proxy Next 16): `src/app/login/`, `src/app/cont-nou/`, `src/app/dashboard/`, `src/components/dashboard/`, `src/lib/supabase/`, `src/proxy.ts`, `src/app/globals.css` (doar adăugare), `messages/ro.json` (doar `Dashboard.*`), `supabase/config.toml`, `package.json`, `package-lock.json`
- **frontend-tester**: `e2e/`, `playwright.config.ts`, `.env.test.local`, capturi în `docs/briefs/02-capturi/`
- **qa-reviewer**: citire, verdict
- **design-reviewer**: citire, verdict pe aspect
