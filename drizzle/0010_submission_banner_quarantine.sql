BEGIN;

CREATE TABLE app.submission_banner_assets (
  submission_id uuid PRIMARY KEY REFERENCES app.server_submissions(id) ON DELETE CASCADE,
  content bytea NOT NULL,
  static_content bytea NOT NULL,
  original_sha256 bytea NOT NULL,
  sanitized_sha256 bytea NOT NULL,
  media_type varchar(20) NOT NULL,
  byte_size integer NOT NULL,
  width integer NOT NULL,
  height integer NOT NULL,
  frame_count integer NOT NULL,
  animation_duration_ms integer NOT NULL,
  alt_text varchar(180) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT submission_banner_content_size CHECK (byte_size BETWEEN 1 AND 524288 AND octet_length(content)=byte_size),
  CONSTRAINT submission_banner_static_size CHECK (octet_length(static_content) BETWEEN 1 AND 262144),
  CONSTRAINT submission_banner_hash_size CHECK (octet_length(original_sha256)=32 AND octet_length(sanitized_sha256)=32),
  CONSTRAINT submission_banner_media_allowed CHECK (media_type IN ('image/gif','image/png','image/jpeg')),
  CONSTRAINT submission_banner_dimensions CHECK (width=468 AND height=60),
  CONSTRAINT submission_banner_animation_caps CHECK (frame_count BETWEEN 1 AND 30 AND animation_duration_ms BETWEEN 0 AND 15000),
  CONSTRAINT submission_banner_alt_text CHECK (char_length(btrim(alt_text)) BETWEEN 10 AND 160)
);

CREATE FUNCTION api.put_submission_banner(uuid,bytea,bytea,bytea,bytea,bytea,varchar,integer,integer,integer,integer,varchar)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  IF $1 IS NULL OR $2 IS NULL OR octet_length($2)<>32 THEN RETURN 'unavailable'; END IF;
  PERFORM 1 FROM app.server_submissions s
   WHERE s.id=$1 AND s.owner_key=$2 AND s.status='pending'
   FOR UPDATE;
  IF NOT FOUND THEN RETURN 'unavailable'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('submission-banner-capacity',0));
  IF (SELECT count(*) FROM app.submission_banner_assets) >= 100 THEN RETURN 'unavailable'; END IF;
  INSERT INTO app.submission_banner_assets(submission_id,content,static_content,original_sha256,sanitized_sha256,media_type,byte_size,width,height,frame_count,animation_duration_ms,alt_text)
  VALUES($1,$3,$4,$5,$6,$7,octet_length($3),$8,$9,$10,$11,btrim($12));
  RETURN 'stored';
END $$;

CREATE FUNCTION app.resolve_submission_banner() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
  IF NEW.decision='approve' AND NEW.server_id IS NOT NULL THEN
    INSERT INTO app.banner_assets(server_id,content,static_content,original_sha256,sanitized_sha256,media_type,byte_size,width,height,frame_count,animation_duration_ms,alt_text,moderation_status,created_at)
    SELECT NEW.server_id,b.content,b.static_content,b.original_sha256,b.sanitized_sha256,b.media_type,b.byte_size,b.width,b.height,b.frame_count,b.animation_duration_ms,b.alt_text,'pending',b.created_at
    FROM app.submission_banner_assets b WHERE b.submission_id=NEW.submission_id;
  END IF;
  DELETE FROM app.submission_banner_assets WHERE submission_id=NEW.submission_id;
  RETURN NEW;
END $$;
CREATE TRIGGER server_moderation_resolve_submission_banner AFTER INSERT ON app.server_moderation_events
FOR EACH ROW EXECUTE FUNCTION app.resolve_submission_banner();

REVOKE ALL ON app.submission_banner_assets FROM PUBLIC,hyperdrive_reader;
REVOKE ALL ON FUNCTION api.put_submission_banner(uuid,bytea,bytea,bytea,bytea,bytea,varchar,integer,integer,integer,integer,varchar) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.resolve_submission_banner() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION api.put_submission_banner(uuid,bytea,bytea,bytea,bytea,bytea,varchar,integer,integer,integer,integer,varchar) TO hyperdrive_reader;
COMMIT;
