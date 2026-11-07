# Handover 3 — brief 01 (8 nov)
- Taka: no local Docker; apply to a NEW empty Supabase cloud project (account office@sejurstudio.ro, free plan, Frankfurt). Waits on Taka's sign-up + `npx supabase login`.
- api-engineer wrote migrations 0001-0004, seed, config, scripts, .env.example, docs/DB.md. No SQL run yet. lint/typecheck pass.
- Apply: `npx supabase link --project-ref <ref>`, `npm run db:reset` (= reset --linked) x2, `npm run db:types` (-> supabase/types.ts), then a fresh api-tester aligns supabase/tests/ to the contract below and runs `npm run db:test`.

## Contract
- create_manual_booking(p_unit_id, p_check_in, p_check_out, p_full_name, p_email=null, p_phone=null, p_adults=1, p_children=0, p_total_amount=0) -> uuid. Errors (message): booking_overlap (23P01), unit_not_found (P0002), invalid_dates/invalid_guest/invalid_amount (22023).
- reorder_photos(p_property_id, p_photo_ids uuid[], p_cover_id=null): list must be all photos; errors property_not_found, photo_set_mismatch.
- dashboard_chart(p_from, p_to, p_property_id=null) -> booking_id, unit_id, property_id, check_in, check_out, status, source, guest_name, adults, children, total_amount, currency, hold_expires_at; window > 366 days -> invalid_dates.
- dashboard_kpis(p_day=null) -> kpi_day, arrivals_today, departures_today, occupancy_pct, revenue_month, currency (net succeeded payments by created_at month, Europe/Bucharest).
- public_busy_ranges(p_unit_id, p_from, p_to) -> busy_from, busy_to (anon + authenticated). bucharest_today(p_now=now()) authenticated only.
- Seed: owner1@example.com 11111111-1111-4111-8111-111111111111, owner2@example.com 22222222-2222-4222-8222-222222222222, password Parola-Test-123; org ids random (trigger). org1 properties a1000000-0000-4000-8000-00000000000[1-2], units b1000000-0000-4000-8000-00000000000[1-6] (6 unpublished); org2 property a2000000-…0001 (hidden), unit b2000000-…0001. 22 bookings org1.
- KPI: dashboard_kpis(first day of current Bucharest month) as owner1 = arrivals 3, departures 1, occupancy 31.7, revenue 808000.
- Anon on private tables gets permission denied (not 0 rows); tests accept that.

## Cloud project (created 7 nov)
- Ref `enqnxbktjwcqydghvenu`, name sejur-studio, eu-central-1, free plan, Taka's own Supabase org. Empty; free to wipe.
- Token + DB password: `C:\Users\Taka's\.claude\secrets\sejur-supabase.env` (SUPABASE_ACCESS_TOKEN, SEJUR_DB_PASSWORD). Never copy them into the repo or print them.
