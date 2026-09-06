import { games } from '../games/games.js'

const origin = 'https://mmorpgtop100.com'

export function createSitemap() {
  const paths = ['/', '/submit', ...games.map((game) => `/games/${game.slug}`)]
  const urls = paths.map((path) => `  <url><loc>${origin}${path}</loc></url>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}
