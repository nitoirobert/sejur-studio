# Brief 02: predare pentru runda 2 de reparații (8 nov)

Stare:
- Construcția e făcută. e2e: 81 din 81 trec. DB: 269 de teste pgTAP pe proiectul de probă, după curățarea 0005–0009.
- QA: **block**, din cauza unui open redirect în `safeNext`. Design: pass with notes.
- Arborele de lucru e pe ramura `untangle-db`, cu tot brief 02 + curățarea DB necomise. Nu schimbați ramura și nu faceți commit.

## web-engineer (`src/`, `messages/ro.json` doar `Dashboard.*`)
1. **BLOCK.** `src/lib/supabase/validation.ts:33`: `safeNext` întoarce pathname-ul normalizat, așa că `/.//evil.com`, `/..//evil.com`, `/%2e//evil.com` și `/a/..//evil.com` devin `//evil.com`. După normalizare, `out = pathname + search + hash`; dacă `out` începe cu `//` sau `/\`, se întoarce FALLBACK.
2. `src/lib/supabase/server.ts:8`: `await connection()` (din `next/server`) pe prima linie din `createClient()`, înainte de `cookies()`. Rezolvă avertismentul „Date.now() while prerendering”.
3. `KpiCards.tsx:8`: venitul cu 2 zecimale fixe sau 0, formatat consecvent. Linia 61 trebuie să folosească `row.currency`.
4. `actions.ts:8`: `signOut` cheamă `requireViewer`. `AuthForm.tsx:63`: maxLength 80. `env.ts:15`: cookie-ul are `Secure` doar pe https. `proxy.ts:51`: un POST la `/login` cu sesiune nu se redirecționează.
5. Design:
   - pe telefon, antetul pune ☰ și comutatorul pe un rând, cu titlul pe toată lățimea dedesubt (`PageHeader.tsx:10-14`);
   - lățimea casetei titlului e fixă la 1440;
   - în `ro.json`, „dintr‑o” și „într‑un” cu cratimă care nu se rupe (U+2011);
   - săgețile KPI se ascund până există pagina Rezervări;
   - butonul principal noaptea e mai plin (`AuthForm.tsx:137`, fără `soft.ts`);
   - `text-balance` în `Placeholders.tsx:35`;
   - luna tăiată: o mică ajustare de spațiu.

## frontend-tester (`e2e/`, `docs/briefs/02-capturi/`)
1. `08-next.spec.ts`: payload-urile cu dot-segment de mai sus, în testul unitar, în `Location` și în formularul de cont nou.
2. Fără `test.skip` condiționat în `10-server.spec.ts:61,76` și `12-cookie-secrete.spec.ts:52`.
3. `10-server.spec.ts:60`: testul trebuie să poată prinde lipsa autorizării în action, sau să fie redenumit cinstit.
4. `06-capturi-axe.spec.ts:56`: verificare reală pe color-contrast „incomplete”.
5. `03-kpi.spec.ts:18`: un literal fix pentru venitul lui owner1.
6. `11-iesire.spec.ts:36`: fără KPI imediat după goBack.
7. Capturi:
   - capturi noi `*-768-zi/noapte` pentru Prezentare și o pagină goală;
   - o captură cu sertarul deschis la 390;
   - ștergi `bug-sertar-focus-390-zi.png`.
8. `SUPABASE_ADMIN_KEY` documentat într-un comentariu în `e2e/support/env.ts`.
