# Preflight Clearance Checklist

Last updated: April 1, 2026  
Purpose: clear the exact `FAIL` items from `pnpm launch:preflight` and make `DLV-002` executable.

## Current Fails To Clear
As of April 1, 2026, `pnpm launch:preflight` fails on:
- `ELEVENLABS_API_KEY` missing
- `UPSTASH_REDIS_REST_URL` missing
- `UPSTASH_REDIS_REST_TOKEN` missing
- `CRON_USERNAME` still using placeholder value
- `CRON_PASSWORD` still using placeholder value

These collapse into 3 work packets and 4 fail lines:
- Voice runtime secret
- Distributed rate limiting
- Cron credential rotation

## Ownership
- Platform lead: secret generation, env updates, final verification
- SRE / Infra: Upstash provisioning and production connectivity
- Agency operator: verify launch-target orgs after envs are live

## Rules
- The secret manager is the source of truth. Production hosting and local release-validation envs must match it.
- Do not validate against placeholder values.
- After each packet, rerun `pnpm launch:preflight`.
- After all packets are closed, rerun `pnpm status:delivery`.

## Packet 1: Voice Runtime Secret

### Owner
- Platform lead

### Exact Vars
- `ELEVENLABS_API_KEY`
- Optional but recommended: `ELEVENLABS_VOICE_ID`

### Why This Exists
- `scripts/launch-preflight.ts` hard-requires `ELEVENLABS_API_KEY`
- `src/app/api/grace/voice-chat/route.ts` uses ElevenLabs for TTS
- `src/lib/grace/providers/resolver.ts` falls back to `ELEVENLABS_API_KEY` when no org-level provider key is present

### How To Create It
1. Create or copy a production ElevenLabs API key from the ElevenLabs dashboard.
2. Store it in your secret manager under the exact key name `ELEVENLABS_API_KEY`.
3. If you want a fixed default voice, store `ELEVENLABS_VOICE_ID`; otherwise the app uses `21m00Tcm4TlvDq8ikWAM`.

### Where To Set It
- Production host environment variables
- Local release-validation env used to run `pnpm launch:preflight`

### Done When
- `pnpm launch:preflight` no longer reports `ElevenLabs API key` as `FAIL`

## Packet 2: Distributed Rate Limiting

### Owner
- SRE / Infra

### Exact Vars
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

### Why This Exists
- `scripts/launch-preflight.ts` fails when distributed rate limiting is absent
- `src/lib/rate-limiter.ts` rejects production traffic if Upstash is unavailable
- `src/lib/grace/channels/webhooks.ts` also depends on the same Upstash config

### How To Create It
1. Provision an Upstash Redis database for production.
2. Copy the REST URL into `UPSTASH_REDIS_REST_URL`.
3. Copy the REST token into `UPSTASH_REDIS_REST_TOKEN`.
4. Store both in the secret manager first, then in the production host.

### Where To Set It
- Production host environment variables
- Local release-validation env used to run `pnpm launch:preflight`

### Done When
- `pnpm launch:preflight` no longer reports `Distributed rate limiting` as `FAIL`

## Packet 3: Cron Credential Rotation

### Owner
- Platform lead

### Exact Vars
- `CRON_USERNAME`
- `CRON_PASSWORD`

### Why This Exists
- `scripts/launch-preflight.ts` fails on placeholder cron credentials
- `src/lib/auth/cronAuthRequired.ts` rejects production cron requests when placeholders are present
- Current protected route: `GET /api/cron/expire-credits`

### How To Create Them
Generate values that are unique to production and not guessable.

Recommended examples:
```bash
openssl rand -hex 8
openssl rand -base64 48
```

Use the outputs like this:
```bash
CRON_USERNAME=cron_prod_<random_hex>
CRON_PASSWORD=<base64_output>
```

Never use:
- `your_cron_username`
- `your_secure_password`
- `replace-me`

### Where To Set Them
- Production host environment variables
- The external cron caller that sends Basic Auth to `/api/cron/expire-credits`
- Local release-validation env used to run `pnpm launch:preflight`

### Done When
- `pnpm launch:preflight` no longer reports `Cron username strength` as `FAIL`
- `pnpm launch:preflight` no longer reports `Cron password strength` as `FAIL`
- The cron caller has been updated to use the new Basic Auth pair

## Recommended Sequence
1. Create all five required values in the secret manager first:
   - `ELEVENLABS_API_KEY`
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   - `CRON_USERNAME`
   - `CRON_PASSWORD`
2. Apply them to the production host.
3. Update the external cron caller with the new Basic Auth credentials.
4. Redeploy or restart the production app so the new envs are active.
5. Sync those same values into the local env used for release validation.
6. Run:
   - `pnpm launch:preflight`
   - `pnpm status:delivery`
7. Only after `launch:preflight` is clean, continue to `DLV-003` provider coverage work.

## Verification Commands
Run from repo root:

```bash
pnpm launch:preflight
pnpm status:delivery
```

Expected result:
- `launch:preflight` shows `0` `FAIL` items
- `status:delivery` moves from red to whatever remains after preflight, instead of failing on env setup

## Follow-On After DLV-002
Clearing this checklist does not finish launch readiness by itself. The next live item is:
- `DLV-003 Expand Provider Readiness Beyond One Org` in `docs/DELIVERY_BOARD.md`
