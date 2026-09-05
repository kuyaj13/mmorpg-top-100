BEGIN;

ALTER TABLE app.exclusive_placements ADD COLUMN queued_at timestamptz;
UPDATE app.exclusive_placements p SET queued_at=COALESCE(d.reviewed_at,d.created_at) FROM app.donation_claims d WHERE d.id=p.donation_claim_id;
ALTER TABLE app.exclusive_placements ALTER COLUMN queued_at SET DEFAULT now();
ALTER TABLE app.exclusive_placements ALTER COLUMN queued_at SET NOT NULL;
CREATE INDEX exclusive_placement_waiting_order ON app.exclusive_placements(queued_at,id) WHERE status='waiting';
CREATE INDEX donation_claim_verified_reconcile ON app.donation_claims(server_id,reviewed_at,id) WHERE status='verified';
CREATE TABLE app.exclusive_reconciliation_state(game_slug varchar(100) PRIMARY KEY REFERENCES app.games(slug),last_reconciled_at timestamptz NOT NULL);

CREATE FUNCTION api.reconcile_exclusive_game(varchar)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE reconciliation_at timestamptz:=clock_timestamp(); active_count integer; next_placement uuid;
BEGIN
  IF $1 IS NULL OR $1 !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' OR NOT EXISTS(SELECT 1 FROM app.games WHERE slug=$1) THEN RETURN; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('exclusive-game:'||$1,0));
  INSERT INTO app.exclusive_reconciliation_state(game_slug,last_reconciled_at) VALUES($1,reconciliation_at)
   ON CONFLICT(game_slug) DO UPDATE SET last_reconciled_at=EXCLUDED.last_reconciled_at
   WHERE app.exclusive_reconciliation_state.last_reconciled_at<=EXCLUDED.last_reconciled_at-interval '15 seconds';
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE app.exclusive_placements p SET status='expired'
   FROM app.servers s WHERE s.id=p.server_id AND s.game_slug=$1 AND p.status='active' AND p.expires_at<=reconciliation_at;
  UPDATE app.exclusive_placements p SET status='suspended'
   FROM app.servers s,app.games g,app.donation_claims d,app.banner_assets b,app.ad_packages pkg
   WHERE s.id=p.server_id AND g.slug=s.game_slug AND d.id=p.donation_claim_id AND b.id=p.banner_id AND pkg.code=d.package_code AND s.game_slug=$1 AND p.status IN ('active','waiting')
     AND (NOT g.is_active OR s.status<>'active' OR d.status<>'verified' OR b.moderation_status<>'approved' OR NOT pkg.is_active OR d.verified_amount_minor IS DISTINCT FROM d.expected_amount_minor OR d.verified_currency IS DISTINCT FROM d.expected_currency OR pkg.duration_days<>d.expected_duration_days OR pkg.currency<>d.expected_currency);
  WITH duplicates AS (SELECT p.id,row_number() OVER(PARTITION BY p.server_id ORDER BY p.starts_at,p.id) position FROM app.exclusive_placements p JOIN app.servers s ON s.id=p.server_id WHERE s.game_slug=$1 AND p.status='active' AND p.expires_at>reconciliation_at)
   UPDATE app.exclusive_placements p SET status='suspended' FROM duplicates d WHERE p.id=d.id AND d.position>1;
  WITH overflow AS (SELECT p.id,row_number() OVER(ORDER BY p.starts_at,p.id) position FROM app.exclusive_placements p JOIN app.servers s ON s.id=p.server_id WHERE s.game_slug=$1 AND p.status='active' AND p.expires_at>reconciliation_at)
   UPDATE app.exclusive_placements p SET status='suspended' FROM overflow o WHERE p.id=o.id AND o.position>3;
  INSERT INTO app.exclusive_placements(server_id,banner_id,donation_claim_id,duration_days,status,queued_at)
   SELECT d.server_id,b.id,d.id,d.expected_duration_days,'waiting',COALESCE(d.reviewed_at,d.created_at)
   FROM app.donation_claims d JOIN app.servers s ON s.id=d.server_id JOIN app.games g ON g.slug=s.game_slug JOIN app.banner_assets b ON b.server_id=s.id JOIN app.ad_packages pkg ON pkg.code=d.package_code
   WHERE s.game_slug=$1 AND g.is_active AND s.status='active' AND d.status='verified' AND b.moderation_status='approved' AND pkg.is_active
     AND d.verified_amount_minor=d.expected_amount_minor AND d.verified_currency=d.expected_currency AND pkg.duration_days=d.expected_duration_days AND pkg.currency=d.expected_currency
     AND NOT EXISTS(SELECT 1 FROM app.exclusive_placements p WHERE p.donation_claim_id=d.id)
   ORDER BY COALESCE(d.reviewed_at,d.created_at),d.id;
  LOOP
    SELECT count(*) INTO active_count FROM app.exclusive_placements p JOIN app.servers s ON s.id=p.server_id
     WHERE s.game_slug=$1 AND p.status='active' AND p.expires_at>reconciliation_at;
    EXIT WHEN active_count>=3;
    SELECT p.id INTO next_placement FROM app.exclusive_placements p JOIN app.servers s ON s.id=p.server_id
     JOIN app.games g ON g.slug=s.game_slug JOIN app.donation_claims d ON d.id=p.donation_claim_id JOIN app.banner_assets b ON b.id=p.banner_id JOIN app.ad_packages pkg ON pkg.code=d.package_code
     WHERE s.game_slug=$1 AND p.status='waiting' AND g.is_active AND s.status='active' AND d.status='verified' AND b.moderation_status='approved' AND pkg.is_active
       AND d.verified_amount_minor=d.expected_amount_minor AND d.verified_currency=d.expected_currency AND pkg.duration_days=d.expected_duration_days AND pkg.currency=d.expected_currency
       AND NOT EXISTS(SELECT 1 FROM app.exclusive_placements active WHERE active.server_id=p.server_id AND active.status='active' AND active.expires_at>reconciliation_at)
     ORDER BY p.queued_at,p.id LIMIT 1;
    EXIT WHEN next_placement IS NULL;
    UPDATE app.exclusive_placements SET status='active',starts_at=reconciliation_at,expires_at=reconciliation_at+make_interval(days=>duration_days) WHERE id=next_placement;
    next_placement:=NULL;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api.activate_exclusive_placement(uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE claim app.donation_claims%ROWTYPE; target_game_slug varchar; placement_status varchar;
BEGIN
  IF $1 IS NULL THEN RETURN 'claim_unavailable'; END IF;
  SELECT * INTO claim FROM app.donation_claims WHERE id=$1;
  IF NOT FOUND OR claim.status<>'verified' THEN RETURN 'claim_unavailable'; END IF;
  SELECT game_slug INTO target_game_slug FROM app.servers WHERE id=claim.server_id;
  PERFORM api.reconcile_exclusive_game(target_game_slug);
  SELECT status INTO placement_status FROM app.exclusive_placements WHERE donation_claim_id=$1;
  RETURN COALESCE(placement_status,'banner_unavailable');
END $$;

REVOKE ALL ON FUNCTION api.reconcile_exclusive_game(varchar) FROM PUBLIC;
REVOKE ALL ON app.exclusive_reconciliation_state FROM PUBLIC,hyperdrive_reader;
GRANT EXECUTE ON FUNCTION api.reconcile_exclusive_game(varchar) TO hyperdrive_reader;
COMMIT;
