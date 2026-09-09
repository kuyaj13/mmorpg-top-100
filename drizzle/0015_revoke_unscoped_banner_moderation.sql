BEGIN;

REVOKE ALL ON FUNCTION api.list_pending_banners() FROM PUBLIC,hyperdrive_reader;
REVOKE ALL ON FUNCTION api.get_banner_review_preview(uuid) FROM PUBLIC,hyperdrive_reader;
REVOKE ALL ON FUNCTION api.moderate_banner(uuid,bytea,varchar,uuid) FROM PUBLIC,hyperdrive_reader;

COMMIT;
