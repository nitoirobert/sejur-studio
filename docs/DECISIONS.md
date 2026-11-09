# Decizii Sejur Studio

Numerotate, cu dată, nu se rescriu. O decizie nouă o poate înlocui pe una veche, cu trimitere la ea.

1. 7 nov 2026. Robert lucrează site-ul public, Taka panoul proprietarului și baza de date.
2. 7 nov. Panoul are sticlă peste fundalul de plajă și un meniu vertical cu 4 intrări: Prezentare, Proprietăți, Rezervări, Setări. Ecranul principal e graficul rezervărilor.
3. 7 nov. Baza de date e pe Supabase cloud (`enqnxbktjwcqydghvenu`, Frankfurt), fără Docker local. Schema o scriem noi și o aprobă Robert.
4. 7 nov. Dependențe aprobate: @supabase/ssr, supabase-js, zod, vitest, playwright, dnd-kit. Altele noi se cer întâi.
5. 7 nov. Prețul: momentan totul e gratuit; mai târziu vom lua comision pe rezervare.
6. 7 nov. Buget de reclame: 0. Creștem doar organic.
7. 7 nov. Rețelele sociale pornesc acum, ca să construim interes și vechime pentru conturi. Postăm despre construcția produsului, la vedere.
8. 7 nov. Pe WhatsApp scriem proprietarilor doar după ce ne-au răspuns. Emailurile la rece merg doar către firme și PFA-uri, prin adOS.
9. 7 nov. Planurile și actualizările de structură se pun pe git (`main`) imediat, ca agentul lui Robert să le vadă după `git pull`.
10. 7 nov. Sejur Studio e proiectul de probă înainte de PMS-ul pentru hoteluri de peste 100 de camere. Lecțiile se notează în `docs/LESSONS.md`.
11. 8 nov. Pozele se încarcă cu `cacheControl` 300 (5 minute): o poză descărcată cât proprietatea era publică poate rămâne în cache cel mult 5 minute după ascundere; URL-urile semnate noi sunt refuzate imediat.
12. 9 nov (Taka). Plăți cu **Stripe** (Connect, banii direct la gazdă); emailuri cu **Resend**. Până există firma, Stripe merge doar în modul de test.
13. 9 nov (Taka). Firma de pe termeni și facturi va fi **Sejur Studio** (încă neînființată): paginile legale se scriu cu datele firmei de completat; facturi reale abia după înființare.
14. 9 nov (Taka). **O singură bază de date** (proiectul Supabase actual, `enqnxbktjwcqydghvenu`), și pentru sejurstudio.ro. Fără bază separată de producție deocamdată; copiile de rezervare se rezolvă separat (planul gratuit nu are restaurare).
