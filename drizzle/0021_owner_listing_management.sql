BEGIN;

CREATE TABLE app.server_listing_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid NOT NULL REFERENCES app.servers(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  owner_key bytea NOT NULL CHECK (octet_length(owner_key)=32),
  name varchar(80) NOT NULL CHECK (btrim(name)<>''),
  website text NOT NULL CHECK (website ~* '^https://'),
  website_host varchar(253) NOT NULL,
  game_version varchar(60) NOT NULL CHECK (btrim(game_version)<>''),
  region varchar(60) NOT NULL CHECK (btrim(region)<>''),
  mode varchar(10) NOT NULL CHECK (mode IN ('PvE','PvP','RPG')),
  description varchar(1000) NOT NULL CHECK (btrim(description)<>''),
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(), reviewed_at timestamptz
);
CREATE UNIQUE INDEX server_listing_changes_one_pending ON app.server_listing_changes(server_id) WHERE status='pending';
CREATE TABLE app.server_listing_change_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  change_id uuid NOT NULL REFERENCES app.server_listing_changes(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  moderator_key bytea NOT NULL CHECK(octet_length(moderator_key)=32),
  operation_id uuid NOT NULL UNIQUE, decision varchar(10) NOT NULL CHECK(decision IN ('approve','reject')),
  reason_code varchar(40), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER server_listing_change_events_append_only BEFORE UPDATE OR DELETE ON app.server_listing_change_events FOR EACH ROW EXECUTE FUNCTION app.reject_moderation_event_mutation();

DROP FUNCTION api.list_owned_servers(bytea);
CREATE FUNCTION api.list_owned_servers(bytea)
RETURNS TABLE(id uuid,name varchar,game_slug varchar,game_name varchar,website text,game_version varchar,region varchar,mode varchar,description varchar,has_pending_change boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN
 IF octet_length($1)<>32 THEN RAISE EXCEPTION 'invalid owner key'; END IF;
 RETURN QUERY SELECT s.id,s.name,s.game_slug,g.name,s.website,s.game_version,s.region,s.mode,s.description,
  EXISTS(SELECT 1 FROM app.server_listing_changes c WHERE c.server_id=s.id AND c.status='pending')
 FROM app.servers s JOIN app.games g ON g.slug=s.game_slug WHERE s.owner_key=$1 AND s.status='active' AND g.is_active ORDER BY g.name,s.name,s.id LIMIT 100;
END $$;

CREATE FUNCTION api.request_server_listing_change(bytea,uuid,varchar,text,varchar,varchar,varchar,varchar,varchar) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN
 IF octet_length($1)<>32 OR length(btrim($3)) NOT BETWEEN 2 AND 80 OR $4 !~* '^https://' OR length($5)>253 OR length(btrim($6)) NOT BETWEEN 1 AND 60 OR length(btrim($7)) NOT BETWEEN 1 AND 60 OR $8 NOT IN ('PvE','PvP','RPG') OR length(btrim($9)) NOT BETWEEN 20 AND 1000 THEN RETURN 'invalid'; END IF;
 IF NOT EXISTS(SELECT 1 FROM app.servers WHERE id=$2 AND owner_key=$1 AND status='active') THEN RETURN 'unavailable'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('listing-change:'||$2::text,0));
 IF EXISTS(SELECT 1 FROM app.server_listing_changes WHERE server_id=$2 AND status='pending') THEN RETURN 'pending'; END IF;
 IF EXISTS(SELECT 1 FROM app.servers s WHERE s.id<>$2 AND (lower(btrim(s.name))=lower(btrim($3)) OR lower(split_part(split_part(s.website,'://',2),'/',1))=lower($5))) THEN RETURN 'duplicate'; END IF;
 INSERT INTO app.server_listing_changes(server_id,owner_key,name,website,website_host,game_version,region,mode,description) VALUES($2,$1,btrim($3),$4,lower($5),btrim($6),btrim($7),$8,btrim($9)); RETURN 'pending';
END $$;

CREATE FUNCTION api.remove_owned_server(bytea,uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN
 IF octet_length($1)<>32 THEN RETURN 'unavailable'; END IF;
 UPDATE app.servers SET status='inactive' WHERE id=$2 AND owner_key=$1 AND status='active';
 IF NOT FOUND THEN RETURN 'unavailable'; END IF;
 UPDATE app.server_listing_changes SET status='rejected',reviewed_at=clock_timestamp() WHERE server_id=$2 AND status='pending';
 UPDATE app.exclusive_placements SET status='suspended' WHERE server_id=$2 AND status IN ('active','waiting'); RETURN 'removed';
END $$;

CREATE FUNCTION api.list_pending_server_listing_changes() RETURNS TABLE(id uuid,server_id uuid,game_slug varchar,game_name varchar,name varchar,website text,game_version varchar,region varchar,mode varchar,description varchar,created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$ SELECT c.id,c.server_id,s.game_slug,g.name,c.name,c.website,c.game_version,c.region,c.mode,c.description,c.created_at FROM app.server_listing_changes c JOIN app.servers s ON s.id=c.server_id JOIN app.games g ON g.slug=s.game_slug WHERE c.status='pending' AND s.status='active' ORDER BY c.created_at,c.id LIMIT 100 $$;

CREATE FUNCTION api.moderate_server_listing_change(uuid,bytea,varchar,varchar,uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE c app.server_listing_changes%ROWTYPE; existing app.server_listing_change_events%ROWTYPE; BEGIN
 IF octet_length($2)<>32 OR $3 NOT IN ('approve','reject') THEN RETURN 'invalid'; END IF;
 SELECT * INTO existing FROM app.server_listing_change_events WHERE operation_id=$5; IF FOUND THEN RETURN CASE WHEN existing.change_id=$1 AND existing.moderator_key=$2 AND existing.decision=$3 THEN CASE $3 WHEN 'approve' THEN 'approved' ELSE 'rejected' END ELSE 'unavailable' END; END IF;
 SELECT * INTO c FROM app.server_listing_changes WHERE id=$1 FOR UPDATE; IF NOT FOUND OR c.status<>'pending' THEN RETURN 'unavailable'; END IF;
 IF $3='approve' THEN
  IF EXISTS(SELECT 1 FROM app.servers s WHERE s.id<>c.server_id AND (lower(btrim(s.name))=lower(btrim(c.name)) OR lower(split_part(split_part(s.website,'://',2),'/',1))=c.website_host)) THEN RETURN 'duplicate'; END IF;
  UPDATE app.servers SET name=c.name,website=c.website,game_version=c.game_version,region=c.region,mode=c.mode,description=c.description WHERE id=c.server_id AND status='active'; IF NOT FOUND THEN RETURN 'unavailable'; END IF;
 END IF;
 UPDATE app.server_listing_changes SET status=CASE $3 WHEN 'approve' THEN 'approved' ELSE 'rejected' END,reviewed_at=clock_timestamp() WHERE id=$1;
 INSERT INTO app.server_listing_change_events(change_id,moderator_key,operation_id,decision,reason_code) VALUES($1,$2,$5,$3,$4); RETURN CASE $3 WHEN 'approve' THEN 'approved' ELSE 'rejected' END;
END $$;

REVOKE ALL ON app.server_listing_changes,app.server_listing_change_events FROM PUBLIC,hyperdrive_reader;
REVOKE ALL ON FUNCTION api.list_owned_servers(bytea),api.request_server_listing_change(bytea,uuid,varchar,text,varchar,varchar,varchar,varchar,varchar),api.remove_owned_server(bytea,uuid),api.list_pending_server_listing_changes(),api.moderate_server_listing_change(uuid,bytea,varchar,varchar,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION api.list_owned_servers(bytea),api.request_server_listing_change(bytea,uuid,varchar,text,varchar,varchar,varchar,varchar,varchar),api.remove_owned_server(bytea,uuid),api.list_pending_server_listing_changes(),api.moderate_server_listing_change(uuid,bytea,varchar,varchar,uuid) TO hyperdrive_reader;
COMMIT;
