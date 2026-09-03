BEGIN;

ALTER TABLE app.donation_claims ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE app.donation_claims ADD COLUMN rejection_reason_code varchar(40);
ALTER TABLE app.donation_claims ADD CONSTRAINT donation_reference_format CHECK (donor_reference ~ '^[A-Z0-9]{8,128}$');

INSERT INTO app.ad_packages(code,duration_days,price_minor,currency,is_active) VALUES
 ('exclusive_7_day',7,1000,'USD',true),
 ('exclusive_30_day',30,2000,'USD',true)
ON CONFLICT(code) DO UPDATE SET duration_days=EXCLUDED.duration_days,price_minor=EXCLUDED.price_minor,currency=EXCLUDED.currency,is_active=true;

CREATE FUNCTION api.submit_donation_claim(bytea,uuid,varchar,varchar)
RETURNS TABLE(outcome text,claim_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  IF $1 IS NULL OR $2 IS NULL OR $3 IS NULL OR $4 IS NULL OR octet_length($1)<>32 OR $4 !~ '^[A-Z0-9]{8,128}$' THEN RETURN QUERY SELECT 'invalid'::text,NULL::uuid; RETURN; END IF;
  IF NOT EXISTS(SELECT 1 FROM app.servers s WHERE s.id=$2 AND s.owner_key=$1 AND s.status='active') OR
     NOT EXISTS(SELECT 1 FROM app.ad_packages p WHERE p.code=$3 AND p.is_active) THEN
    RETURN QUERY SELECT 'unavailable'::text,NULL::uuid; RETURN;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('donation-owner:'||encode($1,'hex'),0));
  IF (SELECT count(*) FROM app.donation_claims d WHERE d.owner_key=$1 AND d.status='pending')>=3 THEN
    RETURN QUERY SELECT 'limit_reached'::text,NULL::uuid; RETURN;
  END IF;
  BEGIN
    RETURN QUERY INSERT INTO app.donation_claims(server_id,owner_key,package_code,donor_reference)
      VALUES($2,$1,$3,$4) RETURNING 'accepted'::text,app.donation_claims.id;
  EXCEPTION WHEN unique_violation THEN RETURN QUERY SELECT 'duplicate'::text,NULL::uuid;
  END;
END $$;

REVOKE ALL ON FUNCTION api.submit_donation_claim(bytea,uuid,varchar,varchar) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION api.submit_donation_claim(bytea,uuid,varchar,varchar) TO hyperdrive_reader;
COMMIT;
