BEGIN;

CREATE TEMP TABLE moderation_scope_ids(kind varchar PRIMARY KEY,id uuid NOT NULL);

WITH new_servers AS (
  INSERT INTO app.servers(game_slug,name,website,status,owner_key,game_version,region,mode,description)
  VALUES
    ('flyff','Free moderation scope test','https://free-moderation-scope.invalid/','active',decode(repeat('31',32),'hex'),'v1','Global','PvE','Rollback-only banner moderation scope test.'),
    ('flyff','Exclusive moderation scope test','https://exclusive-moderation-scope.invalid/','active',decode(repeat('32',32),'hex'),'v1','Global','PvE','Rollback-only banner moderation scope test.')
  RETURNING id,name
), new_banners AS (
  INSERT INTO app.banner_assets(server_id,banner_kind,content,static_content,original_sha256,sanitized_sha256,media_type,byte_size,width,height,frame_count,animation_duration_ms,alt_text,moderation_status)
  SELECT id,'free',decode('00','hex'),decode('00','hex'),decode(repeat('41',32),'hex'),decode(repeat('42',32),'hex'),'image/png',1,468,60,1,0,'Free moderation scope banner','pending'
  FROM new_servers WHERE name='Free moderation scope test'
  UNION ALL
  SELECT id,'exclusive',decode('00','hex'),decode('00','hex'),decode(repeat('43',32),'hex'),decode(repeat('44',32),'hex'),'image/png',1,936,120,1,0,'Exclusive moderation scope banner','pending'
  FROM new_servers WHERE name='Exclusive moderation scope test'
  RETURNING id,banner_kind
)
INSERT INTO moderation_scope_ids(kind,id) SELECT banner_kind,id FROM new_banners;

DO $$
DECLARE free_id uuid; exclusive_id uuid; outcome text;
BEGIN
 SELECT id INTO free_id FROM moderation_scope_ids WHERE kind='free';
 SELECT id INTO exclusive_id FROM moderation_scope_ids WHERE kind='exclusive';
 IF (SELECT count(*) FROM api.list_pending_banners(false) WHERE id IN (free_id,exclusive_id)) <> 1 THEN RAISE EXCEPTION 'disabled scope did not return exactly one test banner'; END IF;
 IF NOT EXISTS(SELECT 1 FROM api.list_pending_banners(false) WHERE id=free_id AND banner_kind='free') THEN RAISE EXCEPTION 'free banner was hidden'; END IF;
 IF EXISTS(SELECT 1 FROM api.list_pending_banners(false) WHERE id=exclusive_id) THEN RAISE EXCEPTION 'exclusive banner was exposed'; END IF;
 IF EXISTS(SELECT 1 FROM api.get_banner_review_preview(exclusive_id,false)) THEN RAISE EXCEPTION 'exclusive preview was exposed'; END IF;
 outcome:=api.moderate_banner(exclusive_id,decode(repeat('51',32),'hex'),'approve','30000000-0000-4000-8000-000000000001',false);
 IF outcome<>'unavailable' THEN RAISE EXCEPTION 'exclusive moderation was not denied'; END IF;
 IF (SELECT moderation_status FROM app.banner_assets WHERE id=exclusive_id)<>'pending' THEN RAISE EXCEPTION 'exclusive banner status changed'; END IF;
 outcome:=api.moderate_banner(free_id,decode(repeat('51',32),'hex'),'approve','30000000-0000-4000-8000-000000000002',false);
 IF outcome<>'approved' THEN RAISE EXCEPTION 'free moderation was denied'; END IF;
 IF NOT EXISTS(SELECT 1 FROM api.list_pending_banners(true) WHERE id=exclusive_id AND banner_kind='exclusive') THEN RAISE EXCEPTION 'enabled scope did not expose exclusive banner'; END IF;
END $$;

ROLLBACK;
SELECT 'Banner moderation scope verification passed; all test writes were rolled back.' AS result;
