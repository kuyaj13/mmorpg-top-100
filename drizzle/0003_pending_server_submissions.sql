BEGIN;

CREATE TABLE app.server_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_key bytea NOT NULL,
  game_slug varchar(100) NOT NULL REFERENCES app.games(slug) ON UPDATE RESTRICT ON DELETE RESTRICT,
  name varchar(80) NOT NULL,
  website text NOT NULL,
  website_host varchar(253) NOT NULL,
  game_version varchar(60) NOT NULL,
  region varchar(60) NOT NULL,
  mode varchar(10) NOT NULL,
  description varchar(1000) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  CONSTRAINT server_submissions_owner_key_length CHECK (octet_length(owner_key) = 32),
  CONSTRAINT server_submissions_name_not_blank CHECK (btrim(name) <> ''),
  CONSTRAINT server_submissions_website_https CHECK (website ~* '^https://'),
  CONSTRAINT server_submissions_game_version_not_blank CHECK (btrim(game_version) <> ''),
  CONSTRAINT server_submissions_region_not_blank CHECK (btrim(region) <> ''),
  CONSTRAINT server_submissions_mode_allowed CHECK (mode IN ('PvE', 'PvP', 'RPG')),
  CONSTRAINT server_submissions_description_not_blank CHECK (btrim(description) <> ''),
  CONSTRAINT server_submissions_status_allowed CHECK (status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT server_submissions_review_time CHECK (
    (status = 'pending' AND reviewed_at IS NULL) OR
    (status IN ('approved', 'rejected') AND reviewed_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX server_submissions_pending_name_unique
  ON app.server_submissions (game_slug, lower(btrim(name))) WHERE status = 'pending';
CREATE UNIQUE INDEX server_submissions_pending_host_unique
  ON app.server_submissions (website_host) WHERE status = 'pending';
CREATE INDEX server_submissions_pending_queue_idx
  ON app.server_submissions (created_at ASC, id ASC) WHERE status = 'pending';
CREATE INDEX server_submissions_owner_created_idx
  ON app.server_submissions (owner_key, created_at DESC);

CREATE FUNCTION api.submit_server(
  requested_owner_key bytea,
  requested_game_slug varchar,
  requested_name varchar,
  requested_website text,
  requested_website_host varchar,
  requested_game_version varchar,
  requested_region varchar,
  requested_mode varchar,
  requested_description varchar
)
RETURNS TABLE (outcome text, submission_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  normalized_name varchar(80) := btrim(requested_name);
BEGIN
  IF octet_length(requested_owner_key) <> 32 THEN RAISE EXCEPTION 'invalid owner key'; END IF;

  IF NOT EXISTS (SELECT 1 FROM app.games g WHERE g.slug = requested_game_slug AND g.is_active) THEN
    RETURN QUERY SELECT 'game_unavailable'::text, NULL::uuid;
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('submission-owner:' || encode(requested_owner_key, 'hex'), 0));
  IF (SELECT count(*) FROM app.server_submissions s WHERE s.owner_key = requested_owner_key AND s.status = 'pending') >= 3 THEN
    RETURN QUERY SELECT 'limit_reached'::text, NULL::uuid;
    RETURN;
  END IF;

  -- Serialize the two cross-table duplicate checks for the same name and website.
  PERFORM pg_advisory_xact_lock(hashtextextended('submission-name:' || requested_game_slug || ':' || lower(normalized_name), 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('submission-website:' || requested_website_host, 0));

  IF EXISTS (
    SELECT 1 FROM app.servers s
     WHERE (s.game_slug = requested_game_slug AND lower(s.name) = lower(normalized_name))
        OR lower(split_part(split_part(s.website, '://', 2), '/', 1)) = requested_website_host
  ) OR EXISTS (
    SELECT 1 FROM app.server_submissions s
     WHERE s.status = 'pending'
       AND ((s.game_slug = requested_game_slug AND lower(btrim(s.name)) = lower(normalized_name)) OR s.website_host = requested_website_host)
  ) THEN
    RETURN QUERY SELECT 'duplicate'::text, NULL::uuid;
    RETURN;
  END IF;

  INSERT INTO app.server_submissions
    (owner_key, game_slug, name, website, website_host, game_version, region, mode, description)
  VALUES
    (requested_owner_key, requested_game_slug, normalized_name, requested_website, requested_website_host,
     btrim(requested_game_version), btrim(requested_region), requested_mode, btrim(requested_description))
  RETURNING id INTO submission_id;

  RETURN QUERY SELECT 'accepted'::text, submission_id;
END;
$$;

REVOKE ALL ON app.server_submissions FROM PUBLIC;
REVOKE ALL ON app.server_submissions FROM hyperdrive_reader;
REVOKE ALL ON FUNCTION api.submit_server(bytea, varchar, varchar, text, varchar, varchar, varchar, varchar, varchar) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION api.submit_server(bytea, varchar, varchar, text, varchar, varchar, varchar, varchar, varchar) TO hyperdrive_reader;

COMMIT;
