PRAGMA foreign_keys = ON;

CREATE TABLE games (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
);

CREATE TABLE servers (
  id TEXT PRIMARY KEY,
  game_slug TEXT NOT NULL REFERENCES games(slug),
  owner_uid TEXT NOT NULL,
  name TEXT NOT NULL,
  website TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
);
CREATE INDEX idx_servers_owner_active ON servers(owner_uid, active);

CREATE TABLE ad_packages (
  code TEXT PRIMARY KEY CHECK (code IN ('exclusive_7_day', 'exclusive_30_day')),
  duration_days INTEGER NOT NULL CHECK (duration_days IN (7, 30)),
  price_minor INTEGER NOT NULL CHECK (price_minor IN (1000, 2000)),
  currency TEXT NOT NULL CHECK (currency = 'USD'),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
);
INSERT INTO ad_packages(code, duration_days, price_minor, currency) VALUES
  ('exclusive_7_day', 7, 1000, 'USD'),
  ('exclusive_30_day', 30, 2000, 'USD');

CREATE TABLE donation_claims (
  id TEXT PRIMARY KEY,
  advertiser_uid TEXT NOT NULL,
  server_id TEXT NOT NULL REFERENCES servers(id),
  package_code TEXT NOT NULL REFERENCES ad_packages(code),
  donor_reference TEXT NOT NULL UNIQUE CHECK (length(donor_reference) BETWEEN 8 AND 128),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected', 'reversed')),
  created_at TEXT NOT NULL,
  reviewed_at TEXT,
  reviewed_by_uid TEXT,
  verified_amount_minor INTEGER,
  verified_currency TEXT,
  reason_code TEXT CHECK (reason_code IS NULL OR reason_code IN ('not_matched', 'wrong_amount', 'reversed', 'duplicate'))
);
CREATE INDEX idx_claims_owner_created ON donation_claims(advertiser_uid, created_at DESC);
CREATE INDEX idx_claims_pending ON donation_claims(status, created_at) WHERE status = 'pending';

CREATE TABLE donation_audit_events (
  id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL REFERENCES donation_claims(id),
  actor_uid TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('submitted', 'verified', 'rejected', 'reversed')),
  reason_code TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE banner_assets (
  id TEXT PRIMARY KEY,
  advertiser_uid TEXT NOT NULL,
  server_id TEXT NOT NULL REFERENCES servers(id),
  claim_id TEXT NOT NULL REFERENCES donation_claims(id),
  original_bytes BLOB NOT NULL CHECK (length(original_bytes) <= 750000),
  original_media_type TEXT NOT NULL CHECK (original_media_type IN ('image/gif', 'image/png', 'image/jpeg', 'image/webp')),
  original_sha256 TEXT NOT NULL CHECK (length(original_sha256) = 64),
  alt_text TEXT NOT NULL CHECK (length(alt_text) BETWEEN 5 AND 180),
  destination_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'quarantined' CHECK (status IN ('quarantined', 'approved', 'rejected', 'suspended')),
  approved_bytes BLOB CHECK (approved_bytes IS NULL OR length(approved_bytes) <= 750000),
  approved_media_type TEXT CHECK (approved_media_type IS NULL OR approved_media_type IN ('image/gif', 'image/png', 'image/jpeg', 'image/webp')),
  fallback_bytes BLOB CHECK (fallback_bytes IS NULL OR length(fallback_bytes) <= 750000),
  width INTEGER,
  height INTEGER,
  frame_count INTEGER,
  animation_duration_ms INTEGER,
  created_at TEXT NOT NULL,
  reviewed_at TEXT,
  reviewed_by_uid TEXT
);
CREATE INDEX idx_banners_quarantine ON banner_assets(status, created_at) WHERE status = 'quarantined';

CREATE TABLE exclusive_placements (
  id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL UNIQUE REFERENCES donation_claims(id),
  banner_id TEXT NOT NULL REFERENCES banner_assets(id),
  server_id TEXT NOT NULL REFERENCES servers(id),
  game_slug TEXT NOT NULL REFERENCES games(slug),
  advertiser_uid TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'waiting', 'expired', 'suspended', 'reversed')),
  starts_at TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  CHECK (starts_at IS NULL OR expires_at > starts_at)
);
CREATE INDEX idx_placements_game_eligible ON exclusive_placements(game_slug, status, starts_at, expires_at);

CREATE TABLE request_limits (
  subject_hash TEXT NOT NULL,
  action TEXT NOT NULL,
  window_started_at INTEGER NOT NULL,
  request_count INTEGER NOT NULL CHECK (request_count >= 0),
  PRIMARY KEY(subject_hash, action, window_started_at)
);
