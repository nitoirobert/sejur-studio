-- 0006_composite_org_fks: "a child row lives in its parent's organization" is declared by the
-- foreign keys themselves, not by a trigger.
--
-- 0001 kept organization_id consistent with enforce_organization(): one function with a branch per
-- table name, plus a second copy of the rule in photos_storage_path_owner. Every new child table
-- meant editing that function. Now each parent exposes a unique key that includes the column the
-- child must agree on, and the child's foreign key spans both columns:
--   (child.parent_id, child.organization_id) -> parent (id, organization_id)
-- The engine refuses a mismatch (23503) for every table alike, on insert and on update.
-- Extra links the trigger never checked are declared the same way:
--   photos: the unit belongs to the photo's property          (unit_id, property_id)
--   bookings / sync_conflicts: the feed and the booking belong to the same unit
--   bookings: source = the feed's provider for an imported booking
--
-- Consequences:
--   * organization_id is no longer filled in from the parent: callers pass it (NOT NULL).
--   * A cross-organization link is refused with 23503 (foreign_key_violation), not 42501.
--   * bookings -> units and payments -> bookings were ON DELETE RESTRICT, which also blocked deleting
--     a whole organization (the cascade reached the units before their bookings). They are NO ACTION
--     now: deleting a unit that still has bookings is still refused, deleting an organization works.

-- ---------------------------------------------------------------------------
-- Parent keys the composite foreign keys point at
-- ---------------------------------------------------------------------------
alter table public.cancellation_policies add constraint cancellation_policies_id_org_key unique (id, organization_id);
alter table public.properties add constraint properties_id_org_key unique (id, organization_id);
alter table public.units add constraint units_id_org_key unique (id, organization_id);
alter table public.units add constraint units_id_property_key unique (id, property_id);
alter table public.guests add constraint guests_id_org_key unique (id, organization_id);
alter table public.ical_feeds add constraint ical_feeds_id_unit_key unique (id, unit_id);
alter table public.ical_feeds add constraint ical_feeds_id_unit_provider_key unique (id, unit_id, provider);
alter table public.bookings add constraint bookings_id_org_key unique (id, organization_id);
alter table public.bookings add constraint bookings_id_unit_key unique (id, unit_id);

-- ---------------------------------------------------------------------------
-- Replace the single-column foreign keys (same constraint names)
-- ---------------------------------------------------------------------------
alter table public.properties
  drop constraint properties_cancellation_policy_id_fkey,
  add constraint properties_cancellation_policy_id_fkey
    foreign key (cancellation_policy_id, organization_id)
    references public.cancellation_policies (id, organization_id)
    on delete set null (cancellation_policy_id);

alter table public.units
  drop constraint units_property_id_fkey,
  add constraint units_property_id_fkey
    foreign key (property_id, organization_id)
    references public.properties (id, organization_id) on delete cascade;

alter table public.unit_prices
  drop constraint unit_prices_unit_id_fkey,
  add constraint unit_prices_unit_id_fkey
    foreign key (unit_id, organization_id)
    references public.units (id, organization_id) on delete cascade;

alter table public.photos
  drop constraint photos_property_id_fkey,
  drop constraint photos_unit_id_fkey,
  add constraint photos_property_id_fkey
    foreign key (property_id, organization_id)
    references public.properties (id, organization_id) on delete cascade,
  add constraint photos_unit_id_fkey
    foreign key (unit_id, property_id)
    references public.units (id, property_id) on delete cascade;

alter table public.ical_feeds
  drop constraint ical_feeds_unit_id_fkey,
  add constraint ical_feeds_unit_id_fkey
    foreign key (unit_id, organization_id)
    references public.units (id, organization_id) on delete cascade;

alter table public.bookings
  drop constraint bookings_unit_id_fkey,
  drop constraint bookings_guest_id_fkey,
  drop constraint bookings_ical_feed_id_fkey,
  add constraint bookings_unit_id_fkey
    foreign key (unit_id, organization_id)
    references public.units (id, organization_id),
  add constraint bookings_guest_id_fkey
    foreign key (guest_id, organization_id)
    references public.guests (id, organization_id)
    on delete set null (guest_id),
  add constraint bookings_ical_feed_id_fkey
    foreign key (ical_feed_id, unit_id, source)
    references public.ical_feeds (id, unit_id, provider)
    on delete set null (ical_feed_id);

alter table public.payments
  drop constraint payments_booking_id_fkey,
  add constraint payments_booking_id_fkey
    foreign key (booking_id, organization_id)
    references public.bookings (id, organization_id);

alter table public.sync_conflicts
  drop constraint sync_conflicts_unit_id_fkey,
  drop constraint sync_conflicts_feed_id_fkey,
  drop constraint sync_conflicts_booking_id_fkey,
  add constraint sync_conflicts_unit_id_fkey
    foreign key (unit_id, organization_id)
    references public.units (id, organization_id) on delete cascade,
  add constraint sync_conflicts_feed_id_fkey
    foreign key (feed_id, unit_id)
    references public.ical_feeds (id, unit_id) on delete cascade,
  add constraint sync_conflicts_booking_id_fkey
    foreign key (booking_id, unit_id)
    references public.bookings (id, unit_id)
    on delete set null (booking_id);

-- ---------------------------------------------------------------------------
-- The trigger and its function are no longer needed
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['properties', 'units', 'unit_prices', 'photos', 'ical_feeds', 'bookings',
                           'payments', 'sync_conflicts']
  loop
    execute format('drop trigger enforce_organization on public.%I', t);
  end loop;
end
$$;

drop function public.enforce_organization();
