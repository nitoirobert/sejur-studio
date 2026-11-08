# Brief 06: un singur cont, două feluri (gazdă și oaspete)

Taka (8 nov):
- O gazdă conectată vede și site-ul, și panoul.
- Un oaspete nu vede niciodată panoul.
- Gazda intră în cont direct de pe site.

Site-ul lui Robert are deja un popup de login pentru oaspeți (favorite, momentan de fațadă), deci vor exista conturi de oaspeți în aceeași bază.

## Regula
- Gazdă = are rând în `organization_members`. Oaspete = cont fără firmă. Nu există alt câmp de rol.
- Contul nou de pe `/cont-nou` (panou) e de gazdă. Contul nou din popup-ul site-ului e de oaspete.
- `/dashboard/**` e doar pentru gazde. Un oaspete conectat care intră acolo e trimis pe `/`, fără să vadă nimic din panou, nici în HTML.
- După login: gazda ajunge pe `/dashboard` (sau `next`), oaspetele pe `/`.

## Pași
1. **db-architect**, migrația `0012_account_kind.sql`:
   - Triggerul de cont nou creează firma doar dacă `raw_user_meta_data->>'account_type' = 'host'`.
   - Funcția `my_account()` întoarce `kind` (`host` / `guest`), `organization_id` și `full_name`, doar pentru utilizatorul curent.
   - `become_host()` transformă un oaspete în gazdă: creează firma și membrul, idempotent.
   - pgTAP pentru toate trei.
   - Cine se marchează singur „host” primește doar o firmă goală a lui, iar asta e acceptat (produsul e gratuit).
2. **web-engineer**:
   - `/cont-nou` trimite `account_type: host`.
   - `requireViewer` devine `requireHost`, iar un oaspete e redirecționat pe `/`. La fel în `proxy.ts`, pentru `/dashboard`.
   - Login-ul trimite la destinația după fel.
   - Pentru Robert, în `src/lib/account/` (fără să-i atingem fișierele):
     - hook-ul `useAccount()` (`{ kind, name } | null`, client, din sesiunea Supabase);
     - componenta `<HostPanelLink />`, care afișează „Panoul gazdei” doar pentru gazde;
     - funcțiile `signInFromSite(email, parolă)` și `signUpGuest(...)`.
   - Un oaspete conectat care deschide `/cont-nou` vede butonul „Devino gazdă”, care cheamă `become_host()`.
3. **Robert** leagă popup-ul și header-ul de funcțiile de mai sus (prompt separat).

## Verificări
1. Un cont nou de oaspete nu are firmă, iar `/dashboard` îl duce pe `/` (status 307, fără date în răspuns).
2. Un cont nou de gazdă ajunge în panou, la fel ca acum.
3. O gazdă conectată deschide `/` și vede site-ul normal, iar `<HostPanelLink />` apare și duce în panou.
4. Oaspetele nu vede `<HostPanelLink />`.
5. Un oaspete nu poate apela RPC-urile proprietarului: rezultatul e gol sau eroare.
6. `become_host()` apelat de două ori creează o singură firmă.
7. Toate testele vechi trec (pgTAP, vitest, e2e).

## Team
- **db-architect** #conturi: `supabase/migrations/0012_account_kind.sql`, `supabase/tests/16_account_kind.test.sql`, `supabase/types.ts`, `docs/DB.md`
- **web-engineer** #conturi: `src/lib/supabase/`, `src/lib/account/`, `src/proxy.ts`, `src/app/login/`, `src/app/cont-nou/`, `src/components/dashboard/auth/`, `messages/ro.json` (doar `Dashboard.*`)
- **frontend-tester**: `e2e/` (21+)
