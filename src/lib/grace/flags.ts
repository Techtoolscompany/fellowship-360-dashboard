export const graceFlags = {
  enabled: process.env.GRACE_ENABLED !== "false",
  publicChannelsEnabled: process.env.GRACE_PUBLIC_CHANNELS_ENABLED !== "false",
  copilotEnabled: process.env.GRACE_COPILOT_ENABLED !== "false",
};
