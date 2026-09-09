BEGIN;

CREATE OR REPLACE FUNCTION api.moderate_banner(uuid,bytea,varchar,uuid,boolean) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE
  existing app.banner_moderation_events%ROWTYPE;
  requested varchar;
  approved_game_slug varchar;
BEGIN
 IF octet_length($2)<>32 OR $3 NOT IN ('approve','reject','suspend') THEN RAISE EXCEPTION 'invalid moderation decision'; END IF;
 requested:=CASE $3 WHEN 'approve' THEN 'approved' WHEN 'reject' THEN 'rejected' ELSE 'suspended' END;
 SELECT * INTO existing FROM app.banner_moderation_events WHERE operation_id=$4;
 IF FOUND THEN
   IF NOT EXISTS(SELECT 1 FROM app.banner_assets WHERE id=$1 AND ($5 OR banner_kind='free')) THEN RETURN 'unavailable'; END IF;
   RETURN CASE WHEN existing.banner_id=$1 AND existing.moderator_key=$2 AND existing.decision=requested THEN existing.decision ELSE 'unavailable' END;
 END IF;
 UPDATE app.banner_assets SET moderation_status=requested,reviewed_at=clock_timestamp()
 WHERE id=$1 AND ($5 OR banner_kind='free') AND (moderation_status='pending' OR (requested='suspended' AND moderation_status='approved'));
 IF NOT FOUND THEN RETURN 'unavailable'; END IF;
 INSERT INTO app.banner_moderation_events(banner_id,moderator_key,decision,operation_id) VALUES($1,$2,requested,$4);
 IF requested='approved' THEN
   SELECT s.game_slug INTO approved_game_slug
   FROM app.banner_assets b JOIN app.servers s ON s.id=b.server_id
   WHERE b.id=$1 AND b.banner_kind='exclusive';
   IF approved_game_slug IS NOT NULL THEN PERFORM api.reconcile_exclusive_game(approved_game_slug); END IF;
 END IF;
 RETURN requested;
END $$;

DO $$
DECLARE eligible_game varchar;
BEGIN
  FOR eligible_game IN
    SELECT DISTINCT s.game_slug
    FROM app.donation_claims d
    JOIN app.servers s ON s.id=d.server_id
    JOIN app.banner_assets b ON b.server_id=s.id AND b.banner_kind='exclusive'
    WHERE d.status='verified' AND b.moderation_status='approved'
      AND NOT EXISTS(SELECT 1 FROM app.exclusive_placements p WHERE p.donation_claim_id=d.id)
  LOOP
    PERFORM api.reconcile_exclusive_game(eligible_game);
  END LOOP;
END $$;

COMMIT;
