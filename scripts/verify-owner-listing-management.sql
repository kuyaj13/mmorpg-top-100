\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE s app.servers%ROWTYPE; result text; change_id uuid;
BEGIN
 SELECT * INTO s FROM app.servers WHERE owner_key IS NOT NULL AND status='active' LIMIT 1;
 IF NOT FOUND THEN RAISE EXCEPTION 'no owned server fixture'; END IF;
 SELECT api.request_server_listing_change(s.owner_key,s.id,s.name,s.website,lower(split_part(split_part(s.website,'://',2),'/',1)),COALESCE(s.game_version,'Unknown'),COALESCE(s.region,'Global'),COALESCE(s.mode,'PvE'),COALESCE(s.description,'An established private server listing for regression verification.')) INTO result;
 IF result<>'pending' THEN RAISE EXCEPTION 'change request failed: %',result; END IF;
 SELECT id INTO change_id FROM app.server_listing_changes WHERE server_id=s.id AND status='pending';
 IF NOT EXISTS(SELECT 1 FROM api.list_pending_server_listing_changes() review WHERE review.id=change_id AND review.current_name=s.name AND review.current_website=s.website) THEN RAISE EXCEPTION 'review comparison failed'; END IF;
 SELECT api.moderate_server_listing_change(change_id,decode(repeat('11',32),'hex'),'approve',NULL,gen_random_uuid()) INTO result;
 IF result<>'approved' THEN RAISE EXCEPTION 'approval failed: %',result; END IF;
 SELECT api.remove_owned_server(s.owner_key,s.id) INTO result;
 IF result<>'removed' OR EXISTS(SELECT 1 FROM api.public_rankings WHERE id=s.id) THEN RAISE EXCEPTION 'removal failed'; END IF;
END $$;
ROLLBACK;
