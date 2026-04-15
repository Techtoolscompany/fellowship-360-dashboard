export const PRIMARY_SMS_GATEWAY_PROVIDER = "fellowship_gateway";
export const LEGACY_SMS_GATEWAY_PROVIDER = "textbee";
export const SMS_GATEWAY_PROVIDER_ALIASES = [
  PRIMARY_SMS_GATEWAY_PROVIDER,
  LEGACY_SMS_GATEWAY_PROVIDER,
] as const;

export const SMS_GATEWAY_PROVIDER_LABEL = "Fellowship 360 Gateway";

export function isSmsGatewayProvider(provider: string | null | undefined) {
  if (!provider) return false;
  return SMS_GATEWAY_PROVIDER_ALIASES.includes(
    provider as (typeof SMS_GATEWAY_PROVIDER_ALIASES)[number]
  );
}

export function getSmsGatewayProviderCandidates(
  provider: string | null | undefined = PRIMARY_SMS_GATEWAY_PROVIDER
) {
  if (isSmsGatewayProvider(provider)) {
    return [...SMS_GATEWAY_PROVIDER_ALIASES];
  }

  return provider ? [provider] : [...SMS_GATEWAY_PROVIDER_ALIASES];
}

export function getSmsGatewayWebhookSecretEnv() {
  return (
    process.env.FELLOWSHIP_SMS_GATEWAY_WEBHOOK_SECRET?.trim() ||
    process.env.SMS_GATEWAY_WEBHOOK_SECRET?.trim() ||
    process.env.TEXTBEE_WEBHOOK_SECRET?.trim() ||
    null
  );
}

export function getSmsGatewayBaseUrlEnv() {
  return (
    process.env.FELLOWSHIP_SMS_GATEWAY_BASE_URL?.trim() ||
    process.env.SMS_GATEWAY_BASE_URL?.trim() ||
    process.env.TEXTBEE_BASE_URL?.trim() ||
    null
  );
}

export function getLegacySmsProviderApiKeyEnv() {
  return (
    process.env.FELLOWSHIP_SMS_GATEWAY_PROVIDER_API_KEY?.trim() ||
    process.env.TEXTBEE_API_KEY?.trim() ||
    null
  );
}
