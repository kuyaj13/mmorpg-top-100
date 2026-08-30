import { sampleServers } from './sampleServers'
import type { VotingService } from './types'

const voteCounts = new Map(sampleServers.map((server) => [server.id, server.votes]))
const votedServerIds = new Set<string>()

export const votingService: VotingService = {
  async voteForServer(serverId) {
    const currentVotes = voteCounts.get(serverId)

    if (currentVotes === undefined) {
      return { ok: false, message: 'This server is not available for voting.' }
    }

    if (votedServerIds.has(serverId)) {
      return { ok: false, message: 'You have already voted for this server.' }
    }

    const votes = currentVotes + 1
    voteCounts.set(serverId, votes)
    votedServerIds.add(serverId)

    return { ok: true, votes }
  },
}
