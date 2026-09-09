BEGIN;

CREATE FUNCTION api.list_pending_banners(boolean)
RETURNS TABLE(id uuid,server_id uuid,server_name varchar,game_slug varchar,banner_kind varchar,media_type varchar,byte_size integer,width integer,height integer,frame_count integer,animation_duration_ms integer,alt_text varchar,created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT b.id,b.server_id,s.name,s.game_slug,b.banner_kind,b.media_type,b.byte_size,b.width,b.height,b.frame_count,b.animation_duration_ms,b.alt_text,b.created_at
 FROM app.banner_assets b JOIN app.servers s ON s.id=b.server_id
 WHERE b.moderation_status='pending' AND s.status='active' AND ($1 OR b.banner_kind='free')
 ORDER BY b.created_at,b.id LIMIT 20
$$;

CREATE FUNCTION api.get_banner_review_preview(uuid,boolean) RETURNS TABLE(content bytea,media_type varchar)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT b.static_content,'image/png'::varchar
 FROM app.banner_assets b JOIN app.servers s ON s.id=b.server_id
 WHERE b.id=$1 AND b.moderation_status='pending' AND s.status='active' AND ($2 OR b.banner_kind='free')
$$;

CREATE FUNCTION api.moderate_banner(uuid,bytea,varchar,uuid,boolean) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE existing app.banner_moderation_events%ROWTYPE; requested varchar;
BEGIN
 IF octet_length($2)<>32 OR $3 NOT IN ('approve','reject','suspend') THEN RAISE EXCEPTION 'invalid moderation decision'; END IF;
 requested:=CASE $3 WHEN 'approve' THEN 'approved' WHEN 'reject' THEN 'rejected' ELSE 'suspended' END;
 SELECT * INTO existing FROM app.banner_moderation_events WHERE operation_id=$4;
 IF FOUND THEN
   IF NOT EXISTS(SELECT 1 FROM app.banner_assets WHERE id=$1 AND ($5 OR banner_kind='free')) THEN RETURN 'unavailable'; END IF;
   RETURN CASE WHEN existing.banner_id=$1 AND existing.moderator_key=$2 AND existing.decision=requested THEN existing.decision ELSE 'unavailable' END;
 END IF;
 UPDATE app.banner_assets SET moderation_status=requested,reviewed_at=clock_timestamp()
 WHERE id=$1 AND ($5 OR banner_kind='free') AND (moderation_status='pending' OR (requested='suspended' AND moderation_status='approved'));
 IF NOT FOUND THEN RETURN 'unavailable'; END IF;
 INSERT INTO app.banner_moderation_events(banner_id,moderator_key,decision,operation_id) VALUES($1,$2,requested,$4);
 RETURN requested;
END $$;

REVOKE ALL ON FUNCTION api.list_pending_banners(boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION api.get_banner_review_preview(uuid,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION api.moderate_banner(uuid,bytea,varchar,uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION api.list_pending_banners(boolean) TO hyperdrive_reader;
GRANT EXECUTE ON FUNCTION api.get_banner_review_preview(uuid,boolean) TO hyperdrive_reader;
GRANT EXECUTE ON FUNCTION api.moderate_banner(uuid,bytea,varchar,uuid,boolean) TO hyperdrive_reader;

COMMIT;
