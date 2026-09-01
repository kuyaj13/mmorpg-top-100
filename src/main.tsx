import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import RootPage from './RootPage.tsx'

if (window.location.hostname === 'www.mmorpgtop100.com') {
  window.location.replace(`https://mmorpgtop100.com${window.location.pathname}${window.location.search}${window.location.hash}`)
} else {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <RootPage />
    </StrictMode>,
  )
}
