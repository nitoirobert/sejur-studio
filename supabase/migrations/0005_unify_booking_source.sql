-- 0005_unify_booking_source: one enum for "where a booking comes from".
--
-- ical_provider ('booking', 'airbnb', 'altul') was booking_source minus 'direct': the same value
-- list written twice, and an imported booking's source had to equal its feed's provider by
-- convention only. ical_feeds.provider now uses booking_source (a feed is never 'direct'), so a
-- new channel is added in one place. 0006 ties bookings.source to the feed's provider.

alter table public.ical_feeds
  alter column provider type public.booking_source using provider::text::public.booking_source;

alter table public.ical_feeds
  add constraint ical_feeds_provider_not_direct check (provider <> 'direct');

drop type public.ical_provider;
