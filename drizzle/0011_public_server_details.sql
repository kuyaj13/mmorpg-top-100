BEGIN;

ALTER TABLE app.servers
  ADD COLUMN game_version varchar(60),
  ADD COLUMN region varchar(60),
  ADD COLUMN mode varchar(10),
  ADD COLUMN description varchar(1000),
  ADD CONSTRAINT servers_game_version_not_blank CHECK (game_version IS NULL OR btrim(game_version) <> ''),
  ADD CONSTRAINT servers_region_not_blank CHECK (region IS NULL OR btrim(region) <> ''),
  ADD CONSTRAINT servers_mode_allowed CHECK (mode IS NULL OR mode IN ('PvE', 'PvP', 'RPG')),
  ADD CONSTRAINT servers_description_not_blank CHECK (description IS NULL OR btrim(description) <> '');

WITH latest_approval AS (
  SELECT DISTINCT ON (event.server_id)
         event.server_id, submitted.game_version, submitted.region, submitted.mode, submitted.description
    FROM app.server_moderation_events event
    JOIN app.server_submissions submitted ON submitted.id = event.submission_id
   WHERE event.decision = 'approve' AND event.server_id IS NOT NULL
   ORDER BY event.server_id, event.created_at DESC, event.id DESC
)
UPDATE app.servers server
   SET game_version = approval.game_version,
       region = approval.region,
       mode = approval.mode,
       description = approval.description
  FROM latest_approval approval
 WHERE server.id = approval.server_id;

CREATE FUNCTION app.copy_approved_submission_details()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  IF NEW.decision = 'approve' AND NEW.server_id IS NOT NULL THEN
    UPDATE app.servers server
       SET game_version = submitted.game_version,
           region = submitted.region,
           mode = submitted.mode,
           description = submitted.description
      FROM app.server_submissions submitted
     WHERE server.id = NEW.server_id AND submitted.id = NEW.submission_id;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER server_moderation_copy_approved_details
AFTER INSERT ON app.server_moderation_events
FOR EACH ROW EXECUTE FUNCTION app.copy_approved_submission_details();

CREATE OR REPLACE VIEW api.public_rankings AS
  SELECT s.id, s.game_slug, s.name, s.vote_count, s.created_at, s.website,
         s.game_version, s.region, s.mode, s.description,
         banner.id AS banner_id, banner.alt_text AS banner_alt_text
    FROM app.servers s
    JOIN app.games g ON g.slug = s.game_slug
    LEFT JOIN app.banner_assets banner
      ON banner.server_id = s.id AND banner.banner_kind = 'free' AND banner.moderation_status = 'approved'
   WHERE s.status = 'active' AND g.is_active;

REVOKE ALL ON FUNCTION app.copy_approved_submission_details() FROM PUBLIC, hyperdrive_reader;
REVOKE ALL ON api.public_rankings FROM PUBLIC;
GRANT SELECT ON api.public_rankings TO hyperdrive_reader;

COMMIT;
