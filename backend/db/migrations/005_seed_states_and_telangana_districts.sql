-- 005_seed_states_and_telangana_districts.sql
--
-- Seeds `states` with every state actually observed in the source data (so
-- ingestion never has to silently invent a state row) and marks Telangana
-- as the one supported state for this product phase. Seeds Telangana's
-- districts from the real district names observed in
-- ~/Yieldmodelling/data/historical_mandi_prices.csv (13 districts) — these
-- are not invented; every other state's districts are intentionally left
-- for the ETL loader to upsert on ingestion, since only Telangana's are
-- needed ahead of time (Telangana-first location model, Phase 11).
--
-- Markets and commodities are NOT seeded here: with ~188 Telangana markets
-- and ~118 commodities, hand-seeding would risk drifting from whatever the
-- actual ingested source contains. scripts/etl/ingest_market_prices.py
-- upserts both from real rows as it loads, which is the more scalable and
-- honest way to populate them.

INSERT INTO states (name, is_supported) VALUES
  ('Telangana', TRUE),
  ('Andhra Pradesh', FALSE),
  ('Arunachal Pradesh', FALSE),
  ('Assam', FALSE),
  ('Bihar', FALSE),
  ('Chandigarh', FALSE),
  ('Chattisgarh', FALSE),
  ('Goa', FALSE),
  ('Gujarat', FALSE),
  ('Haryana', FALSE),
  ('Himachal Pradesh', FALSE),
  ('Jammu and Kashmir', FALSE),
  ('Karnataka', FALSE),
  ('Kerala', FALSE),
  ('Madhya Pradesh', FALSE),
  ('Maharashtra', FALSE),
  ('Manipur', FALSE),
  ('Meghalaya', FALSE),
  ('NCT of Delhi', FALSE),
  ('Nagaland', FALSE),
  ('Odisha', FALSE),
  ('Pondicherry', FALSE),
  ('Punjab', FALSE),
  ('Rajasthan', FALSE),
  ('Tamil Nadu', FALSE),
  ('Tripura', FALSE),
  ('Uttar Pradesh', FALSE),
  ('Uttarakhand', FALSE),
  ('Uttrakhand', FALSE),
  ('West Bengal', FALSE)
ON CONFLICT (name) DO UPDATE SET is_supported = EXCLUDED.is_supported WHERE states.name = 'Telangana';

INSERT INTO districts (state_id, name)
SELECT s.id, d.name
FROM states s
JOIN (VALUES
  ('Adilabad'), ('Bhadradri Kothagudem'), ('Hyderabad'), ('Jagityal'),
  ('Karimnagar'), ('Khammam'), ('Mahbubnagar'), ('Medak'), ('Nalgonda'),
  ('Nizamabad'), ('Rajanna Siricilla'), ('Ranga Reddy'), ('Warangal')
) AS d(name) ON TRUE
WHERE s.name = 'Telangana'
ON CONFLICT (state_id, name) DO NOTHING;
