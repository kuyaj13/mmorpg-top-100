export type EligibleServer = {
  id: string
  name: string
  gameName: string
  gameSlug: string
}

export type AdPackageOption = {
  code: string
  durationDays: 7 | 30
  tier: string
  priceMinor: string
  currency: string
}

export type DonationClaimSummary = {
  id: string
  serverName: string
  gameName: string
  durationDays: number
  status: 'pending' | 'verified' | 'rejected'
  createdAt: string
  rejectionReason?: string
}

export type AdvertisingWorkspace = {
  servers: EligibleServer[]
  packages: AdPackageOption[]
  claims: DonationClaimSummary[]
}

export type AdvertiserAuthService = {
  currentStatus: () => Promise<'signed-out' | 'verify-email' | 'ready'>
  signIn: (email: string, password: string) => Promise<'verify-email' | 'ready'>
  register: (email: string, password: string) => Promise<'verify-email'>
  sendVerification: () => Promise<void>
  refreshVerification: () => Promise<boolean>
  signOut: () => Promise<void>
}

export type AdvertisingService = {
  loadWorkspace: () => Promise<AdvertisingWorkspace>
  createClaim: (input: { serverId: string; packageCode: string; donorReference: string; turnstileToken: string }) => Promise<{
    ok: boolean
    message: string
  }>
}
