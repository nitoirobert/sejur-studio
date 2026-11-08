-- 0012: conturi de client (oaspeți) pe lângă conturile de gazdă.
--
-- Până acum orice cont nou primea o organizație + rolul owner (= gazdă cu panou).
-- Un client care își face cont pe site (favorite, rezervările lui) NU trebuie să primească organizație.
--
-- Regula: contul e de CLIENT dacă
--   - la înscrierea cu email s-a trimis metadata account_type = 'guest' (popup-ul de pe site), sau
--   - vine prin Google / Apple (pe site, aceste butoane sunt doar pentru clienți).
-- Altfel (formularul /cont-nou, seed-ul, testele vechi) rămâne GAZDĂ, exact ca înainte.
--
-- De ce e sigur să citim metadata aici: account_type poate doar să ia drepturi (fără organizație),
-- nu să dea. Organizația și rolul tot nu se citesc niciodată din metadata.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_name text := nullif(trim(new.raw_user_meta_data ->> 'full_name'), '');
  v_guest boolean :=
    coalesce(new.raw_user_meta_data ->> 'account_type', '') = 'guest'
    or coalesce(new.raw_app_meta_data ->> 'provider', '') in ('google', 'apple');
begin
  -- Google/Apple trimit numele ca „name", nu „full_name"
  v_name := coalesce(v_name, nullif(trim(new.raw_user_meta_data ->> 'name'), ''));

  if not v_guest then
    insert into public.organizations (name, slug)
    values (coalesce(v_name, nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'Organizația mea'),
            'org-' || replace(new.id::text, '-', ''))
    returning id into v_org;

    insert into public.organization_members (organization_id, user_id, role)
    values (v_org, new.id, 'owner');
  end if;

  insert into public.profiles (user_id, full_name)
  values (new.id, v_name);

  return new;
end
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
