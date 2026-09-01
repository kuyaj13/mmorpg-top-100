BEGIN;

CREATE OR REPLACE VIEW api.public_rankings AS
  SELECT s.id, s.game_slug, s.name, s.vote_count, s.created_at, s.website
    FROM app.servers s
    JOIN app.games g ON g.slug = s.game_slug
   WHERE s.status = 'active' AND g.is_active;

REVOKE ALL ON api.public_rankings FROM PUBLIC;
GRANT SELECT ON api.public_rankings TO hyperdrive_reader;

COMMIT;
