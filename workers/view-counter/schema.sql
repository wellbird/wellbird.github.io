CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL,
  title TEXT,
  referrer_host TEXT,
  visitor_key TEXT NOT NULL,
  ts INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_path_ts ON events (path, ts);
CREATE INDEX IF NOT EXISTS idx_events_visitor_path_ts ON events (visitor_key, path, ts);

CREATE TABLE IF NOT EXISTS write_throttle (
  throttle_key TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_write_throttle_expires_at ON write_throttle (expires_at);

CREATE TABLE IF NOT EXISTS daily_path_stats (
  date TEXT NOT NULL,
  path TEXT NOT NULL,
  title TEXT,
  raw_events INTEGER NOT NULL DEFAULT 0,
  views_8h INTEGER NOT NULL DEFAULT 0,
  unique_visitors INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (date, path)
);
CREATE INDEX IF NOT EXISTS idx_daily_path_stats_path_date ON daily_path_stats (path, date);

CREATE TABLE IF NOT EXISTS daily_site_stats (
  date TEXT PRIMARY KEY,
  raw_events INTEGER NOT NULL DEFAULT 0,
  path_views_8h INTEGER NOT NULL DEFAULT 0,
  unique_visitors INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
