# Unde suntem

**9 nov 2026: citește întâi `docs/HANDOFF.md`** (ce a lucrat Taka, ce urmează). Codul la zi e pe `owner-dashboard`, publicat pe sejurstudio.ro.

Se actualizează în același commit cu munca. Fiecare zonă are un rând: gata, în lucru (cine, pe ce ramură) și ce urmează.

| Zonă | Stare | Cine | Urmează |
|---|---|---|---|
| Baza de date | gata: 0001–0013 (conturi oaspete, rezervare oaspete, favorite), 620 teste pgTAP; o singură bază (decizia 14) | Taka | brief 08 plată + anulare (0014); copii de rezervă |
| Intrare în cont + panou | gata: briefs 02–04 (login, grafic rezervări, proprietăți, unități, poze, prețuri), e2e 161/161 | Taka | brief 06; apoi iCal, „Azi”, avans și emailuri |
| Graficul rezervărilor + rezervare manuală | gata (brief 03): e2e 130/130, design trece; ramura `owner-dashboard` | Taka | proprietăți, camere, poze, prețuri (brief 04); pe Vercel trebuie `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` înainte de merge în `main` |
| Site public | LIVE pe sejurstudio.ro, pe baza reală, cerere de rezervare + cont oaspete (brief 07) | Robert + Taka | rezervarea în 3 pași, animații, viteză; plata după cheile Stripe |
| Rețele sociale | conturile nu sunt create încă | Taka | conturile + primele postări |
| Proprietari (outreach) | neînceput | Taka | verticala în adOS după brief 05 (sincronizarea cu Booking) |

Planul complet: `docs/ROADMAP.md`. Deciziile: `docs/DECISIONS.md`.
