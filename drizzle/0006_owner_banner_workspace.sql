BEGIN;

CREATE FUNCTION api.list_owned_servers(bytea)
RETURNS TABLE(id uuid,name varchar,game_slug varchar,game_name varchar)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  IF octet_length($1) <> 32 THEN RAISE EXCEPTION 'invalid owner key'; END IF;
  RETURN QUERY
    SELECT s.id,s.name,s.game_slug,g.name
    FROM app.servers s
    JOIN app.games g ON g.slug=s.game_slug
    WHERE s.owner_key=$1 AND s.status='active' AND g.is_active
    ORDER BY g.name,s.name,s.id
    LIMIT 100;
END $$;

REVOKE ALL ON FUNCTION api.list_owned_servers(bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION api.list_owned_servers(bytea) TO hyperdrive_reader;

COMMIT;
