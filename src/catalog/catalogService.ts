import { sampleServers } from './sampleServers'
import type { CatalogService, Server } from './types'

function copyServer(server: Server): Server {
  return { ...server }
}

export const catalogService: CatalogService = {
  async listServers(gameSlug) {
    return sampleServers
      .filter((server) => gameSlug === undefined || server.gameSlug === gameSlug)
      .map(copyServer)
  },
}
