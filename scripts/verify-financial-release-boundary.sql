\set ON_ERROR_STOP on
BEGIN;

CREATE TEMP TABLE financial_boundary_ids(kind varchar PRIMARY KEY,id uuid NOT NULL);
INSERT INTO app.games(slug,name,game_type,is_active) VALUES('financial-boundary-test','Financial Boundary Test','MMORPG',true);

WITH server AS (
  INSERT INTO app.servers(game_slug,name,website,status,owner_key,game_version,region,mode,description)
  VALUES('financial-boundary-test','Financial boundary 7 day','https://financial-boundary-7.invalid/','active',decode(repeat('61',32),'hex'),'v1','Global','PvE','Rollback-only financial release verification server.')
  RETURNING id
), claim AS (
  SELECT outcome,claim_id FROM server, LATERAL api.submit_donation_claim(decode(repeat('61',32),'hex'),server.id,'exclusive_7_day','FINANCIALBOUNDARYTEST')
)
INSERT INTO financial_boundary_ids(kind,id)
SELECT 'server',id FROM server
UNION ALL
SELECT 'claim',claim_id FROM claim WHERE outcome='accepted';

DO $$
DECLARE v_server_id uuid; v_claim_id uuid; outcome text;
BEGIN
 SELECT id INTO v_server_id FROM financial_boundary_ids WHERE kind='server';
 SELECT id INTO v_claim_id FROM financial_boundary_ids WHERE kind='claim';
 IF v_server_id IS NULL OR v_claim_id IS NULL THEN RAISE EXCEPTION 'claim submission failed'; END IF;
 SELECT api.moderate_donation_claim(v_claim_id,decode(repeat('62',32),'hex'),'verify',NULL,'40000000-0000-4000-8000-000000000001') INTO outcome;
 IF outcome<>'verified' THEN RAISE EXCEPTION 'claim verification failed'; END IF;
 IF (SELECT count(*) FROM app.donation_claim_review_events e WHERE e.claim_id=v_claim_id)<>1 THEN RAISE EXCEPTION 'claim review audit event missing'; END IF;
 IF EXISTS(SELECT 1 FROM app.exclusive_placements p WHERE p.donation_claim_id=v_claim_id) THEN RAISE EXCEPTION 'verification alone created a placement'; END IF;
 IF (SELECT verified_amount_minor FROM app.donation_claims d WHERE d.id=v_claim_id)<>1000 OR (SELECT btrim(verified_currency) FROM app.donation_claims d WHERE d.id=v_claim_id)<>'USD' THEN RAISE EXCEPTION 'server-owned financial snapshot was not applied'; END IF;
 SELECT api.moderate_donation_claim(v_claim_id,decode(repeat('62',32),'hex'),'verify',NULL,'40000000-0000-4000-8000-000000000001') INTO outcome;
 IF outcome<>'verified' OR (SELECT count(*) FROM app.donation_claim_review_events e WHERE e.claim_id=v_claim_id)<>1 THEN RAISE EXCEPTION 'claim verification was not idempotent'; END IF;
 PERFORM api.reconcile_exclusive_game('financial-boundary-test');
 IF EXISTS(SELECT 1 FROM app.exclusive_placements p WHERE p.donation_claim_id=v_claim_id) THEN RAISE EXCEPTION 'claim without a banner created a placement'; END IF;
END $$;

WITH target AS (SELECT id FROM financial_boundary_ids WHERE kind='server')
INSERT INTO app.banner_assets(server_id,banner_kind,content,static_content,original_sha256,sanitized_sha256,media_type,byte_size,width,height,frame_count,animation_duration_ms,alt_text,moderation_status,reviewed_at)
SELECT id,'free',decode('00','hex'),decode('00','hex'),decode(repeat('63',32),'hex'),decode(repeat('64',32),'hex'),'image/png',1,468,60,1,0,'Financial boundary free banner','approved',clock_timestamp() FROM target;

UPDATE app.exclusive_reconciliation_state SET last_reconciled_at=clock_timestamp()-interval '1 minute' WHERE game_slug='financial-boundary-test';
SELECT api.reconcile_exclusive_game('financial-boundary-test');

DO $$
DECLARE v_claim_id uuid;
BEGIN
 SELECT id INTO v_claim_id FROM financial_boundary_ids WHERE kind='claim';
 IF EXISTS(SELECT 1 FROM app.exclusive_placements p WHERE p.donation_claim_id=v_claim_id) THEN RAISE EXCEPTION 'free banner created a paid placement'; END IF;
END $$;

WITH target AS (SELECT id FROM financial_boundary_ids WHERE kind='server'), banner AS (
  INSERT INTO app.banner_assets(server_id,banner_kind,content,static_content,original_sha256,sanitized_sha256,media_type,byte_size,width,height,frame_count,animation_duration_ms,alt_text,moderation_status)
  SELECT id,'exclusive',decode('00','hex'),decode('00','hex'),decode(repeat('65',32),'hex'),decode(repeat('66',32),'hex'),'image/png',1,936,120,1,0,'Financial boundary exclusive banner','pending' FROM target
  RETURNING id
)
INSERT INTO financial_boundary_ids(kind,id) SELECT 'banner',id FROM banner;

UPDATE app.exclusive_reconciliation_state SET last_reconciled_at=clock_timestamp()-interval '1 minute' WHERE game_slug='financial-boundary-test';
SELECT api.reconcile_exclusive_game('financial-boundary-test');

DO $$
DECLARE v_claim_id uuid; v_banner_id uuid; outcome text;
BEGIN
 SELECT id INTO v_claim_id FROM financial_boundary_ids WHERE kind='claim';
 SELECT id INTO v_banner_id FROM financial_boundary_ids WHERE kind='banner';
 IF EXISTS(SELECT 1 FROM app.exclusive_placements p WHERE p.donation_claim_id=v_claim_id) THEN RAISE EXCEPTION 'pending exclusive banner created a placement'; END IF;
 SELECT api.moderate_banner(v_banner_id,decode(repeat('62',32),'hex'),'approve','40000000-0000-4000-8000-000000000002',true) INTO outcome;
 IF outcome<>'approved' THEN RAISE EXCEPTION 'exclusive banner approval failed'; END IF;
END $$;

UPDATE app.exclusive_reconciliation_state SET last_reconciled_at=clock_timestamp()-interval '1 minute' WHERE game_slug='financial-boundary-test';
SELECT api.reconcile_exclusive_game('financial-boundary-test');

DO $$
DECLARE v_claim_id uuid; v_banner_id uuid; placement app.exclusive_placements%ROWTYPE;
BEGIN
 SELECT id INTO v_claim_id FROM financial_boundary_ids WHERE kind='claim';
 SELECT id INTO v_banner_id FROM financial_boundary_ids WHERE kind='banner';
 SELECT * INTO placement FROM app.exclusive_placements p WHERE p.donation_claim_id=v_claim_id;
 IF NOT FOUND OR placement.status<>'active' OR placement.banner_id<>v_banner_id OR placement.duration_days<>7 THEN RAISE EXCEPTION 'eligible placement was not activated correctly'; END IF;
 IF placement.expires_at IS NULL OR placement.starts_at IS NULL OR placement.expires_at-placement.starts_at<>interval '7 days' THEN RAISE EXCEPTION 'placement duration was not exact'; END IF;
 IF (SELECT count(*) FROM app.exclusive_placements p WHERE p.donation_claim_id=v_claim_id)<>1 THEN RAISE EXCEPTION 'claim granted more than one placement'; END IF;
END $$;

WITH server AS (
  INSERT INTO app.servers(game_slug,name,website,status,owner_key,game_version,region,mode,description)
  VALUES('financial-boundary-test','Financial boundary 30 day','https://financial-boundary-30.invalid/','active',decode(repeat('71',32),'hex'),'v1','Global','PvE','Rollback-only 30-day financial release verification server.')
  RETURNING id
), claim AS (
  SELECT outcome,claim_id FROM server, LATERAL api.submit_donation_claim(decode(repeat('71',32),'hex'),server.id,'exclusive_30_day','FINANCIALBOUNDARY30TEST')
)
INSERT INTO financial_boundary_ids(kind,id)
SELECT 'server30',id FROM server
UNION ALL
SELECT 'claim30',claim_id FROM claim WHERE outcome='accepted';

DO $$
DECLARE v_claim_id uuid; outcome text;
BEGIN
 SELECT id INTO v_claim_id FROM financial_boundary_ids WHERE kind='claim30';
 IF v_claim_id IS NULL THEN RAISE EXCEPTION '30-day claim submission failed'; END IF;
 SELECT api.moderate_donation_claim(v_claim_id,decode(repeat('72',32),'hex'),'verify',NULL,'40000000-0000-4000-8000-000000000003') INTO outcome;
 IF outcome<>'verified' THEN RAISE EXCEPTION '30-day claim verification failed'; END IF;
 IF (SELECT verified_amount_minor FROM app.donation_claims d WHERE d.id=v_claim_id)<>2000 OR (SELECT btrim(verified_currency) FROM app.donation_claims d WHERE d.id=v_claim_id)<>'USD' OR (SELECT expected_duration_days FROM app.donation_claims d WHERE d.id=v_claim_id)<>30 THEN RAISE EXCEPTION '30-day server-owned financial snapshot was not applied'; END IF;
 IF EXISTS(SELECT 1 FROM app.exclusive_placements p WHERE p.donation_claim_id=v_claim_id) THEN RAISE EXCEPTION '30-day verification alone created a placement'; END IF;
END $$;

WITH target AS (SELECT id FROM financial_boundary_ids WHERE kind='server30'), banner AS (
  INSERT INTO app.banner_assets(server_id,banner_kind,content,static_content,original_sha256,sanitized_sha256,media_type,byte_size,width,height,frame_count,animation_duration_ms,alt_text,moderation_status)
  SELECT id,'exclusive',decode('00','hex'),decode('00','hex'),decode(repeat('73',32),'hex'),decode(repeat('74',32),'hex'),'image/png',1,936,120,1,0,'Financial boundary 30-day exclusive banner','pending' FROM target
  RETURNING id
)
INSERT INTO financial_boundary_ids(kind,id) SELECT 'banner30',id FROM banner;

DO $$
DECLARE v_banner_id uuid; outcome text;
BEGIN
 SELECT id INTO v_banner_id FROM financial_boundary_ids WHERE kind='banner30';
 SELECT api.moderate_banner(v_banner_id,decode(repeat('72',32),'hex'),'approve','40000000-0000-4000-8000-000000000004',true) INTO outcome;
 IF outcome<>'approved' THEN RAISE EXCEPTION '30-day exclusive banner approval failed'; END IF;
END $$;

UPDATE app.exclusive_reconciliation_state SET last_reconciled_at=clock_timestamp()-interval '1 minute' WHERE game_slug='financial-boundary-test';
SELECT api.reconcile_exclusive_game('financial-boundary-test');

DO $$
DECLARE v_claim_id uuid; v_banner_id uuid; placement app.exclusive_placements%ROWTYPE;
BEGIN
 SELECT id INTO v_claim_id FROM financial_boundary_ids WHERE kind='claim30';
 SELECT id INTO v_banner_id FROM financial_boundary_ids WHERE kind='banner30';
 SELECT * INTO placement FROM app.exclusive_placements p WHERE p.donation_claim_id=v_claim_id;
 IF NOT FOUND OR placement.status<>'active' OR placement.banner_id<>v_banner_id OR placement.duration_days<>30 THEN RAISE EXCEPTION 'eligible 30-day placement was not activated correctly'; END IF;
 IF placement.expires_at IS NULL OR placement.starts_at IS NULL OR placement.expires_at-placement.starts_at<>interval '30 days' THEN RAISE EXCEPTION '30-day placement duration was not exact'; END IF;
 IF (SELECT count(*) FROM app.exclusive_placements p WHERE p.donation_claim_id=v_claim_id)<>1 THEN RAISE EXCEPTION '30-day claim granted more than one placement'; END IF;
END $$;

ROLLBACK;
SELECT 'Financial release boundary verification passed; all test writes were rolled back.' AS result;
