# Map & Geocoding Provider Evaluation — Telangana-First YieldAI

**Status:** Research/decision doc. No code changed by this document.
**Scope:** Compares map tile/SDK options and geocoding/autocomplete options for the Telangana-focused rebuild, against the current setup (Leaflet + backend Nominatim reverse-geocode proxy at `backend/src/services/geocode.service.ts`, map components in `frontend/components/map/{LocationMap,LocationPicker,AdminRegionsMap}.tsx`).
**Date researched:** 2026-08-17. Google Maps Platform pricing changed materially on 2025-03-01 — treat any pre-2025 blog post or Stack Overflow answer about "the $200 free credit" as outdated.

---

## Current implementation, for reference

`geocode.service.ts` already:
- Hits a **fixed** `https://nominatim.openstreetmap.org/reverse` hostname (no user-controlled host — good, avoids SSRF).
- Sends a real `User-Agent: YieldAI/1.0 (...)` string (Nominatim requires this).
- Caches results in-memory, keyed by lat/lon rounded to 3 decimals (~110m), 200-entry bounded cache, 10-minute TTL.
- Has a 5s timeout and normalizes upstream failures into a small closed error-code set.
- Is called only from `LocationPicker.tsx` on explicit map click (`requestReverseGeocode`) — there is **no** free-text/autocomplete search hitting Nominatim anywhere in the frontend. This matters because Nominatim's usage policy explicitly bans autocomplete use of the public endpoint.

Gap found: there's no explicit outbound rate limiter/queue in front of the Nominatim call. A single user clicking the map can't exceed Nominatim's 1 req/sec fair-use limit, but nothing currently stops burst traffic from **multiple concurrent users** from exceeding it collectively, since every uncached click is a live upstream call. This is worth fixing regardless of which provider is chosen (see Recommendation).

---

## Comparison table

| | Google Maps Platform | OSM + public Nominatim (current) | Self-hosted Nominatim | MapLibre GL JS (tiles) | Leaflet (current, tiles) | Photon | LocationIQ | Bhuvan (ISRO) |
|---|---|---|---|---|---|---|---|---|
| **Free tier** | Per-SKU, resets monthly: India billing = 70K (Essentials, incl. Geocoding)/35K (Pro)/7K (Enterprise) calls/mo; global default 10K/5K/1K. Autocomplete billed per-SKU or free only inside a completed Pro/Enterprise session. | Free, but "fair use," not a quota — see rate limit | Free (self-hosted), you pay infra | Free, open source (BSD-3), no usage cap | Free, open source (BSD-2), no usage cap | Public demo free "reasonable use"; self-host free | 5,000 req/day free | Free for registered users (govt platform) |
| **API key required** | Yes, always (even the "Demo Key" is explicitly non-production) | No key; custom `User-Agent`/Referer required instead | No (self-managed) | No (library itself); tile *source* may require one | No | No for public demo | Yes | Yes (access token, expires daily) |
| **Billing account/credit card required** | Yes, for any production use beyond the non-production Demo Key | No | No | No | No | No | No (free tier is card-free per vendor's own signup flow — not independently verified here) | Unclear — not documented in fetched pages |
| **Rate limits** | Governed by billing/quota, not a hard req/sec; effectively "pay past the free threshold" | **1 req/sec** general; **4 req/min** for any sustained/bulk job; single-threaded, single machine only | Self-set (hardware-bound) | N/A (client library) | N/A (client library) | "Reasonable use," throttled/banned if abused — no published number found | 2 req/sec typical on free tier per vendor docs (not independently verified via official source in this pass) | Not documented in fetched pages |
| **Reverse geocoding** | Yes (Geocoding API) | Yes (current setup) | Yes | N/A | N/A | Yes | Yes | Yes ("Village Reverse Geocoding") |
| **Autocomplete** | Yes (Places API Autocomplete / Autocomplete (New)) | **Explicitly prohibited** on the public endpoint by policy | Possible, self-managed | N/A | N/A | Yes (`/api?q=`, is a proper autocomplete-oriented geocoder) | Yes | Not documented as autocomplete-oriented |
| **Telangana/India accuracy** | Generally strong (Google's own India-scale data + partnerships); not independently benchmarked here | Depends on OSM community mapping density; district/state resolution (what YieldAI needs) is generally reliable, street-level less so in rural areas | Same underlying OSM data as public instance — accuracy identical, only availability differs | N/A (tiles, not geocoding) | N/A (tiles, not geocoding) | Same OSM data as Nominatim, indexed differently | Uses OSM/other sources; India coverage not independently verified here | India-government-authoritative for village/administrative boundaries, likely the *most* authoritative for Telangana admin geography specifically, but API maturity/uptime for third-party integration not verified |
| **Licensing** | Proprietary; Google ToS restricts caching results, restricts use with non-Google base maps, prohibits certain resale/redistribution | **ODbL** — requires attribution, share-alike on any produced database | Same ODbL obligations | BSD-3 (library only; tile data license depends on source) | BSD-2 (library only) | Apache-2.0 (software); underlying OSM data still ODbL | Proprietary ToS | Government ToS, not independently reviewed here |
| **Implementation complexity (from current state)** | Medium-high: new backend proxy or client key management, billing account, key restriction/security setup, cost monitoring | None — already implemented | High: server provisioning, Postgres+PostGIS, large data import, ongoing updates | Medium: swap Leaflet→MapLibre, pick vector tile source, restyle | None — already implemented | Low-medium: swap upstream URL in existing service, same JSON-ish shape effort as Nominatim | Low: swap upstream URL + add API key config | Medium-high: undocumented/inconsistent public API docs, auth token refresh daily |
| **Privacy** | Google logs and may retain query data per its privacy policy; sends farm-level lat/lon to a third party with broad data practices | OSMF is a nonprofit; policy-scoped logging, smaller commercial surface | Full control, no third-party sees queries | N/A | N/A | Komoot-run public demo has its own logging; self-host removes it | Commercial vendor, standard SaaS logging | Government-run; data residency stays in India, which may be a genuine compliance plus for an India-focused agri product |
| **Production viability today for YieldAI** | Viable but requires a required paid-capable secret (billing account) team explicitly wants to avoid without strong justification | Viable at current scale if a rate limiter/queue is added; already implemented | Overkill for current scale/team size | Viable, but not clearly better than Leaflet at this project's map complexity | Viable, already working | Strong fallback/second-source candidate, no new secret required | Viable secondary/fallback option, needs 1 new optional secret | Interesting but too undocumented/unproven to be primary today |

---

## 1. Google Maps Platform (Maps JS SDK, Geocoding API, Places Autocomplete)

**Pricing — verified against official Google docs, not third-party summaries:**
- Google retired the old universal "$200/month credit" model on **March 1, 2025** (`developers.google.com/maps/billing-and-pricing/march-2025`). It was replaced with **per-SKU free monthly thresholds**: Essentials-tier SKUs (which include Geocoding) get **10,000 free requests/month globally**, Pro SKUs get 5,000, Enterprise SKUs get 1,000.
- For accounts billed in **India specifically**, `mapsplatform.google.com/pricing/` states higher India thresholds: **70,000 free calls/month (Essentials)**, **35,000 (Pro)**, **7,000 (Enterprise)**, marked with an asterisk suggesting conditions apply (not fully enumerated on the page as fetched).
- Past the free threshold, Geocoding API is **$5.00 per 1,000 requests** for the 10,001–100,000/month band (official page), stepping down at higher volume tiers.
- **Places Autocomplete** has a materially different pricing model: it's **session-based**. Autocomplete calls are free *only* if grouped into a completed session that ends in a Place Details/Address Validation call (Pro/Enterprise session pricing). If a session is **abandoned** (user never selects a result — very plausible on a farm-picker UI), each keystroke-triggered Autocomplete request reverts to **per-request billing at $2.83 per 1,000 requests**, i.e., an 8-keystroke abandoned search costs about $0.0226 — small per-event, but a real per-use cost with no way to guarantee zero spend.
- Google also introduced flat subscription plans (Starter/Essentials/Pro tiers, roughly $100–$1,200+/month per third-party summaries) as an alternative to pay-as-you-go — not independently verified against an official pricing page in this pass; treat as unconfirmed.

**API key / billing account requirement (verified):** The official "get an API key" doc confirms two paths: (1) a **Maps Demo Key** that skips billing setup but is explicitly documented as "for testing and prototyping purposes only... not designed for production use," and (2) production use, which requires a Google Cloud project, **billing enabled (credit card on file)**, and a generated API key attached to every request. There is no path to production Google Maps usage — even fully within the free monthly threshold — that avoids attaching a credit card to a Cloud billing account. This directly conflicts with the team's stated constraint of not wanting a required paid-capable secret without strong justification.

**Rate limits:** Not a hard requests/sec cap in the way Nominatim has one; instead it's a quota/billing gate — once the free threshold is exceeded, requests still succeed but start incurring cost (or fail if billing/quota caps are set defensively).

**Accuracy in Telangana:** Google's base map and geocoding data for India is generally considered strong at urban/road level; no official Telangana-specific accuracy benchmark was found in this research pass, so this is asserted from general reputation, not an official source — flag as unverified.

**ToS restrictions relevant to a small startup demo:** Google Maps Platform ToS restricts things like: caching/storing geocoding results beyond a short window, using Google-sourced location data on a non-Google base map, and various no-scrape/no-resell clauses. These are meaningful constraints if YieldAI ever wants to persist resolved districts long-term or mix Google geocoding results with a non-Google map (which is exactly what a "Leaflet + Google geocoding" hybrid would do) — worth a legal read if Google is adopted later.

**Verdict:** Google Maps Platform is **not free** for a production app in the sense the team means — it requires a billing account and card on file even to stay under the free monthly threshold, and Autocomplete carries real incremental cost on abandoned sessions. The free-tier *call volume* itself is generous (10K–70K/month depending on billing country) and would likely cover YieldAI's actual current traffic for $0 in practice, but the **required secret/billing-account** is exactly the thing the team asked to avoid without strong justification. There isn't a strong justification visible yet (current OSM-based accuracy/complaints haven't been documented as a problem).

Sources: [Google Maps Platform Pricing](https://mapsplatform.google.com/pricing/), [March 2025 pricing changes](https://developers.google.com/maps/billing-and-pricing/march-2025), [Maps JavaScript API — get an API key](https://developers.google.com/maps/documentation/javascript/get-api-key), [Autocomplete (New) and session pricing](https://developers.google.com/maps/documentation/places/web-service/session-pricing), [Places API usage and billing](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing).

---

## 2. OpenStreetMap + Nominatim (current setup)

**Usage policy (verified from the official OSMF operations policy page):**
- **Rate limit: 1 request per second**, enforced against the public `nominatim.openstreetmap.org` endpoint. Sustained/bulk jobs are held to an even stricter **4 requests per minute**, must run single-threaded, on a single machine, with local caching of results to avoid repeat queries.
- A **valid custom `User-Agent` or HTTP Referer** identifying the specific application is mandatory — default HTTP-library user agents are explicitly rejected. YieldAI's current implementation already does this correctly (`YieldAI/1.0 (agricultural recommendation demo; reverse-geocoding feature)`).
- **Autocomplete/search-as-you-type is explicitly prohibited** on the public instance. YieldAI does not currently do this (only click-driven reverse geocode), so it's compliant today — but this is a hard constraint on any future "type an address" search feature: it cannot be built against the public Nominatim endpoint.
- Grid-style systematic reverse queries and detail-page scraping are banned; results must be cached, and repeated identical queries risk the calling app being flagged/blocked.
- ODbL attribution is required (this should be visible somewhere in the map UI — worth confirming it currently is).

**Self-hosting Nominatim — realistic for this project's scale?** Self-hosting removes the 1 req/sec ceiling and the fair-use risk entirely, but costs a nontrivial ops burden: a dedicated server, PostgreSQL + PostGIS, importing and periodically updating a full or regional OSM extract, and disk/RAM sized for the import (even a single-state or single-country extract needs meaningful resources, and the import process itself is slow and PG-tuning-sensitive). For a small team building a Telangana-first demo/early-stage product, this is very likely **overkill today** — the current click-driven, low-frequency, cached usage pattern is well within the public instance's fair-use envelope, especially once a lightweight outbound rate limiter is added (see Recommendation). Self-hosting becomes worth revisiting only if usage volume grows enough to risk the 1 req/sec ceiling in practice, or if uptime/latency of the public instance becomes a real product problem.

**Accuracy for Telangana:** Depends entirely on OpenStreetMap community mapping density in the state. District/state-level resolution — which is what YieldAI's `resolveDistrictField` logic actually needs (see `DISTRICT_FIELD_PRIORITY` in `geocode.service.ts`) — is generally reliable across India since administrative boundaries are well-mapped in OSM. Street/POI-level accuracy in rural Telangana is more variable and less densely mapped than urban areas, but that's not the resolution YieldAI's forecast-matching logic depends on.

**Licensing (ODbL):** OpenStreetMap data is licensed under the Open Database License. Any produced/derived database must be attributed and, in some interpretations, share-alike. For a service that resolves-and-discards a coordinate → district/state mapping (not redistributing a bulk derived database), this is a low-risk usage pattern, but the map UI should carry OSM attribution regardless (standard Leaflet/OSM tile attribution likely already covers this via the tile layer's attribution control — worth confirming).

Sources: [Nominatim Usage Policy](https://operations.osmfoundation.org/policies/nominatim/), [Nominatim — OpenStreetMap Wiki](https://wiki.openstreetmap.org/wiki/Nominatim).

---

## 3. MapLibre GL JS vs. Leaflet (map tiles/rendering)

MapLibre GL JS is the open-source (BSD-3) community fork of Mapbox GL JS, WebGL-based, vector-tile-first, and requires no API key or account by itself. Leaflet (BSD-2), what YieldAI already uses, is a simpler raster/vector-agnostic DOM-based map library.

**Free/open tile sources that pair with each:**
- **Raw OpenStreetMap raster tiles** (`tile.openstreetmap.org`) — free, works with both Leaflet and MapLibre, but OSMF's own tile usage policy asks production apps to avoid hammering the shared tile server; heavier apps are expected to run their own tile cache or use a commercial provider.
- **MapTiler** — free tier confirmed at **5,000 map-load sessions/month, 1,000 search sessions/month, 100,000 API requests/month**, requires an API key, free tier is licensed for "testing, personal or non-commercial use" only (commercial use requires a paid Flex plan starting ~$30/month per vendor pricing page). This is a real constraint if YieldAI is a commercial product, even pre-revenue.
- **Protomaps** — ships pre-built, downloadable PMTiles basemap files built from OSM data that can be **self-hosted with zero ongoing API dependency and no required key**; a hosted demo API also exists with a documented soft limit around 1,000,000 tile requests/month for light/medium traffic. Protomaps officially targets MapLibre GL (and also supports Leaflet/OpenLayers via a tile source adapter). This is the strongest "free forever, no vendor lock-in" option if/when the project wants vector tiles.

**Is switching to MapLibre worth it?** For YieldAI's actual current map usage — a location picker and an admin regions view, not a data-dense interactive basemap — the practical difference between Leaflet+raster-OSM-tiles and MapLibre+vector-tiles is mostly about rendering performance at high zoom/data density and stylistic flexibility (custom vector styling, smoother zoom, easier choropleth/heatmap-style district overlays). Leaflet is simpler, already integrated (`leaflet@^1.9.4`, `react-leaflet@^5.0.0` per `frontend/package.json`), and has zero migration cost. MapLibre would be justified if YieldAI later wants highly custom Telangana-district styling, smooth vector rendering of many overlapping polygons, or 3D/terrain — none of which is described as a current requirement.

**Recommendation on this sub-question:** Keep Leaflet for now; it's not the bottleneck. If a switch happens later, MapLibre + Protomaps self-hosted PMTiles (built for Telangana/India) is the best-justified free/open combination — no new required key, no vendor billing account.

Sources: [MapLibre GL JS vs. Leaflet](https://blog.jawg.io/maplibre-gl-vs-leaflet-choosing-the-right-tool-for-your-interactive-map/), [Protomaps — the open source map in a file](https://protomaps.com/about), [MapTiler Cloud pricing](https://www.maptiler.com/cloud/pricing/) (note: the more detailed `docs.protomaps.com/basemaps/` page 404'd during this research pass; the summary above relies on `protomaps.com/about` and secondary sources and should be spot-checked before implementation).

---

## 4. Other free/open alternatives relevant to India

**Photon (komoot)** — Open-source (Apache-2.0) geocoder built on the same underlying OSM data as Nominatim but indexed via OpenSearch/Elasticsearch specifically for fast search-as-you-type. Unlike Nominatim, Photon's public demo (`photon.komoot.io`) does **not** prohibit autocomplete use — it's designed for it. Usage policy is "reasonable use," with no specific published rate-limit number found in this research pass (unverified — worth a direct check of komoot's terms before relying on it for autocomplete). Self-hostable from GraphHopper's weekly OSM-derived dumps, including country-level extracts. This is the natural complement to the current Nominatim setup if YieldAI ever wants a real address-search/autocomplete box: Nominatim stays for reverse-geocode (map click → district), Photon (public demo initially, self-hosted later if volume grows) handles forward/autocomplete search, since Nominatim's policy forbids autocomplete outright.

**LocationIQ** — Commercial vendor wrapping OSM/Nominatim-derived data with a friendlier ToS and higher limits: **5,000 requests/day free**, requires an API key but (per vendor's own marketing, not independently verified here) no credit card for the free tier. This is a reasonable low-friction fallback if the public Nominatim instance's 1 req/sec becomes a real constraint before self-hosting is justified — it introduces exactly one new optional secret (an API key, not a billing account), which is a much smaller ask than Google's billing-account requirement.

**Bhuvan (ISRO/NRSC)** — India's national geoportal, includes "Village Geocoding"/"Village Reverse Geocoding" and other thematic APIs, requires a registered access token that expires daily. This is the most *administratively authoritative* option for Indian village/district boundaries specifically, and is government-run (a genuine data-residency/compliance plus for an India-focused agri product). However, the developer-facing API documentation found in this research pass (`bhuvan-app1.nrsc.gov.in/api/`) is thin, the daily-expiring token model adds real integration friction, and no independently-verifiable uptime/rate-limit/ToS information was found. **Not recommended as a primary dependency today** given documentation and reliability are unverified, but worth a follow-up spike if Telangana-specific administrative-boundary precision ever becomes a differentiator worth the integration cost.

Sources: [komoot/photon](https://github.com/komoot/photon), [LocationIQ pricing](https://locationiq.com/pricing), [Bhuvan API](https://bhuvan-app1.nrsc.gov.in/api/), [Bhuvan — OGC blog](https://www.ogc.org/blog-article/bhuvan-transforming-indias-governance-with-geospatial-insights/).

---

## Recommendation

**Use now (free/open, no new required secret):**
1. **Keep Leaflet** for map rendering — it's already integrated, working, and not a bottleneck for the current UI complexity.
2. **Keep the public Nominatim endpoint** for reverse geocoding, but close the one real gap found: add an explicit outbound rate limiter/request queue in `geocode.service.ts` (e.g., cap to ~1 req/sec globally, or queue+coalesce bursts) so concurrent users can't collectively exceed Nominatim's fair-use limit — today nothing but per-user click cadence enforces that. This is a small, low-risk change and directly addresses the policy's actual requirement rather than assuming single-user behavior holds.
3. Center/bound the Leaflet map to Telangana (map `center`/`maxBounds`/default zoom in `LocationMap.tsx`/`LocationPicker.tsx`/`AdminRegionsMap.tsx`) — this is a pure frontend config change, independent of provider choice, and delivers the "Telangana-first" framing the team wants immediately.
4. If/when an address-typing autocomplete box is wanted (Nominatim's policy forbids this), reach for **Photon** (public demo first, self-host later) rather than building autocomplete against Nominatim — that would be a policy violation, not just a bad idea.
5. Confirm OSM/ODbL attribution is visibly present in the map UI (standard Leaflet tile-layer attribution control likely already covers this).

**Do not adopt now:** Google Maps Platform. Its free-tier call volume is genuinely generous (10K–70K/month depending on billing country) and would likely cost $0 in practice at current traffic, but it **requires a Google Cloud billing account with a credit card on file for any production use** — there is no production path that avoids this, per Google's own documentation. That's precisely the required paid-capable secret the team asked to avoid without strong justification, and no such justification (e.g., a documented Nominatim accuracy/reliability failure specific to Telangana) surfaced in this research.

**Keep provider-abstracted for a possible future Google upgrade:** Structure `geocode.service.ts` (and any future forward/autocomplete service) behind a small internal interface (`reverseGeocode(lat, lon): Promise<...>`) rather than hardcoding Nominatim-specific response shapes into callers — it already does this reasonably well via `ReverseGeocodeResult`. If Google is adopted later (e.g., because of a documented, business-justified accuracy problem), swapping the implementation behind that interface should be a contained change: add `GOOGLE_MAPS_API_KEY` as an optional env var, implement a second provider class, and gate it behind a feature flag/env check rather than a hard replacement — so Nominatim remains the zero-secret default and Google becomes an opt-in upgrade path, not a requirement.

**Track as a future spike, not now:** Bhuvan (ISRO), for Telangana-specific administrative-boundary authority, if/when documentation quality can be verified hands-on. Self-hosted Nominatim, if usage volume ever risks the public instance's 1 req/sec ceiling in practice.
