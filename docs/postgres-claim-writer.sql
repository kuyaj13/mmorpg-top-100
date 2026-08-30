-- Run as the database owner after creating a login role named
-- mmorpg_claim_writer through the approved secret-management workflow.
-- Do not place the role password in this repository.

ALTER ROLE mmorpg_claim_writer
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
REVOKE CREATE ON SCHEMA public FROM mmorpg_claim_writer;

GRANT CONNECT ON DATABASE mmorpg_top_100 TO mmorpg_claim_writer;
GRANT USAGE ON SCHEMA public TO mmorpg_claim_writer;

GRANT SELECT (id, owner_uid, status)
  ON TABLE public.server
  TO mmorpg_claim_writer;

GRANT SELECT (code, is_active, tier, duration_days)
  ON TABLE public.ad_package
  TO mmorpg_claim_writer;

GRANT INSERT (id, advertiser_uid, server_id, package_code, donor_reference, status, created_at)
  ON TABLE public.donation_claim
  TO mmorpg_claim_writer;

GRANT INSERT (id, claim_id, actor_uid, action, created_at)
  ON TABLE public.donation_review_event
  TO mmorpg_claim_writer;
