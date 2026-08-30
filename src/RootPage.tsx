import App from './App'
import AdminPage from './admin/AdminPage'
import GamePage from './games/GamePage'
import AdvertisePage from './advertising/AdvertisePage'
import { siteConfig } from './config/site'

export default function RootPage() {
  const gameMatch = window.location.pathname.match(/^\/games\/([^/]+)\/?$/)
  if (window.location.pathname === '/admin') return <AdminPage />
  if (window.location.pathname === '/advertise' && siteConfig.advertisingWorkspaceEnabled) return <AdvertisePage />
  if (gameMatch) return <GamePage slug={decodeURIComponent(gameMatch[1])} />
  return <App />
}
