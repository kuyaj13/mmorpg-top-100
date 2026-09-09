BEGIN;

ALTER TABLE app.banner_assets ADD COLUMN banner_kind varchar(20) NOT NULL DEFAULT 'free';
ALTER TABLE app.banner_assets DROP CONSTRAINT banner_assets_server_id_key;
ALTER TABLE app.banner_assets DROP CONSTRAINT banner_dimensions;
ALTER TABLE app.banner_assets DROP CONSTRAINT banner_content_size;
ALTER TABLE app.banner_assets DROP CONSTRAINT banner_static_size;
ALTER TABLE app.banner_assets ADD CONSTRAINT banner_kind_allowed CHECK (banner_kind IN ('free','exclusive'));
ALTER TABLE app.banner_assets ADD CONSTRAINT banner_dimensions CHECK ((banner_kind='free' AND width=468 AND height=60) OR (banner_kind='exclusive' AND width=936 AND height=120));
ALTER TABLE app.banner_assets ADD CONSTRAINT banner_content_size CHECK (byte_size BETWEEN 1 AND CASE banner_kind WHEN 'exclusive' THEN 1048576 ELSE 524288 END AND octet_length(content)=byte_size);
ALTER TABLE app.banner_assets ADD CONSTRAINT banner_static_size CHECK (octet_length(static_content) BETWEEN 1 AND CASE banner_kind WHEN 'exclusive' THEN 524288 ELSE 262144 END);
ALTER TABLE app.banner_assets ADD CONSTRAINT banner_frames_by_kind CHECK ((banner_kind='free' AND frame_count<=30) OR (banner_kind='exclusive' AND frame_count<=15));
ALTER TABLE app.banner_assets ADD CONSTRAINT banner_assets_server_kind_key UNIQUE(server_id,banner_kind);

CREATE OR REPLACE VIEW api.public_rankings AS
 SELECT s.id,s.game_slug,s.name,s.vote_count,s.created_at,s.website,s.game_version,s.region,s.mode,s.description,banner.id AS banner_id,banner.alt_text AS banner_alt_text
 FROM app.servers s JOIN app.games g ON g.slug=s.game_slug
 LEFT JOIN app.banner_assets banner ON banner.server_id=s.id AND banner.banner_kind='free' AND banner.moderation_status='approved'
 WHERE s.status='active' AND g.is_active;

CREATE OR REPLACE VIEW api.public_exclusive_ads AS
 SELECT p.id,p.server_id,s.game_slug,s.name server_name,b.id banner_id,b.media_type,b.alt_text,s.website destination_url,p.starts_at,p.expires_at
 FROM app.exclusive_placements p JOIN app.servers s ON s.id=p.server_id JOIN app.games g ON g.slug=s.game_slug JOIN app.banner_assets b ON b.id=p.banner_id
 JOIN app.donation_claims d ON d.id=p.donation_claim_id
 WHERE p.status='active' AND p.starts_at<=clock_timestamp() AND p.expires_at>clock_timestamp()
 AND g.is_active AND s.status='active' AND b.banner_kind='exclusive' AND b.moderation_status='approved' AND d.status='verified';

DROP FUNCTION api.list_pending_banners();
CREATE FUNCTION api.list_pending_banners()
RETURNS TABLE(id uuid,server_id uuid,server_name varchar,game_slug varchar,banner_kind varchar,media_type varchar,byte_size integer,width integer,height integer,frame_count integer,animation_duration_ms integer,alt_text varchar,created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT b.id,b.server_id,s.name,s.game_slug,b.banner_kind,b.media_type,b.byte_size,b.width,b.height,b.frame_count,b.animation_duration_ms,b.alt_text,b.created_at
 FROM app.banner_assets b JOIN app.servers s ON s.id=b.server_id
 WHERE b.moderation_status='pending' AND s.status='active'
 ORDER BY b.created_at,b.id LIMIT 20
$$;

CREATE OR REPLACE FUNCTION api.put_server_banner(uuid,bytea,bytea,bytea,bytea,bytea,varchar,integer,integer,integer,integer,varchar)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM app.servers WHERE id=$1 AND status='active' AND owner_key=$2) THEN RETURN 'unavailable'; END IF;
 INSERT INTO app.banner_assets(server_id,banner_kind,content,static_content,original_sha256,sanitized_sha256,media_type,byte_size,width,height,frame_count,animation_duration_ms,alt_text)
 VALUES($1,'free',$3,$4,$5,$6,$7,octet_length($3),$8,$9,$10,$11,btrim($12))
 ON CONFLICT(server_id,banner_kind) DO UPDATE SET content=EXCLUDED.content,static_content=EXCLUDED.static_content,original_sha256=EXCLUDED.original_sha256,sanitized_sha256=EXCLUDED.sanitized_sha256,media_type=EXCLUDED.media_type,byte_size=EXCLUDED.byte_size,width=EXCLUDED.width,height=EXCLUDED.height,frame_count=EXCLUDED.frame_count,animation_duration_ms=EXCLUDED.animation_duration_ms,alt_text=EXCLUDED.alt_text,moderation_status='pending',reviewed_at=NULL;
 RETURN 'stored';
END $$;

CREATE FUNCTION api.put_exclusive_banner(uuid,bytea,bytea,bytea,bytea,bytea,varchar,integer,integer,integer,integer,varchar)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM app.servers WHERE id=$1 AND status='active' AND owner_key=$2) THEN RETURN 'unavailable'; END IF;
 INSERT INTO app.banner_assets(server_id,banner_kind,content,static_content,original_sha256,sanitized_sha256,media_type,byte_size,width,height,frame_count,animation_duration_ms,alt_text)
 VALUES($1,'exclusive',$3,$4,$5,$6,$7,octet_length($3),$8,$9,$10,$11,btrim($12))
 ON CONFLICT(server_id,banner_kind) DO UPDATE SET content=EXCLUDED.content,static_content=EXCLUDED.static_content,original_sha256=EXCLUDED.original_sha256,sanitized_sha256=EXCLUDED.sanitized_sha256,media_type=EXCLUDED.media_type,byte_size=EXCLUDED.byte_size,width=EXCLUDED.width,height=EXCLUDED.height,frame_count=EXCLUDED.frame_count,animation_duration_ms=EXCLUDED.animation_duration_ms,alt_text=EXCLUDED.alt_text,moderation_status='pending',reviewed_at=NULL;
 RETURN 'stored';
END $$;

CREATE OR REPLACE FUNCTION api.activate_exclusive_placement(uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE claim app.donation_claims%ROWTYPE; target_game_slug varchar; placement_status varchar;
BEGIN
 SELECT * INTO claim FROM app.donation_claims WHERE id=$1;
 IF NOT FOUND OR claim.status<>'verified' THEN RETURN 'claim_unavailable'; END IF;
 IF NOT EXISTS(SELECT 1 FROM app.banner_assets WHERE server_id=claim.server_id AND banner_kind='exclusive' AND moderation_status='approved') THEN RETURN 'banner_unavailable'; END IF;
 SELECT game_slug INTO target_game_slug FROM app.servers WHERE id=claim.server_id;
 PERFORM api.reconcile_exclusive_game(target_game_slug);
 SELECT status INTO placement_status FROM app.exclusive_placements WHERE donation_claim_id=$1;
 RETURN COALESCE(placement_status,'banner_unavailable');
END $$;

CREATE OR REPLACE FUNCTION api.reconcile_exclusive_game(varchar) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE reconciliation_at timestamptz:=clock_timestamp(); active_count integer; next_placement uuid;
BEGIN
 IF $1 IS NULL OR $1 !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' OR NOT EXISTS(SELECT 1 FROM app.games WHERE slug=$1) THEN RETURN; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('exclusive-game:'||$1,0));
 INSERT INTO app.exclusive_reconciliation_state(game_slug,last_reconciled_at) VALUES($1,reconciliation_at) ON CONFLICT(game_slug) DO UPDATE SET last_reconciled_at=EXCLUDED.last_reconciled_at WHERE app.exclusive_reconciliation_state.last_reconciled_at<=EXCLUDED.last_reconciled_at-interval '15 seconds'; IF NOT FOUND THEN RETURN; END IF;
 UPDATE app.exclusive_placements p SET status='expired' FROM app.servers s WHERE s.id=p.server_id AND s.game_slug=$1 AND p.status='active' AND p.expires_at<=reconciliation_at;
 UPDATE app.exclusive_placements p SET status='suspended' FROM app.servers s,app.games g,app.donation_claims d,app.banner_assets b,app.ad_packages pkg WHERE s.id=p.server_id AND g.slug=s.game_slug AND d.id=p.donation_claim_id AND b.id=p.banner_id AND pkg.code=d.package_code AND s.game_slug=$1 AND p.status IN ('active','waiting') AND (b.banner_kind<>'exclusive' OR NOT g.is_active OR s.status<>'active' OR d.status<>'verified' OR b.moderation_status<>'approved' OR NOT pkg.is_active OR d.verified_amount_minor IS DISTINCT FROM d.expected_amount_minor OR d.verified_currency IS DISTINCT FROM d.expected_currency OR pkg.duration_days<>d.expected_duration_days OR pkg.currency<>d.expected_currency);
 WITH duplicates AS (SELECT p.id,row_number() OVER(PARTITION BY p.server_id ORDER BY p.starts_at,p.id) position FROM app.exclusive_placements p JOIN app.servers s ON s.id=p.server_id WHERE s.game_slug=$1 AND p.status='active' AND p.expires_at>reconciliation_at)
 UPDATE app.exclusive_placements p SET status='suspended' FROM duplicates d WHERE p.id=d.id AND d.position>1;
 WITH overflow AS (SELECT p.id,row_number() OVER(ORDER BY p.starts_at,p.id) position FROM app.exclusive_placements p JOIN app.servers s ON s.id=p.server_id WHERE s.game_slug=$1 AND p.status='active' AND p.expires_at>reconciliation_at)
 UPDATE app.exclusive_placements p SET status='suspended' FROM overflow o WHERE p.id=o.id AND o.position>3;
 INSERT INTO app.exclusive_placements(server_id,banner_id,donation_claim_id,duration_days,status,queued_at) SELECT d.server_id,b.id,d.id,d.expected_duration_days,'waiting',COALESCE(d.reviewed_at,d.created_at) FROM app.donation_claims d JOIN app.servers s ON s.id=d.server_id JOIN app.games g ON g.slug=s.game_slug JOIN app.banner_assets b ON b.server_id=s.id AND b.banner_kind='exclusive' JOIN app.ad_packages pkg ON pkg.code=d.package_code WHERE s.game_slug=$1 AND g.is_active AND s.status='active' AND d.status='verified' AND b.moderation_status='approved' AND pkg.is_active AND d.verified_amount_minor=d.expected_amount_minor AND d.verified_currency=d.expected_currency AND pkg.duration_days=d.expected_duration_days AND pkg.currency=d.expected_currency AND NOT EXISTS(SELECT 1 FROM app.exclusive_placements p WHERE p.donation_claim_id=d.id) ORDER BY COALESCE(d.reviewed_at,d.created_at),d.id;
 LOOP SELECT count(*) INTO active_count FROM app.exclusive_placements p JOIN app.servers s ON s.id=p.server_id WHERE s.game_slug=$1 AND p.status='active' AND p.expires_at>reconciliation_at; EXIT WHEN active_count>=3; SELECT p.id INTO next_placement FROM app.exclusive_placements p JOIN app.servers s ON s.id=p.server_id JOIN app.games g ON g.slug=s.game_slug JOIN app.donation_claims d ON d.id=p.donation_claim_id JOIN app.banner_assets b ON b.id=p.banner_id AND b.banner_kind='exclusive' JOIN app.ad_packages pkg ON pkg.code=d.package_code WHERE s.game_slug=$1 AND p.status='waiting' AND g.is_active AND s.status='active' AND d.status='verified' AND b.moderation_status='approved' AND pkg.is_active AND d.verified_amount_minor=d.expected_amount_minor AND d.verified_currency=d.expected_currency AND pkg.duration_days=d.expected_duration_days AND pkg.currency=d.expected_currency AND NOT EXISTS(SELECT 1 FROM app.exclusive_placements active WHERE active.server_id=p.server_id AND active.status='active' AND active.expires_at>reconciliation_at) ORDER BY p.queued_at,p.id LIMIT 1; EXIT WHEN next_placement IS NULL; UPDATE app.exclusive_placements SET status='active',starts_at=reconciliation_at,expires_at=reconciliation_at+make_interval(days=>duration_days) WHERE id=next_placement; next_placement:=NULL; END LOOP;
END $$;

REVOKE ALL ON FUNCTION api.put_exclusive_banner(uuid,bytea,bytea,bytea,bytea,bytea,varchar,integer,integer,integer,integer,varchar) FROM PUBLIC;
REVOKE ALL ON FUNCTION api.list_pending_banners() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION api.put_exclusive_banner(uuid,bytea,bytea,bytea,bytea,bytea,varchar,integer,integer,integer,integer,varchar) TO hyperdrive_reader;
GRANT EXECUTE ON FUNCTION api.list_pending_banners() TO hyperdrive_reader;
COMMIT;
