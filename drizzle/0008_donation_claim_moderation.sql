BEGIN;

ALTER TABLE app.donation_claims ADD COLUMN expected_amount_minor bigint;
ALTER TABLE app.donation_claims ADD COLUMN expected_currency char(3);
ALTER TABLE app.donation_claims ADD COLUMN expected_duration_days integer;
UPDATE app.donation_claims d SET expected_amount_minor=p.price_minor,expected_currency=p.currency,expected_duration_days=p.duration_days
 FROM app.ad_packages p WHERE p.code=d.package_code;
ALTER TABLE app.donation_claims ALTER COLUMN expected_amount_minor SET NOT NULL;
ALTER TABLE app.donation_claims ALTER COLUMN expected_currency SET NOT NULL;
ALTER TABLE app.donation_claims ALTER COLUMN expected_duration_days SET NOT NULL;
ALTER TABLE app.donation_claims ADD CONSTRAINT donation_claim_snapshot_values CHECK (expected_amount_minor>0 AND expected_currency='USD' AND expected_duration_days IN (7,30));

CREATE OR REPLACE FUNCTION api.submit_donation_claim(bytea,uuid,varchar,varchar)
RETURNS TABLE(outcome text,claim_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE package app.ad_packages%ROWTYPE;
BEGIN
  IF $1 IS NULL OR $2 IS NULL OR $3 IS NULL OR $4 IS NULL OR octet_length($1)<>32 OR $4 !~ '^[A-Z0-9]{8,128}$' THEN RETURN QUERY SELECT 'invalid'::text,NULL::uuid; RETURN; END IF;
  IF NOT EXISTS(SELECT 1 FROM app.servers s WHERE s.id=$2 AND s.owner_key=$1 AND s.status='active') THEN RETURN QUERY SELECT 'unavailable'::text,NULL::uuid; RETURN; END IF;
  SELECT * INTO package FROM app.ad_packages p WHERE p.code=$3 AND p.is_active;
  IF NOT FOUND THEN RETURN QUERY SELECT 'unavailable'::text,NULL::uuid; RETURN; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('donation-owner:'||encode($1,'hex'),0));
  IF (SELECT count(*) FROM app.donation_claims d WHERE d.owner_key=$1 AND d.status='pending')>=3 THEN RETURN QUERY SELECT 'limit_reached'::text,NULL::uuid; RETURN; END IF;
  BEGIN
    RETURN QUERY INSERT INTO app.donation_claims(server_id,owner_key,package_code,donor_reference,expected_amount_minor,expected_currency,expected_duration_days)
      VALUES($2,$1,$3,$4,package.price_minor,package.currency,package.duration_days) RETURNING 'accepted'::text,app.donation_claims.id;
  EXCEPTION WHEN unique_violation THEN RETURN QUERY SELECT 'duplicate'::text,NULL::uuid;
  END;
END $$;

CREATE TABLE app.donation_claim_review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES app.donation_claims(id) ON DELETE RESTRICT,
  moderator_key bytea NOT NULL,
  decision varchar(20) NOT NULL,
  reason_code varchar(40),
  operation_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT donation_review_moderator_key_length CHECK (octet_length(moderator_key)=32),
  CONSTRAINT donation_review_decision_allowed CHECK (decision IN ('verified','rejected')),
  CONSTRAINT donation_review_reason_allowed CHECK (
    (decision='verified' AND reason_code IS NULL) OR
    (decision='rejected' AND reason_code IN ('not_matched','wrong_amount','wrong_currency','refunded'))
  )
);
CREATE TRIGGER donation_claim_review_events_append_only BEFORE UPDATE OR DELETE ON app.donation_claim_review_events
FOR EACH ROW EXECUTE FUNCTION app.reject_moderation_event_mutation();

CREATE FUNCTION api.list_pending_donation_claims()
RETURNS TABLE(id uuid,server_name varchar,game_name varchar,website text,donor_reference varchar,duration_days integer,expected_amount_minor bigint,currency char(3),created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT d.id,s.name,g.name,s.website,d.donor_reference,d.expected_duration_days,d.expected_amount_minor,d.expected_currency,d.created_at
 FROM app.donation_claims d
 JOIN app.servers s ON s.id=d.server_id
 JOIN app.games g ON g.slug=s.game_slug
 WHERE d.status='pending'
 ORDER BY d.created_at,d.id
 LIMIT 50
$$;

CREATE FUNCTION api.moderate_donation_claim(uuid,bytea,varchar,varchar,uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE existing app.donation_claim_review_events%ROWTYPE; claim app.donation_claims%ROWTYPE; requested varchar;
BEGIN
  IF $1 IS NULL OR $2 IS NULL OR $3 IS NULL OR $5 IS NULL OR octet_length($2)<>32 OR $3 NOT IN ('verify','reject') OR
     ($3='verify' AND $4 IS NOT NULL) OR ($3='reject' AND $4 NOT IN ('not_matched','wrong_amount','wrong_currency','refunded'))
  THEN RETURN 'invalid'; END IF;
  requested:=CASE $3 WHEN 'verify' THEN 'verified' ELSE 'rejected' END;
  PERFORM pg_advisory_xact_lock(hashtextextended('donation-review-operation:'||$5::text,0));
  SELECT * INTO existing FROM app.donation_claim_review_events WHERE operation_id=$5;
  IF FOUND THEN
    RETURN CASE WHEN existing.claim_id=$1 AND existing.moderator_key=$2 AND existing.decision=requested AND existing.reason_code IS NOT DISTINCT FROM $4 THEN existing.decision ELSE 'unavailable' END;
  END IF;
  SELECT * INTO claim FROM app.donation_claims d WHERE d.id=$1 AND d.status='pending' FOR UPDATE;
  IF NOT FOUND THEN RETURN 'unavailable'; END IF;
  UPDATE app.donation_claims SET status=requested,
    verified_amount_minor=CASE WHEN requested='verified' THEN claim.expected_amount_minor ELSE NULL END,
    verified_currency=CASE WHEN requested='verified' THEN claim.expected_currency ELSE NULL END,
    rejection_reason_code=CASE WHEN requested='rejected' THEN $4 ELSE NULL END,
    reviewed_at=clock_timestamp()
   WHERE id=$1 AND status='pending';
  IF NOT FOUND THEN RETURN 'unavailable'; END IF;
  INSERT INTO app.donation_claim_review_events(claim_id,moderator_key,decision,reason_code,operation_id)
   VALUES($1,$2,requested,$4,$5);
  RETURN requested;
END $$;

CREATE OR REPLACE FUNCTION api.activate_exclusive_placement(uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE claim app.donation_claims%ROWTYPE; banner app.banner_assets%ROWTYPE; active_count integer;
BEGIN
  SELECT * INTO claim FROM app.donation_claims WHERE id=$1 FOR UPDATE;
  IF NOT FOUND OR claim.status<>'verified' THEN RETURN 'claim_unavailable'; END IF;
  IF EXISTS(SELECT 1 FROM app.exclusive_placements WHERE donation_claim_id=claim.id) THEN RETURN 'already_used'; END IF;
  IF NOT EXISTS(SELECT 1 FROM app.ad_packages WHERE code=claim.package_code AND is_active) OR claim.verified_amount_minor<>claim.expected_amount_minor OR claim.verified_currency<>claim.expected_currency THEN RETURN 'claim_mismatch'; END IF;
  SELECT * INTO banner FROM app.banner_assets WHERE server_id=claim.server_id AND moderation_status='approved';
  IF NOT FOUND THEN RETURN 'banner_unavailable'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('exclusive-game:'||(SELECT game_slug FROM app.servers WHERE id=claim.server_id),0));
  SELECT count(*) INTO active_count FROM app.exclusive_placements p JOIN app.servers s ON s.id=p.server_id WHERE s.game_slug=(SELECT game_slug FROM app.servers WHERE id=claim.server_id) AND p.status='active' AND p.expires_at>clock_timestamp();
  INSERT INTO app.exclusive_placements(server_id,banner_id,donation_claim_id,duration_days,status,starts_at,expires_at)
  VALUES(claim.server_id,banner.id,claim.id,claim.expected_duration_days,CASE WHEN active_count<3 THEN 'active' ELSE 'waiting' END,CASE WHEN active_count<3 THEN clock_timestamp() ELSE NULL END,CASE WHEN active_count<3 THEN clock_timestamp()+make_interval(days=>claim.expected_duration_days) ELSE NULL END);
  RETURN CASE WHEN active_count<3 THEN 'active' ELSE 'waiting' END;
END $$;

REVOKE ALL ON app.donation_claim_review_events FROM PUBLIC,hyperdrive_reader;
REVOKE ALL ON FUNCTION api.list_pending_donation_claims() FROM PUBLIC;
REVOKE ALL ON FUNCTION api.moderate_donation_claim(uuid,bytea,varchar,varchar,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION api.list_pending_donation_claims() TO hyperdrive_reader;
GRANT EXECUTE ON FUNCTION api.moderate_donation_claim(uuid,bytea,varchar,varchar,uuid) TO hyperdrive_reader;
COMMIT;
