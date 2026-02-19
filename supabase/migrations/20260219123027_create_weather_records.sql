CREATE TABLE weather_records (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  condition TEXT NOT NULL,
  condition_text TEXT NOT NULL,
  temp_high INTEGER NOT NULL,
  temp_low INTEGER NOT NULL,
  rain_prob INTEGER NOT NULL,
  humidity INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_weather_records_date ON weather_records(date);

ALTER TABLE weather_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all" ON weather_records FOR ALL USING (true) WITH CHECK (true);
