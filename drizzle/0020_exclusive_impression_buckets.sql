BEGIN;

CREATE TABLE app.exclusive_impression_buckets (
  placement_id uuid NOT NULL REFERENCES app.exclusive_placements(id) ON DELETE CASCADE,
  bucket_started_at timestamptz NOT NULL,
  impression_count integer NOT NULL DEFAULT 1 CHECK (impression_count BETWEEN 1 AND 2147483647),
  PRIMARY KEY (placement_id,bucket_started_at)
);

CREATE FUNCTION api.record_exclusive_impression(uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE impression_bucket timestamptz := date_bin(interval '15 minutes',clock_timestamp(),timestamptz '2000-01-01 00:00:00+00');
BEGIN
 IF NOT EXISTS(SELECT 1 FROM api.public_exclusive_ads ad WHERE ad.id=$1) THEN RETURN 'unavailable'; END IF;
 INSERT INTO app.exclusive_impression_buckets(placement_id,bucket_started_at,impression_count)
 VALUES($1,impression_bucket,1)
 ON CONFLICT(placement_id,bucket_started_at) DO UPDATE
 SET impression_count=LEAST(app.exclusive_impression_buckets.impression_count+1,2147483647);
 RETURN 'recorded';
END $$;

DROP FUNCTION api.list_admin_exclusive_placements();
CREATE FUNCTION api.list_admin_exclusive_placements()
RETURNS TABLE(id uuid,server_name varchar,website text,game_slug varchar,game_name varchar,duration_days integer,status varchar,starts_at timestamptz,expires_at timestamptz,queued_at timestamptz,banner_status varchar,claim_status varchar,impression_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT p.id,s.name,s.website,s.game_slug,g.name,p.duration_days,p.status,p.starts_at,p.expires_at,p.queued_at,b.moderation_status,d.status,COALESCE(sum(i.impression_count),0)::bigint
 FROM app.exclusive_placements p JOIN app.servers s ON s.id=p.server_id JOIN app.games g ON g.slug=s.game_slug
 JOIN app.banner_assets b ON b.id=p.banner_id JOIN app.donation_claims d ON d.id=p.donation_claim_id
 LEFT JOIN app.exclusive_impression_buckets i ON i.placement_id=p.id
 GROUP BY p.id,s.name,s.website,s.game_slug,g.name,b.moderation_status,d.status
 ORDER BY CASE p.status WHEN 'active' THEN 1 WHEN 'waiting' THEN 2 WHEN 'suspended' THEN 3 ELSE 4 END,
          COALESCE(p.expires_at,p.queued_at) DESC,p.id LIMIT 100
$$;

REVOKE ALL ON app.exclusive_impression_buckets FROM PUBLIC,hyperdrive_reader;
REVOKE ALL ON FUNCTION api.record_exclusive_impression(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION api.list_admin_exclusive_placements() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION api.record_exclusive_impression(uuid) TO hyperdrive_reader;
GRANT EXECUTE ON FUNCTION api.list_admin_exclusive_placements() TO hyperdrive_reader;

COMMIT;
