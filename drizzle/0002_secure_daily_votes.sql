BEGIN;

CREATE TABLE app.votes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  server_id uuid NOT NULL REFERENCES app.servers(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  voter_key bytea NOT NULL,
  voting_day date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT votes_voter_key_length CHECK (octet_length(voter_key) = 32),
  CONSTRAINT votes_one_per_server_day UNIQUE (server_id, voter_key, voting_day)
);

CREATE INDEX votes_server_created_idx ON app.votes (server_id, created_at DESC);

CREATE FUNCTION app.reject_vote_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'vote records are append-only';
END;
$$;

CREATE TRIGGER votes_append_only
BEFORE UPDATE OR DELETE ON app.votes
FOR EACH ROW EXECUTE FUNCTION app.reject_vote_mutation();

CREATE FUNCTION app.increment_server_vote_count()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE app.servers
     SET vote_count = vote_count + 1
   WHERE id = NEW.server_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER votes_increment_server_count
AFTER INSERT ON app.votes
FOR EACH ROW EXECUTE FUNCTION app.increment_server_vote_count();

CREATE FUNCTION api.cast_daily_vote(requested_server_id uuid, requested_voter_key bytea)
RETURNS TABLE (recorded boolean, votes bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  inserted_count integer;
  utc_day date := (clock_timestamp() AT TIME ZONE 'UTC')::date;
BEGIN
  IF octet_length(requested_voter_key) <> 32 THEN
    RAISE EXCEPTION 'invalid voter key';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM app.servers s
      JOIN app.games g ON g.slug = s.game_slug
     WHERE s.id = requested_server_id
       AND s.status = 'active'
       AND g.is_active
  ) THEN
    RETURN;
  END IF;

  INSERT INTO app.votes (server_id, voter_key, voting_day)
  VALUES (requested_server_id, requested_voter_key, utc_day)
  ON CONFLICT (server_id, voter_key, voting_day) DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  RETURN QUERY
    SELECT inserted_count = 1, s.vote_count
      FROM app.servers s
     WHERE s.id = requested_server_id;
END;
$$;

REVOKE ALL ON app.votes FROM PUBLIC;
REVOKE ALL ON app.votes FROM hyperdrive_reader;
REVOKE ALL ON FUNCTION app.reject_vote_mutation() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.increment_server_vote_count() FROM PUBLIC;
REVOKE ALL ON FUNCTION api.cast_daily_vote(uuid, bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION api.cast_daily_vote(uuid, bytea) TO hyperdrive_reader;

COMMIT;
