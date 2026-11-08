# Unde suntem

Se actualizează în același commit cu munca. Fiecare zonă are un rând: gata, în lucru (cine, pe ce ramură) și ce urmează.

| Zonă | Stare | Cine | Urmează |
|---|---|---|---|
| Baza de date | gata: brief 01 + curățarea 0005–0009, aplicate pe proiectul de probă, 269 de teste pgTAP; ramura `owner-dashboard` | Taka | Robert aprobă; limite în `create_manual_booking` (brief 04) |
| Intrare în cont + panou | gata (brief 02): QA și design au trecut; ramura `owner-dashboard` | Taka | — |
| Graficul rezervărilor + rezervare manuală | gata (brief 03): e2e 130/130, design trece; ramura `owner-dashboard` | Taka | proprietăți, camere, poze, prețuri (brief 04); pe Vercel trebuie `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` înainte de merge în `main` |
| Site public | prototip pe `main` | Robert | rezervarea în 3 pași, animații, viteză |
| Rețele sociale | conturile nu sunt create încă | Taka | conturile + primele postări |
| Proprietari (outreach) | neînceput | Taka | verticala în adOS după brief 05 (sincronizarea cu Booking) |

Planul complet: `docs/ROADMAP.md`. Deciziile: `docs/DECISIONS.md`.
