
# Fix: Resolve City/Region from zip_codes Table When Reverse-Geocode Returns Null

**Status:** Approved & Implemented
**Date:** 2026-03-04

Adds a fallback in the `reverse-geocode` edge function to populate city/region from the local `zip_codes` table when Nominatim returns null. Also backfilled existing `url_events` rows. See `docs/decisions/geocoding/2026-03-04_zip-fallback-city-region_feature-doc_lovable.md` for full details.
