-- App-level settings key-value store
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Initial setting: calendar popup enabled
INSERT INTO app_settings (key, value) VALUES ('calendar_popup_enabled', 'true')
ON CONFLICT (key) DO NOTHING;
