BEGIN;

CREATE OR REPLACE FUNCTION api.get_public_banner(uuid,boolean) RETURNS TABLE(content bytea,media_type varchar)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT CASE WHEN $2 THEN b.static_content ELSE b.content END,
   CASE WHEN $2 THEN 'image/png'::varchar ELSE b.media_type END
 FROM app.banner_assets b
 JOIN app.servers s ON s.id=b.server_id
 WHERE b.id=$1
   AND b.moderation_status='approved'
   AND s.status='active'
   AND (
     b.banner_kind='free'
     OR (
       b.banner_kind='exclusive'
       AND EXISTS(SELECT 1 FROM api.public_exclusive_ads ad WHERE ad.banner_id=b.id)
     )
   )
$$;

REVOKE ALL ON FUNCTION api.get_public_banner(uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION api.get_public_banner(uuid,boolean) TO hyperdrive_reader;

COMMIT;
