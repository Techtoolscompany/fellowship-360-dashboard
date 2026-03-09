-- Prevent double-booking appointments within a 30-minute conflict window per organization.
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint

DO $$
BEGIN
  ALTER TABLE "appointment"
    ADD CONSTRAINT "appointment_org_time_overlap_excl"
    EXCLUDE USING gist (
      "organization_id" WITH =,
      tsrange("date_time" - interval '30 minutes', "date_time" + interval '30 minutes', '[)') WITH &&
    )
    WHERE ("status" IN ('scheduled', 'confirmed'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
