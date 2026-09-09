\set ON_ERROR_STOP on
BEGIN;

WITH new_servers AS (
  INSERT INTO app.servers(game_slug,name,website,status,owner_key,game_version,region,mode,description)
  SELECT 'flyff','Ad lifecycle '||n,'https://ad-lifecycle-'||n||'.invalid/','active',decode(repeat('42',32),'hex'),'v1','Global','PvE','Rollback-only advertising verification server.'
  FROM generate_series(1,4) n RETURNING id,name
)
INSERT INTO app.banner_assets(server_id,banner_kind,content,static_content,original_sha256,sanitized_sha256,media_type,byte_size,width,height,frame_count,animation_duration_ms,alt_text,moderation_status,reviewed_at)
SELECT id,'exclusive',decode('00','hex'),decode('00','hex'),decode(repeat('01',32),'hex'),decode(repeat('02',32),'hex'),'image/png',1,936,120,1,0,name||' banner','approved',clock_timestamp() FROM new_servers;

INSERT INTO app.donation_claims(server_id,owner_key,package_code,donor_reference,status,verified_amount_minor,verified_currency,reviewed_at,expected_amount_minor,expected_currency,expected_duration_days)
SELECT s.id,decode(repeat('42',32),'hex'),'exclusive_7_day','LIFECYCLE'||row_number() OVER(ORDER BY s.name)||'TEST','verified',1000,'USD',clock_timestamp(),1000,'USD',7
FROM app.servers s WHERE s.name LIKE 'Ad lifecycle %';

SELECT api.reconcile_exclusive_game('flyff');
DO $$ DECLARE active_count integer;waiting_count integer;first_id uuid;second_id uuid;first_expiry timestamptz;result text;
BEGIN
 SELECT count(*) FILTER(WHERE p.status='active'),count(*) FILTER(WHERE p.status='waiting') INTO active_count,waiting_count FROM app.exclusive_placements p JOIN app.servers s ON s.id=p.server_id WHERE s.name LIKE 'Ad lifecycle %';
 IF active_count<>3 OR waiting_count<>1 THEN RAISE EXCEPTION 'inventory or queue verification failed'; END IF;
 SELECT p.id,p.expires_at INTO first_id,first_expiry FROM app.exclusive_placements p JOIN app.servers s ON s.id=p.server_id WHERE s.name='Ad lifecycle 1';
 SELECT api.moderate_exclusive_placement(first_id,decode(repeat('43',32),'hex'),'suspend','10000000-0000-4000-8000-000000000001') INTO result;
 IF result<>'suspend' THEN RAISE EXCEPTION 'suspension failed'; END IF;
 UPDATE app.exclusive_reconciliation_state SET last_reconciled_at=clock_timestamp()-interval '1 minute' WHERE game_slug='flyff';
 PERFORM api.reconcile_exclusive_game('flyff');
 SELECT api.moderate_exclusive_placement(first_id,decode(repeat('43',32),'hex'),'reactivate','10000000-0000-4000-8000-000000000002') INTO result;
 IF result<>'inventory_full' THEN RAISE EXCEPTION 'inventory cap failed'; END IF;
 SELECT p.id INTO second_id FROM app.exclusive_placements p JOIN app.servers s ON s.id=p.server_id WHERE s.name='Ad lifecycle 2';
 PERFORM api.moderate_exclusive_placement(second_id,decode(repeat('43',32),'hex'),'suspend','10000000-0000-4000-8000-000000000003');
 SELECT api.moderate_exclusive_placement(first_id,decode(repeat('43',32),'hex'),'reactivate','10000000-0000-4000-8000-000000000004') INTO result;
 IF result<>'reactivate' OR (SELECT expires_at FROM app.exclusive_placements WHERE id=first_id) IS DISTINCT FROM first_expiry THEN RAISE EXCEPTION 'safe reactivation failed'; END IF;
 UPDATE app.exclusive_placements SET starts_at=clock_timestamp()-interval '8 days',expires_at=clock_timestamp()-interval '1 day' WHERE id=first_id;
 UPDATE app.exclusive_reconciliation_state SET last_reconciled_at=clock_timestamp()-interval '1 minute' WHERE game_slug='flyff';
 PERFORM api.reconcile_exclusive_game('flyff');
 IF (SELECT status FROM app.exclusive_placements WHERE id=first_id)<>'expired' THEN RAISE EXCEPTION 'expiration failed'; END IF;
END $$;

ROLLBACK;
SELECT 'Advertising lifecycle verification passed; all test writes were rolled back.' AS result;
