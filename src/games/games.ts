export type GameType = 'MMORPG' | 'STRATEGY' | 'RPG' | 'GENERAL' | 'FPS' | 'CONSOLE'

export type Game = {
  slug: string
  name: string
  type: GameType
}

const mmorpg = (slug: string, name: string): Game => ({ slug, name, type: 'MMORPG' })
const strategy = (slug: string, name: string): Game => ({ slug, name, type: 'STRATEGY' })
const rpg = (slug: string, name: string): Game => ({ slug, name, type: 'RPG' })
const general = (slug: string, name: string): Game => ({ slug, name, type: 'GENERAL' })
const fps = (slug: string, name: string): Game => ({ slug, name, type: 'FPS' })
const consolePlatform = (slug: string, name: string): Game => ({ slug, name, type: 'CONSOLE' })

export const games: Game[] = [
  mmorpg('ace-online', 'Ace Online'),
  mmorpg('aion', 'Aion'),
  mmorpg('allods-online', 'Allods Online'),
  mmorpg('battle-of-the-immortals', 'Battle of the Immortals'),
  mmorpg('cabal-online', 'CABAL Online'),
  mmorpg('conquer-online', 'Conquer Online'),
  mmorpg('dark-age-of-camelot', 'Dark Age of Camelot'),
  mmorpg('dekaron', 'Dekaron'),
  mmorpg('dragon-nest', 'Dragon Nest'),
  mmorpg('dragonica-online', 'Dragonica Online'),
  mmorpg('ether-saga-odyssey', 'Ether Saga Odyssey'),
  mmorpg('eudemons-online', 'Eudemons Online'),
  mmorpg('everquest', 'EverQuest'),
  mmorpg('final-fantasy', 'Final Fantasy'),
  mmorpg('flyff', 'Flyff'),
  mmorpg('forsaken-world', 'Forsaken World'),
  mmorpg('grand-chase', 'Grand Chase'),
  mmorpg('guild-wars', 'Guild Wars'),
  mmorpg('gunbound', 'GunBound'),
  mmorpg('hellbreath', 'Helbreath'),
  mmorpg('heroes-of-three-kingdoms', 'Heroes of Three Kingdoms'),
  mmorpg('iris-online', 'Iris Online'),
  mmorpg('jade-dynasty', 'Jade Dynasty'),
  mmorpg('kal-online', 'KAL Online'),
  mmorpg('knight-online', 'Knight Online'),
  mmorpg('last-chaos', 'Last Chaos'),
  mmorpg('legend-of-mir', 'Legend of Mir'),
  mmorpg('lineage-ii', 'Lineage II'),
  mmorpg('loong-online', 'Loong Online'),
  mmorpg('luna-online', 'Luna Online'),
  mmorpg('lunia', 'Lunia'),
  mmorpg('maple-story', 'MapleStory'),
  mmorpg('the-matrix-online', 'The Matrix Online'),
  mmorpg('metin2', 'Metin2'),
  mmorpg('minecraft', 'Minecraft'),
  mmorpg('mmorpg-and-mpog', 'MMORPG & MPOG'),
  mmorpg('mu-online', 'MU Online'),
  mmorpg('the-myth-of-soma', 'The Myth of Soma'),
  mmorpg('neverwinter', 'Neverwinter'),
  mmorpg('perfect-world', 'Perfect World'),
  mmorpg('pirate-king-online', 'Pirate King Online'),
  mmorpg('priston-tale', 'Priston Tale'),
  mmorpg('ragnarok-online', 'Ragnarok Online'),
  mmorpg('raiderz', 'RaiderZ'),
  mmorpg('ran-online', 'RAN Online'),
  mmorpg('rappelz', 'Rappelz'),
  mmorpg('redmoon', 'RedMoon'),
  mmorpg('rf-online', 'RF Online'),
  mmorpg('risk-your-life', 'Risk Your Life'),
  mmorpg('rohan-blood-feud', 'Rohan: Blood Feud'),
  mmorpg('rose-online', 'ROSE Online'),
  mmorpg('runescape', 'RuneScape'),
  mmorpg('rusty-hearts', 'Rusty Hearts'),
  mmorpg('seal-online', 'Seal Online'),
  mmorpg('shaiya', 'Shaiya'),
  mmorpg('silkroad-online', 'Silkroad Online'),
  mmorpg('star-wars-galaxies', 'Star Wars Galaxies'),
  mmorpg('swordsman-online', 'Swordsman Online'),
  mmorpg('tales-of-pirates', 'Tales of Pirates'),
  mmorpg('ultima-online', 'Ultima Online'),
  mmorpg('war-of-the-immortals', 'War of the Immortals'),
  mmorpg('world-of-kung-fu', 'World of Kung Fu'),
  mmorpg('world-of-warcraft', 'World of Warcraft'),
  strategy('command-and-conquer', 'Command & Conquer'),
  strategy('starcraft', 'StarCraft'),
  strategy('warcraft', 'Warcraft'),
  rpg('diablo', 'Diablo'),
  general('anime-websites', 'Anime Websites'),
  general('gaming-websites', 'Gaming Websites'),
  general('grand-theft-auto', 'Grand Theft Auto'),
  general('io-games', '.io Games'),
  general('the-sims', 'The Sims'),
  fps('battlefield', 'Battlefield'),
  fps('call-of-duty', 'Call of Duty'),
  fps('counter-strike', 'Counter-Strike'),
  fps('doom', 'DOOM'),
  fps('far-cry', 'Far Cry'),
  fps('half-life', 'Half-Life'),
  fps('unreal-tournament', 'Unreal Tournament'),
  consolePlatform('nintendo', 'Nintendo'),
  consolePlatform('playstation', 'PlayStation'),
  consolePlatform('xbox', 'Xbox'),
]

export function findGameBySlug(slug: string) {
  return games.find((game) => game.slug === slug)
}
