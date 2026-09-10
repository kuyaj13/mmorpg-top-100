BEGIN;
DROP FUNCTION api.list_pending_server_listing_changes();
CREATE FUNCTION api.list_pending_server_listing_changes()
RETURNS TABLE(
 id uuid,server_id uuid,game_slug varchar,game_name varchar,
 name varchar,website text,game_version varchar,region varchar,mode varchar,description varchar,created_at timestamptz,
 current_name varchar,current_website text,current_game_version varchar,current_region varchar,current_mode varchar,current_description varchar
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT c.id,c.server_id,s.game_slug,g.name,c.name,c.website,c.game_version,c.region,c.mode,c.description,c.created_at,
        s.name,s.website,s.game_version,s.region,s.mode,s.description
 FROM app.server_listing_changes c
 JOIN app.servers s ON s.id=c.server_id
 JOIN app.games g ON g.slug=s.game_slug
 WHERE c.status='pending' AND s.status='active'
 ORDER BY c.created_at,c.id LIMIT 100
$$;
REVOKE ALL ON FUNCTION api.list_pending_server_listing_changes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION api.list_pending_server_listing_changes() TO hyperdrive_reader;
COMMIT;
