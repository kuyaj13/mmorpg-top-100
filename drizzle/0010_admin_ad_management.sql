BEGIN;

CREATE TABLE app.exclusive_placement_admin_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id uuid NOT NULL REFERENCES app.exclusive_placements(id) ON DELETE RESTRICT,
  moderator_key bytea NOT NULL CHECK (octet_length(moderator_key)=32),
  decision varchar(20) NOT NULL CHECK (decision IN ('suspend','reactivate')),
  operation_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER exclusive_placement_admin_events_append_only BEFORE UPDATE OR DELETE ON app.exclusive_placement_admin_events
FOR EACH ROW EXECUTE FUNCTION app.reject_moderation_event_mutation();

CREATE FUNCTION api.list_admin_exclusive_placements()
RETURNS TABLE(id uuid,server_name varchar,website text,game_slug varchar,game_name varchar,duration_days integer,status varchar,starts_at timestamptz,expires_at timestamptz,queued_at timestamptz,banner_status varchar,claim_status varchar)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT p.id,s.name,s.website,s.game_slug,g.name,p.duration_days,p.status,p.starts_at,p.expires_at,p.queued_at,b.moderation_status,d.status
 FROM app.exclusive_placements p JOIN app.servers s ON s.id=p.server_id JOIN app.games g ON g.slug=s.game_slug
 JOIN app.banner_assets b ON b.id=p.banner_id JOIN app.donation_claims d ON d.id=p.donation_claim_id
 ORDER BY CASE p.status WHEN 'active' THEN 1 WHEN 'waiting' THEN 2 WHEN 'suspended' THEN 3 ELSE 4 END,
          COALESCE(p.expires_at,p.queued_at) DESC,p.id LIMIT 100
$$;

CREATE FUNCTION api.moderate_exclusive_placement(uuid,bytea,varchar,uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE p app.exclusive_placements%ROWTYPE; existing app.exclusive_placement_admin_events%ROWTYPE; active_count integer;
BEGIN
 IF $1 IS NULL OR $2 IS NULL OR octet_length($2)<>32 OR $3 NOT IN ('suspend','reactivate') OR $4 IS NULL THEN RETURN 'invalid'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('exclusive-placement-operation:'||$4::text,0));
 SELECT * INTO existing FROM app.exclusive_placement_admin_events WHERE operation_id=$4;
 IF FOUND THEN RETURN CASE WHEN existing.placement_id=$1 AND existing.moderator_key=$2 AND existing.decision=$3 THEN existing.decision ELSE 'unavailable' END; END IF;
 SELECT * INTO p FROM app.exclusive_placements WHERE id=$1 FOR UPDATE;
 IF NOT FOUND THEN RETURN 'unavailable'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('exclusive-game:'||(SELECT game_slug FROM app.servers WHERE id=p.server_id),0));
 IF $3='suspend' THEN
   IF p.status NOT IN ('active','waiting') THEN RETURN 'unavailable'; END IF;
   UPDATE app.exclusive_placements SET status='suspended' WHERE id=$1;
 ELSE
   IF p.status<>'suspended' THEN RETURN 'unavailable'; END IF;
   IF p.expires_at IS NOT NULL AND p.expires_at<=clock_timestamp() THEN UPDATE app.exclusive_placements SET status='expired' WHERE id=$1; RETURN 'expired'; END IF;
   IF NOT EXISTS(SELECT 1 FROM app.servers s JOIN app.games g ON g.slug=s.game_slug JOIN app.banner_assets b ON b.id=p.banner_id JOIN app.donation_claims d ON d.id=p.donation_claim_id WHERE s.id=p.server_id AND s.status='active' AND g.is_active AND b.moderation_status='approved' AND d.status='verified') THEN RETURN 'ineligible'; END IF;
   IF p.starts_at IS NULL THEN UPDATE app.exclusive_placements SET status='waiting' WHERE id=$1;
   ELSE
     SELECT count(*) INTO active_count FROM app.exclusive_placements x JOIN app.servers s ON s.id=x.server_id WHERE s.game_slug=(SELECT game_slug FROM app.servers WHERE id=p.server_id) AND x.status='active' AND x.expires_at>clock_timestamp();
     IF active_count>=3 THEN RETURN 'inventory_full'; END IF;
     UPDATE app.exclusive_placements SET status='active' WHERE id=$1;
   END IF;
 END IF;
 INSERT INTO app.exclusive_placement_admin_events(placement_id,moderator_key,decision,operation_id) VALUES($1,$2,$3,$4);
 RETURN $3;
END $$;

REVOKE ALL ON app.exclusive_placement_admin_events FROM PUBLIC,hyperdrive_reader;
REVOKE ALL ON FUNCTION api.list_admin_exclusive_placements() FROM PUBLIC;
REVOKE ALL ON FUNCTION api.moderate_exclusive_placement(uuid,bytea,varchar,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION api.list_admin_exclusive_placements() TO hyperdrive_reader;
GRANT EXECUTE ON FUNCTION api.moderate_exclusive_placement(uuid,bytea,varchar,uuid) TO hyperdrive_reader;
COMMIT;
