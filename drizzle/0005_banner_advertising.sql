BEGIN;

ALTER TABLE app.servers ADD COLUMN owner_key bytea;
ALTER TABLE app.servers ADD CONSTRAINT servers_owner_key_length CHECK (owner_key IS NULL OR octet_length(owner_key) = 32);
UPDATE app.servers s SET owner_key = approved.owner_key
  FROM (SELECT DISTINCT ON (e.server_id) e.server_id,sub.owner_key
    FROM app.server_moderation_events e JOIN app.server_submissions sub ON sub.id=e.submission_id
    WHERE e.decision='approve' AND e.server_id IS NOT NULL
    ORDER BY e.server_id,e.created_at DESC,e.id DESC) approved
 WHERE approved.server_id=s.id;
CREATE FUNCTION app.assign_approved_server_owner() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.decision='approve' AND NEW.server_id IS NOT NULL THEN
    UPDATE app.servers s SET owner_key=sub.owner_key FROM app.server_submissions sub
     WHERE s.id=NEW.server_id AND sub.id=NEW.submission_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER server_moderation_assign_owner AFTER INSERT ON app.server_moderation_events
FOR EACH ROW EXECUTE FUNCTION app.assign_approved_server_owner();

CREATE TABLE app.banner_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid NOT NULL UNIQUE REFERENCES app.servers(id) ON DELETE RESTRICT,
  content bytea NOT NULL,
  static_content bytea NOT NULL,
  original_sha256 bytea NOT NULL,
  sanitized_sha256 bytea NOT NULL,
  media_type varchar(20) NOT NULL,
  byte_size integer NOT NULL,
  width integer NOT NULL,
  height integer NOT NULL,
  frame_count integer NOT NULL,
  animation_duration_ms integer NOT NULL,
  alt_text varchar(180) NOT NULL,
  moderation_status varchar(20) NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  CONSTRAINT banner_content_size CHECK (byte_size BETWEEN 1 AND 524288 AND octet_length(content) = byte_size),
  CONSTRAINT banner_static_size CHECK (octet_length(static_content) BETWEEN 1 AND 262144),
  CONSTRAINT banner_hash_size CHECK (octet_length(original_sha256) = 32 AND octet_length(sanitized_sha256) = 32),
  CONSTRAINT banner_media_allowed CHECK (media_type IN ('image/gif','image/png','image/jpeg')),
  CONSTRAINT banner_dimensions CHECK (width = 468 AND height = 60),
  CONSTRAINT banner_animation_caps CHECK (frame_count BETWEEN 1 AND 30 AND animation_duration_ms BETWEEN 0 AND 15000),
  CONSTRAINT banner_alt_text CHECK (btrim(alt_text) <> ''),
  CONSTRAINT banner_moderation_allowed CHECK (moderation_status IN ('pending','approved','rejected','suspended'))
);

CREATE TABLE app.ad_packages (
  code varchar(40) PRIMARY KEY, duration_days integer NOT NULL, price_minor bigint NOT NULL,
  currency char(3) NOT NULL DEFAULT 'USD', is_active boolean NOT NULL DEFAULT false,
  CONSTRAINT ad_package_values CHECK ((code = 'exclusive_7_day' AND duration_days = 7) OR (code = 'exclusive_30_day' AND duration_days = 30)),
  CONSTRAINT ad_package_price CHECK (price_minor > 0), CONSTRAINT ad_package_currency CHECK (currency = 'USD')
);

CREATE TABLE app.donation_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), server_id uuid NOT NULL REFERENCES app.servers(id),
  owner_key bytea NOT NULL, package_code varchar(40) NOT NULL REFERENCES app.ad_packages(code),
  donor_reference varchar(128) NOT NULL UNIQUE, status varchar(20) NOT NULL DEFAULT 'pending',
  verified_amount_minor bigint, verified_currency char(3), reviewed_at timestamptz,
  CONSTRAINT donation_owner_key_length CHECK (octet_length(owner_key)=32),
  CONSTRAINT donation_status_allowed CHECK (status IN ('pending','verified','rejected','refunded'))
);

CREATE TABLE app.exclusive_placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), server_id uuid NOT NULL REFERENCES app.servers(id),
  banner_id uuid NOT NULL REFERENCES app.banner_assets(id), donation_claim_id uuid NOT NULL UNIQUE REFERENCES app.donation_claims(id),
  duration_days integer NOT NULL CHECK (duration_days IN (7,30)), status varchar(20) NOT NULL,
  starts_at timestamptz, expires_at timestamptz,
  CONSTRAINT placement_status_allowed CHECK (status IN ('active','waiting','suspended','expired')),
  CONSTRAINT placement_time CHECK ((status='active' AND starts_at IS NOT NULL AND expires_at > starts_at) OR (status='waiting' AND starts_at IS NULL AND expires_at IS NULL) OR status IN ('suspended','expired'))
);
CREATE INDEX exclusive_placement_game_lookup ON app.exclusive_placements(server_id, expires_at) WHERE status='active';

CREATE TABLE app.banner_moderation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  banner_id uuid NOT NULL REFERENCES app.banner_assets(id) ON DELETE RESTRICT,
  moderator_key bytea NOT NULL,
  decision varchar(20) NOT NULL,
  operation_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT banner_moderator_key_length CHECK (octet_length(moderator_key) = 32),
  CONSTRAINT banner_decision_allowed CHECK (decision IN ('approved','rejected','suspended'))
);
CREATE TRIGGER banner_moderation_events_append_only BEFORE UPDATE OR DELETE ON app.banner_moderation_events
FOR EACH ROW EXECUTE FUNCTION app.reject_moderation_event_mutation();

CREATE FUNCTION api.put_server_banner(uuid, bytea, bytea, bytea, bytea, bytea, varchar, integer, integer, integer, integer, varchar)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE sid alias for $1; owner alias for $2; bytes alias for $3; static_bytes alias for $4; original_digest alias for $5; sanitized_digest alias for $6; mime alias for $7; w alias for $8; h alias for $9; frames alias for $10; duration alias for $11; alt alias for $12;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM app.servers s WHERE s.id=sid AND s.status='active' AND s.owner_key=owner) THEN RETURN 'unavailable'; END IF;
  INSERT INTO app.banner_assets(server_id,content,static_content,original_sha256,sanitized_sha256,media_type,byte_size,width,height,frame_count,animation_duration_ms,alt_text)
  VALUES(sid,bytes,static_bytes,original_digest,sanitized_digest,mime,octet_length(bytes),w,h,frames,duration,btrim(alt))
  ON CONFLICT(server_id) DO UPDATE SET content=EXCLUDED.content,static_content=EXCLUDED.static_content,original_sha256=EXCLUDED.original_sha256,sanitized_sha256=EXCLUDED.sanitized_sha256,media_type=EXCLUDED.media_type,
    byte_size=EXCLUDED.byte_size,width=EXCLUDED.width,height=EXCLUDED.height,frame_count=EXCLUDED.frame_count,
    animation_duration_ms=EXCLUDED.animation_duration_ms,alt_text=EXCLUDED.alt_text,moderation_status='pending',reviewed_at=NULL;
  RETURN 'stored';
END $$;

CREATE FUNCTION api.activate_exclusive_placement(uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE claim app.donation_claims%ROWTYPE; banner app.banner_assets%ROWTYPE; package app.ad_packages%ROWTYPE; active_count integer;
BEGIN
  SELECT * INTO claim FROM app.donation_claims WHERE id=$1 FOR UPDATE;
  IF NOT FOUND OR claim.status<>'verified' THEN RETURN 'claim_unavailable'; END IF;
  IF EXISTS(SELECT 1 FROM app.exclusive_placements WHERE donation_claim_id=claim.id) THEN RETURN 'already_used'; END IF;
  SELECT * INTO package FROM app.ad_packages WHERE code=claim.package_code AND is_active;
  IF NOT FOUND OR claim.verified_amount_minor<>package.price_minor OR claim.verified_currency<>package.currency THEN RETURN 'claim_mismatch'; END IF;
  SELECT * INTO banner FROM app.banner_assets WHERE server_id=claim.server_id AND moderation_status='approved';
  IF NOT FOUND THEN RETURN 'banner_unavailable'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('exclusive-game:'||(SELECT game_slug FROM app.servers WHERE id=claim.server_id),0));
  SELECT count(*) INTO active_count FROM app.exclusive_placements p JOIN app.servers s ON s.id=p.server_id
   WHERE s.game_slug=(SELECT game_slug FROM app.servers WHERE id=claim.server_id) AND p.status='active' AND p.expires_at>clock_timestamp();
  INSERT INTO app.exclusive_placements(server_id,banner_id,donation_claim_id,duration_days,status,starts_at,expires_at)
  VALUES(claim.server_id,banner.id,claim.id,package.duration_days,CASE WHEN active_count<3 THEN 'active' ELSE 'waiting' END,
    CASE WHEN active_count<3 THEN clock_timestamp() ELSE NULL END,
    CASE WHEN active_count<3 THEN clock_timestamp()+make_interval(days=>package.duration_days) ELSE NULL END);
  RETURN CASE WHEN active_count<3 THEN 'active' ELSE 'waiting' END;
END $$;

CREATE VIEW api.public_exclusive_ads AS
 SELECT p.id,p.server_id,s.game_slug,s.name server_name,b.id banner_id,b.media_type,b.alt_text,s.website destination_url,p.starts_at,p.expires_at
 FROM app.exclusive_placements p JOIN app.servers s ON s.id=p.server_id JOIN app.games g ON g.slug=s.game_slug JOIN app.banner_assets b ON b.id=p.banner_id
 JOIN app.donation_claims d ON d.id=p.donation_claim_id
 WHERE p.status='active' AND p.starts_at<=clock_timestamp() AND p.expires_at>clock_timestamp()
   AND g.is_active AND s.status='active' AND b.moderation_status='approved' AND d.status='verified';
CREATE FUNCTION api.get_public_banner(uuid,boolean) RETURNS TABLE(content bytea,media_type varchar)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT CASE WHEN $2 THEN b.static_content ELSE b.content END,
   CASE WHEN $2 THEN 'image/png'::varchar ELSE b.media_type END
 FROM app.banner_assets b JOIN app.servers s ON s.id=b.server_id
 WHERE b.id=$1 AND b.moderation_status='approved' AND s.status='active'
$$;
CREATE FUNCTION api.list_pending_banners()
RETURNS TABLE(id uuid,server_id uuid,server_name varchar,game_slug varchar,media_type varchar,byte_size integer,frame_count integer,animation_duration_ms integer,alt_text varchar,created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT b.id,b.server_id,s.name,s.game_slug,b.media_type,b.byte_size,b.frame_count,b.animation_duration_ms,b.alt_text,b.created_at
 FROM app.banner_assets b JOIN app.servers s ON s.id=b.server_id
 WHERE b.moderation_status='pending' AND s.status='active'
 ORDER BY b.created_at,b.id
 LIMIT 20
$$;
CREATE FUNCTION api.get_banner_review_preview(uuid) RETURNS TABLE(content bytea,media_type varchar)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT b.static_content,'image/png'::varchar
 FROM app.banner_assets b JOIN app.servers s ON s.id=b.server_id
 WHERE b.id=$1 AND b.moderation_status='pending' AND s.status='active'
$$;
CREATE FUNCTION api.moderate_banner(uuid,bytea,varchar,uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE existing app.banner_moderation_events%ROWTYPE; requested varchar;
BEGIN
 IF octet_length($2)<>32 OR $3 NOT IN ('approve','reject','suspend') THEN RAISE EXCEPTION 'invalid moderation decision'; END IF;
 requested:=CASE $3 WHEN 'approve' THEN 'approved' WHEN 'reject' THEN 'rejected' ELSE 'suspended' END;
 SELECT * INTO existing FROM app.banner_moderation_events WHERE operation_id=$4;
 IF FOUND THEN RETURN CASE WHEN existing.banner_id=$1 AND existing.moderator_key=$2 AND existing.decision=requested THEN existing.decision ELSE 'unavailable' END; END IF;
 UPDATE app.banner_assets SET moderation_status=requested,reviewed_at=clock_timestamp()
 WHERE id=$1 AND (moderation_status='pending' OR (requested='suspended' AND moderation_status='approved'));
 IF NOT FOUND THEN RETURN 'unavailable'; END IF;
 INSERT INTO app.banner_moderation_events(banner_id,moderator_key,decision,operation_id) VALUES($1,$2,requested,$4);
 RETURN requested;
END $$;

REVOKE ALL ON app.banner_assets,app.ad_packages,app.donation_claims,app.exclusive_placements,app.banner_moderation_events FROM PUBLIC,hyperdrive_reader;
REVOKE ALL ON api.public_exclusive_ads FROM PUBLIC,hyperdrive_reader;
REVOKE ALL ON FUNCTION api.put_server_banner(uuid,bytea,bytea,bytea,bytea,bytea,varchar,integer,integer,integer,integer,varchar) FROM PUBLIC;
REVOKE ALL ON FUNCTION api.get_public_banner(uuid,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION api.activate_exclusive_placement(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION api.list_pending_banners() FROM PUBLIC;
REVOKE ALL ON FUNCTION api.get_banner_review_preview(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION api.moderate_banner(uuid,bytea,varchar,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION api.put_server_banner(uuid,bytea,bytea,bytea,bytea,bytea,varchar,integer,integer,integer,integer,varchar) TO hyperdrive_reader;
GRANT EXECUTE ON FUNCTION api.get_public_banner(uuid,boolean) TO hyperdrive_reader;
GRANT EXECUTE ON FUNCTION api.activate_exclusive_placement(uuid) TO hyperdrive_reader;
GRANT EXECUTE ON FUNCTION api.list_pending_banners() TO hyperdrive_reader;
GRANT EXECUTE ON FUNCTION api.get_banner_review_preview(uuid) TO hyperdrive_reader;
GRANT EXECUTE ON FUNCTION api.moderate_banner(uuid,bytea,varchar,uuid) TO hyperdrive_reader;
GRANT SELECT ON api.public_exclusive_ads TO hyperdrive_reader;
COMMIT;
