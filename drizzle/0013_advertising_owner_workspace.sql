BEGIN;

CREATE FUNCTION api.list_active_ad_packages()
RETURNS TABLE(code varchar,duration_days integer,tier varchar,price_minor bigint,currency char(3))
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT p.code,p.duration_days,'exclusive'::varchar,p.price_minor,p.currency
 FROM app.ad_packages p WHERE p.is_active
 ORDER BY p.duration_days,p.code
$$;

CREATE FUNCTION api.list_owner_donation_claims(bytea)
RETURNS TABLE(id uuid,server_name varchar,game_name varchar,duration_days integer,status varchar,created_at timestamptz,rejection_reason varchar)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT d.id,s.name,g.name,d.expected_duration_days,d.status,d.created_at,d.rejection_reason_code
 FROM app.donation_claims d JOIN app.servers s ON s.id=d.server_id JOIN app.games g ON g.slug=s.game_slug
 WHERE octet_length($1)=32 AND d.owner_key=$1
 ORDER BY d.created_at DESC,d.id DESC LIMIT 100
$$;

REVOKE ALL ON FUNCTION api.list_active_ad_packages() FROM PUBLIC;
REVOKE ALL ON FUNCTION api.list_owner_donation_claims(bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION api.list_active_ad_packages() TO hyperdrive_reader;
GRANT EXECUTE ON FUNCTION api.list_owner_donation_claims(bytea) TO hyperdrive_reader;

COMMIT;
