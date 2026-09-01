BEGIN;

CREATE SCHEMA app;
CREATE SCHEMA api;

CREATE TABLE app.games (
  slug varchar(100) PRIMARY KEY,
  name varchar(120) NOT NULL,
  game_type varchar(30) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT games_name_unique UNIQUE (name),
  CONSTRAINT games_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  CONSTRAINT games_name_not_blank CHECK (btrim(name) <> ''),
  CONSTRAINT games_type_allowed CHECK (game_type IN ('MMORPG', 'STRATEGY', 'RPG', 'GENERAL', 'FPS', 'CONSOLE'))
);

CREATE TABLE app.servers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_slug varchar(100) NOT NULL REFERENCES app.games(slug) ON UPDATE RESTRICT ON DELETE RESTRICT,
  name varchar(80) NOT NULL,
  website text NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'active',
  vote_count bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT servers_name_per_game_unique UNIQUE (game_slug, name),
  CONSTRAINT servers_website_unique UNIQUE (website),
  CONSTRAINT servers_name_not_blank CHECK (btrim(name) <> ''),
  CONSTRAINT servers_website_https CHECK (website ~* '^https://'),
  CONSTRAINT servers_status_allowed CHECK (status IN ('active', 'inactive', 'suspended')),
  CONSTRAINT servers_votes_nonnegative CHECK (vote_count >= 0)
);

CREATE INDEX servers_public_ranking_idx
  ON app.servers (game_slug, vote_count DESC, created_at ASC, id ASC)
  WHERE status = 'active';

CREATE VIEW api.public_games AS
  SELECT slug, name
    FROM app.games
   WHERE is_active;

CREATE VIEW api.public_rankings AS
  SELECT s.id, s.game_slug, s.name, s.vote_count, s.created_at
    FROM app.servers s
    JOIN app.games g ON g.slug = s.game_slug
   WHERE s.status = 'active' AND g.is_active;

REVOKE ALL ON SCHEMA app FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA app FROM PUBLIC;
REVOKE ALL ON SCHEMA api FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA api FROM PUBLIC;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA app FROM hyperdrive_reader;
REVOKE ALL ON ALL TABLES IN SCHEMA app FROM hyperdrive_reader;
REVOKE ALL ON SCHEMA api FROM hyperdrive_reader;
REVOKE ALL ON ALL TABLES IN SCHEMA api FROM hyperdrive_reader;
GRANT CONNECT ON DATABASE neondb TO hyperdrive_reader;
GRANT USAGE ON SCHEMA api TO hyperdrive_reader;
GRANT SELECT ON api.public_games, api.public_rankings TO hyperdrive_reader;

ALTER DEFAULT PRIVILEGES IN SCHEMA app REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA api REVOKE ALL ON TABLES FROM PUBLIC;

COMMIT;
