export type Server = {
  id: string
  gameSlug: string
  name: string
  players: number
  votes: number
  region: string
  mode: 'PvE' | 'PvP' | 'RPG'
  rating: number
  description: string
  status: 'Live' | 'Stable'
  trend: string
}

export type CatalogService = {
  listServers: (gameSlug?: string) => Promise<Server[]>
}

export type VoteResult =
  | { ok: true; votes: number }
  | { ok: false; message: string }

export type VotingService = {
  voteForServer: (serverId: string) => Promise<VoteResult>
}
