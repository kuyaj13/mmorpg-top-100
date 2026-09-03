import type { EligibleServer } from './types'

export type BannerUploadInput = {
  serverId: string
  altText: string
  file: File
}

export type BannerUploadResult = { ok: true; message: string } | { ok: false; message: string }

export type BannerUploadService = {
  upload(input: BannerUploadInput): Promise<BannerUploadResult>
}

export type ExclusiveServerAd = {
  id: string
  serverId: string
  gameSlug: string
  serverName: string
  website: string
  bannerUrl: string
  staticBannerUrl: string
  altText: string
}

export type ExclusiveServersService = {
  list(gameSlug: string, signal?: AbortSignal): Promise<ExclusiveServerAd[]>
}

export type BannerUploadFormProps = {
  servers: EligibleServer[]
  service?: BannerUploadService
}

