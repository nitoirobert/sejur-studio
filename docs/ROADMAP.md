# Sejur Studio: drumul complet (7 nov 2026)

Cine: Robert, site-ul public (clienții). Taka, panoul proprietarului și baza de date. Piața întâi România, apoi alte țări.
Promisiunea: un proprietar mic (1–2 camere sau o vilă) primește rezervări directe fără comisionul Booking (15–18%), pe un site care arată scump și se încarcă instant.

## A. Produs

### Panoul proprietarului (Taka)
1. ✅ Baza de date (brief 01)
2. ⏳ Intrare în cont + scheletul panoului (brief 02)
3. Graficul rezervărilor + rezervare manuală (brief 03)
4. Proprietăți, camere, poze, prețuri pe sezon (brief 04)
5. **Sincronizare iCal cu Booking/Airbnb**, ca să nu existe suprarezervări. Fără asta nimeni nu mută nimic la noi. (brief 05)
6. Plăți: avans online (Stripe sau Netopia), emailuri automate către client (confirmare, înainte de sosire, cerere de recenzie) (brief 06)
7. Setări, echipă (o a doua persoană pe cont), export, ștergere cont conform GDPR

Principiu: maximum 3 clicuri pentru orice lucru zilnic, merge pe telefon, fără ecrane de setări inutile.

### Site-ul public (Robert)
- O pagină per proprietate (subdomeniu sau domeniu propriu), cu rezervare în 3 pași sub 60 de secunde: date → cameră → nume, telefon și avans.
- Mișcare: intrări la derulare, galerie, calendar animat. Toate respectă `prefers-reduced-motion` și nu strică viteza.
- Ținte: LCP sub 2 s pe telefon 4G, CLS 0, Lighthouse ≥ 95. Imagini AVIF, fonturi locale, JS minim pe pagina de rezervare.
- SEO: schema.org `LodgingBusiness`, hartă, recenzii, pagini în română și engleză.

## B. Securitate (pe tot parcursul, nu la final)
- ✅ RLS pe fiecare tabel, teste pgTAP, poze private
- Brief 02: proxy, sesiune pe server, verificări anti-redirect, limite de încercări
- Formular de rezervare: protecție anti-bot (Cloudflare Turnstile), limită pe IP, prețul calculat doar pe server
- Antete: CSP, HSTS, X-Frame-Options; secrete doar în Vercel
- Copii de rezervă: planul gratuit Supabase nu are restaurare pe oră, deci la primul client plătitor trecem pe Pro (25 $/lună)
- GDPR: politică de confidențialitate, contract de prelucrare (DPA) cu proprietarul, date în UE (Frankfurt)
- Înainte de lansare: revizie de securitate completă (`security-review`) + test de penetrare simplu

## C. Ce învățăm (Taka și Robert)
- Robert: Motion (Framer Motion), GSAP, Core Web Vitals, accesibilitate, next/image
- Taka: Postgres și RLS, Supabase Auth, Stripe Connect, bazele securității web (OWASP Top 10)
- Împreună: Git cu ramuri și PR-uri, preview pe Vercel, cum citim un raport Lighthouse

## D. Rețele sociale (pornesc ACUM: interes și vechime pentru conturi, decizia 7)
- Conturi Sejur Studio pe Instagram, TikTok și Facebook. Conținut: filme scurte cu mișcare care arată panoul, „Cât îți ia Booking pe an”, înainte și după pe site-ul unei vile.
- Ritm: 3–5 postări pe săptămână la început. Le facem cu skill-urile reels/instagram; nu postăm nimic fără OK-ul lui Taka.

## E. Găsirea proprietarilor (prin adOS, verticală nouă „proprietari cazare”)
- Surse: Google Maps, site-urile proprii ale pensiunilor, Facebook, Travelminit/Turist Info. Booking nu dă contactele.
- Atenție, legea 506/2004 (art. 12) cere acordul dinainte pentru email comercial, chiar și către firme. Amenzile ANSPDCP au fost între 10.000 și 50.000 lei. Primul contact legal: scrisoare prin poștă, telefon, conținut organic, parteneriate cu contabili și calculatorul „Cât îți ia Booking”. Emailul la rece rămâne decizia lui Taka. **WhatsApp doar după ce proprietarul răspunde.**
- Detalii și cifre: `docs/research/piata-2026-11.md`. Comisionul Booking pentru proprietarul persoană fizică e ≈18,2% cu TVA, adică ~8.200 lei pe an la 45.000 lei venit.
- Ofertă de lansare: totul gratuit acum (decizia 5). Proprietarii fondatori își păstrează mai târziu un comision mic, blocat pe viață, iar site-ul îl facem noi.

## F. Aducerea clienților (turiști) pentru proprietari
- Google Business Profile pentru fiecare proprietate, cu linkul spre site-ul direct. Linkurile gratuite de rezervare Google nu se aplică: cer un partener de conectare, iar casele persoanelor fizice nu sunt eligibile.
- Cod de reducere „rezervă direct” pentru oaspeții care revin
- Reclame plătite: doar după ce avem buget (acum 0, decizia 6)
- Recomandări: proprietarul aduce alt proprietar → o lună gratuită

## Decizii doar ale lui Taka
1. Email la rece către proprietari, deși legea cere acord dinainte? Alternativa: poștă, telefon, organic.
