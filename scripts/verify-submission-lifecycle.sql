\set ON_ERROR_STOP on
BEGIN;

DO $$
DECLARE
  owner_key bytea := decode(repeat('51',32),'hex');
  moderator_key bytea := decode(repeat('52',32),'hex');
  submission_id uuid;
  created_server_id uuid;
  submit_outcome text;
  banner_outcome text;
  moderation_outcome text;
BEGIN
  SELECT outcome,result.submission_id INTO submit_outcome,submission_id
  FROM api.submit_server(owner_key,'flyff','Submission lifecycle audit','https://submission-lifecycle.invalid/','submission-lifecycle.invalid','v1','Global','PvE','Rollback-only verification of the complete server submission flow.') result;
  IF submit_outcome <> 'accepted' OR submission_id IS NULL THEN RAISE EXCEPTION 'submission creation failed'; END IF;

  SELECT api.put_submission_banner(submission_id,owner_key,decode('00','hex'),decode('00','hex'),decode(repeat('01',32),'hex'),decode(repeat('02',32),'hex'),'image/png',468,60,1,0,'Submission lifecycle audit banner') INTO banner_outcome;
  IF banner_outcome <> 'stored' THEN RAISE EXCEPTION 'submission banner storage failed'; END IF;

  SELECT outcome,result.server_id INTO moderation_outcome,created_server_id
  FROM api.moderate_server_submission(submission_id,moderator_key,'approve',NULL,'20000000-0000-4000-8000-000000000001') result;
  IF moderation_outcome <> 'approved' OR created_server_id IS NULL THEN RAISE EXCEPTION 'submission approval failed'; END IF;
  IF NOT EXISTS(SELECT 1 FROM app.banner_assets WHERE app.banner_assets.server_id=created_server_id AND banner_kind='free' AND moderation_status='pending') THEN RAISE EXCEPTION 'approved submission banner handoff failed'; END IF;
  IF NOT EXISTS(SELECT 1 FROM api.public_rankings WHERE id=created_server_id) THEN RAISE EXCEPTION 'approved server is missing from public rankings'; END IF;
END $$;

ROLLBACK;
SELECT 'Submission lifecycle verification passed; all test writes were rolled back.' AS result;
