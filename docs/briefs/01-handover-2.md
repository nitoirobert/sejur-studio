# Handover 2 — brief 01 (8 nov)
- Previous run died on the usage limit. State: deps installed (package.json/lock changed, scripts NOT added yet); `supabase/migrations/`, `seed.sql`, `config.toml`, `.env.example`, `docs/DB.md` do not exist yet (no `supabase init` done).
- `supabase/tests/` has 01-08 pgTAP files written from the brief (checks 1-8, the auth trigger test 06 may be unfinished); 09-14 missing. Names are guesses until the migrations exist.
- Docker Desktop was off; restarted by the PM. If `docker ps` fails, wait for it, do not try other ways.
- Error code `booking_overlap` in `create_manual_booking`, raw constraint `23P01`.
