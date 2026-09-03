BEGIN;

CREATE TABLE app.server_moderation_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  submission_id uuid NOT NULL REFERENCES app.server_submissions(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  moderator_key bytea NOT NULL,
  operation_id uuid NOT NULL UNIQUE,
  decision varchar(10) NOT NULL,
  reason_code varchar(40),
  server_id uuid REFERENCES app.servers(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT server_moderation_events_moderator_key_length CHECK (octet_length(moderator_key) = 32),
  CONSTRAINT server_moderation_events_decision_allowed CHECK (decision IN ('approve', 'reject')),
  CONSTRAINT server_moderation_events_reason_shape CHECK (
    (decision = 'approve' AND reason_code IS NULL) OR
    (decision = 'reject' AND reason_code ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$')
  )
);

CREATE INDEX server_moderation_events_submission_idx
  ON app.server_moderation_events (submission_id, created_at ASC, id ASC);

CREATE FUNCTION app.reject_moderation_event_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'moderation history is append-only';
END;
$$;

CREATE TRIGGER server_moderation_events_append_only
BEFORE UPDATE OR DELETE ON app.server_moderation_events
FOR EACH ROW EXECUTE FUNCTION app.reject_moderation_event_mutation();

CREATE FUNCTION api.list_pending_server_submissions()
RETURNS TABLE (
  id uuid, game_slug varchar, game_name varchar, name varchar, website text,
  game_version varchar, region varchar, mode varchar, description varchar, created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT s.id, s.game_slug, g.name, s.name, s.website, s.game_version,
         s.region, s.mode, s.description, s.created_at
    FROM app.server_submissions s
    JOIN app.games g ON g.slug = s.game_slug
   WHERE s.status = 'pending'
   ORDER BY s.created_at ASC, s.id ASC
   LIMIT 100
$$;

CREATE FUNCTION api.moderate_server_submission(
  requested_submission_id uuid,
  requested_moderator_key bytea,
  requested_decision varchar,
  requested_reason_code varchar,
  requested_operation_id uuid
)
RETURNS TABLE (outcome text, server_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  candidate app.server_submissions%ROWTYPE;
  created_server_id uuid;
BEGIN
  IF octet_length(requested_moderator_key) <> 32 OR requested_decision NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'invalid moderation request';
  END IF;
  IF requested_decision = 'reject' AND requested_reason_code !~ '^[a-z0-9]+(?:_[a-z0-9]+)*$' THEN
    RAISE EXCEPTION 'invalid rejection reason';
  END IF;

  SELECT e.server_id INTO created_server_id FROM app.server_moderation_events e
   WHERE e.operation_id = requested_operation_id AND e.submission_id = requested_submission_id
     AND e.moderator_key = requested_moderator_key AND e.decision = requested_decision
     AND e.reason_code IS NOT DISTINCT FROM requested_reason_code;
  IF FOUND THEN
    RETURN QUERY SELECT CASE requested_decision WHEN 'approve' THEN 'approved' ELSE 'rejected' END::text, created_server_id;
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM app.server_moderation_events e WHERE e.operation_id = requested_operation_id) THEN
    RETURN QUERY SELECT 'already_resolved'::text, NULL::uuid;
    RETURN;
  END IF;

  SELECT * INTO candidate FROM app.server_submissions s
   WHERE s.id = requested_submission_id FOR UPDATE;
  IF NOT FOUND OR candidate.status <> 'pending' THEN
    RETURN QUERY SELECT 'already_resolved'::text, NULL::uuid;
    RETURN;
  END IF;

  IF requested_decision = 'reject' THEN
    UPDATE app.server_submissions SET status = 'rejected', reviewed_at = clock_timestamp()
     WHERE id = candidate.id;
    INSERT INTO app.server_moderation_events (submission_id, moderator_key, operation_id, decision, reason_code)
    VALUES (candidate.id, requested_moderator_key, requested_operation_id, 'reject', requested_reason_code);
    RETURN QUERY SELECT 'rejected'::text, NULL::uuid;
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('submission-name:' || candidate.game_slug || ':' || lower(btrim(candidate.name)), 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('submission-website:' || candidate.website_host, 0));
  IF NOT EXISTS (SELECT 1 FROM app.games g WHERE g.slug = candidate.game_slug AND g.is_active) THEN
    RETURN QUERY SELECT 'game_unavailable'::text, NULL::uuid;
    RETURN;
  END IF;
  IF EXISTS (
    SELECT 1 FROM app.servers s
     WHERE (s.game_slug = candidate.game_slug AND lower(btrim(s.name)) = lower(btrim(candidate.name)))
        OR lower(split_part(split_part(s.website, '://', 2), '/', 1)) = candidate.website_host
  ) THEN
    RETURN QUERY SELECT 'duplicate'::text, NULL::uuid;
    RETURN;
  END IF;

  INSERT INTO app.servers (game_slug, name, website, status)
  VALUES (candidate.game_slug, btrim(candidate.name), candidate.website, 'active')
  RETURNING id INTO created_server_id;
  UPDATE app.server_submissions SET status = 'approved', reviewed_at = clock_timestamp()
   WHERE id = candidate.id;
  INSERT INTO app.server_moderation_events (submission_id, moderator_key, operation_id, decision, server_id)
  VALUES (candidate.id, requested_moderator_key, requested_operation_id, 'approve', created_server_id);
  RETURN QUERY SELECT 'approved'::text, created_server_id;
END;
$$;

REVOKE ALL ON app.server_moderation_events FROM PUBLIC;
REVOKE ALL ON app.server_moderation_events FROM hyperdrive_reader;
REVOKE ALL ON FUNCTION app.reject_moderation_event_mutation() FROM PUBLIC;
REVOKE ALL ON FUNCTION api.list_pending_server_submissions() FROM PUBLIC;
REVOKE ALL ON FUNCTION api.moderate_server_submission(uuid, bytea, varchar, varchar, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION api.list_pending_server_submissions() TO hyperdrive_reader;
GRANT EXECUTE ON FUNCTION api.moderate_server_submission(uuid, bytea, varchar, varchar, uuid) TO hyperdrive_reader;

COMMIT;
