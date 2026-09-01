import App from './App'
import AdminPage from './admin/AdminPage'
import GamePage from './games/GamePage'
import AdvertisePage from './advertising/AdvertisePage'
import { siteConfig } from './config/site'

export default function RootPage() {
  const gameMatch = window.location.pathname.match(/^\/games\/([^/]+)\/?$/)
  if (window.location.pathname === '/admin' && siteConfig.adminWorkspaceEnabled) return <AdminPage />
  if (window.location.pathname === '/admin') {
    return (
      <main className="admin-shell">
        <a href="/">Back to rankings</a>
        <h1>Moderation is not available yet</h1>
        <p>The administrator workspace will open after its launch security review is complete.</p>
      </main>
    )
  }
  if (window.location.pathname === '/advertise' && siteConfig.advertisingWorkspaceEnabled) return <AdvertisePage />
  if (gameMatch) return <GamePage slug={decodeURIComponent(gameMatch[1])} />
  return <App />
}
