export const siteConfig = {
  paypalDonationUrl: 'https://www.paypal.com/paypalme/VivaMU',
  votingEnabled: import.meta.env.VITE_VOTING_ENABLED === 'true' && Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY),
  submissionsEnabled: import.meta.env.VITE_SUBMISSIONS_ENABLED === 'true' && Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY),
  adminWorkspaceEnabled: import.meta.env.VITE_ADMIN_ENABLED === 'true',
  advertisingWorkspaceEnabled: false,
  bannerModerationEnabled: import.meta.env.VITE_BANNER_MODERATION_ENABLED === 'true',
  bannerUploadsEnabled: import.meta.env.VITE_BANNER_UPLOADS_ENABLED === 'true' && Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY),
  exclusiveAdvertisersPerGame: 3,
} as const
