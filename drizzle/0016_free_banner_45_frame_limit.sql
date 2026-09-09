BEGIN;

ALTER TABLE app.banner_assets
  DROP CONSTRAINT banner_animation_caps,
  DROP CONSTRAINT banner_frames_by_kind,
  ADD CONSTRAINT banner_animation_caps
    CHECK (frame_count >= 1 AND animation_duration_ms BETWEEN 0 AND 15000),
  ADD CONSTRAINT banner_frames_by_kind
    CHECK (
      (banner_kind = 'free' AND frame_count <= 45)
      OR (banner_kind = 'exclusive' AND frame_count <= 15)
    );

ALTER TABLE app.submission_banner_assets
  DROP CONSTRAINT submission_banner_animation_caps,
  ADD CONSTRAINT submission_banner_animation_caps
    CHECK (frame_count BETWEEN 1 AND 45 AND animation_duration_ms BETWEEN 0 AND 15000);

COMMIT;
