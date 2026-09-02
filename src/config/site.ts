export const siteConfig = {
  paypalDonationUrl: 'https://www.paypal.com/paypalme/VivaMU',
  votingEnabled: import.meta.env.VITE_VOTING_ENABLED === 'true' && Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY),
  submissionsEnabled: false,
  adminWorkspaceEnabled: false,
  advertisingWorkspaceEnabled: false,
  exclusiveAdvertisersPerGame: 3,
} as const
