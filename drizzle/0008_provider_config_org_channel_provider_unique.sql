WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY organization_id, channel, provider
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM provider_config
)
DELETE FROM provider_config pc
USING ranked r
WHERE pc.id = r.id
  AND r.rn > 1;

--> statement-breakpoint
DROP INDEX IF EXISTS provider_config_org_channel_idx;

--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS provider_config_org_channel_provider_uidx
  ON provider_config USING btree (organization_id, channel, provider);
