BEGIN;

CREATE FUNCTION api.list_exclusive_banner_eligible_servers(bytea)
RETURNS TABLE(id uuid,name varchar,game_slug varchar,game_name varchar)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  IF octet_length($1) <> 32 THEN RAISE EXCEPTION 'invalid owner key'; END IF;
  RETURN QUERY
    SELECT DISTINCT s.id,s.name,s.game_slug,g.name
    FROM app.servers s
    JOIN app.games g ON g.slug=s.game_slug
    JOIN app.donation_claims d ON d.server_id=s.id AND d.owner_key=$1
    WHERE s.owner_key=$1 AND s.status='active' AND g.is_active AND d.status='verified'
    ORDER BY g.name,s.name,s.id
    LIMIT 100;
END $$;

CREATE OR REPLACE FUNCTION api.put_exclusive_banner(uuid,bytea,bytea,bytea,bytea,bytea,varchar,integer,integer,integer,integer,varchar)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF NOT EXISTS(
   SELECT 1 FROM app.servers s
   JOIN app.games g ON g.slug=s.game_slug
   JOIN app.donation_claims d ON d.server_id=s.id AND d.owner_key=$2
   WHERE s.id=$1 AND s.status='active' AND s.owner_key=$2 AND g.is_active AND d.status='verified'
 ) THEN RETURN 'unavailable'; END IF;
 INSERT INTO app.banner_assets(server_id,banner_kind,content,static_content,original_sha256,sanitized_sha256,media_type,byte_size,width,height,frame_count,animation_duration_ms,alt_text)
 VALUES($1,'exclusive',$3,$4,$5,$6,$7,octet_length($3),$8,$9,$10,$11,btrim($12))
 ON CONFLICT(server_id,banner_kind) DO UPDATE SET content=EXCLUDED.content,static_content=EXCLUDED.static_content,original_sha256=EXCLUDED.original_sha256,sanitized_sha256=EXCLUDED.sanitized_sha256,media_type=EXCLUDED.media_type,byte_size=EXCLUDED.byte_size,width=EXCLUDED.width,height=EXCLUDED.height,frame_count=EXCLUDED.frame_count,animation_duration_ms=EXCLUDED.animation_duration_ms,alt_text=EXCLUDED.alt_text,moderation_status='pending',reviewed_at=NULL;
 RETURN 'stored';
END $$;

REVOKE ALL ON FUNCTION api.list_exclusive_banner_eligible_servers(bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION api.list_exclusive_banner_eligible_servers(bytea) TO hyperdrive_reader;

COMMIT;
