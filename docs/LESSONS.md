# Lecții (3 rânduri după fiecare brief)

## Brief 01: baza de date
- Agenții au atins limita de folosire la jumătatea lucrului. Fiecare pas mare primește un fișier de predare (handover), ca să poată fi reluat de alt agent.
- Docker local a încurcat porturile cu alt proiect și consumă PC-ul. Lucrăm direct pe Supabase cloud, cu un proiect separat pentru probe.
- Recenzia a găsit o scăpare: o poză putea fi pusă în folderul altei firme. Fiecare regulă de securitate primește un test pgTAP, ca să nu ne bazăm doar pe RLS.

## Brief 02: intrare în cont
- Două sesiuni au lucrat în același folder pe ramuri diferite. Regula de acum: al doilea scriitor lucrează într-un `git worktree` separat.
- Un open redirect a trecut de prima rundă: normalizarea URL-ului poate produce `//host`. Orice „next=” se verifică după normalizare, plus un test cu payload-uri dot-segment.
- Next 16 păstrează ruta veche ascunsă în DOM; după ieșirea din cont trebuie o încărcare completă a paginii.

## Brief 03: graficul rezervărilor
- `supabase test db --remote` cere totuși Docker (pg_prove rulează în container). Fără Docker, pgTAP se rulează doar când se schimbă migrațiile, pe un PC cu Docker pornit.
- Tester-ul a scris specificațiile în paralel cu construcția, cu selectori provizorii. Contractul cu `data-testid` se trimite la început, nu la final.
