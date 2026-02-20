ALTER TABLE events_actions
  DROP CONSTRAINT events_actions_mobilize_code_utm_id_key;

CREATE UNIQUE INDEX idx_unique_mobilize_utm_per_campaign
  ON events_actions (campaign_id, mobilize_code, utm_id)
  WHERE mobilize_code IS NOT NULL;