export type VoteResult =
  | { ok: true; votes: number }
  | { ok: false; message: string }

export type VotingService = {
  vote: (serverId: string, turnstileToken: string) => Promise<VoteResult>
}

