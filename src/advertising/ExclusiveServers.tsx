import { useEffect, useRef, useState } from 'react'
import { exclusiveServersService as productionService } from './bannerServices'
import type { ExclusiveServerAd, ExclusiveServersService } from './bannerTypes'

const rotationMilliseconds = 15_000
const eligibilityRefreshMilliseconds = 60_000

export function ExclusiveServers({ gameSlug, gameName, service = productionService }: { gameSlug: string; gameName: string; service?: ExclusiveServersService }) {
  const [ads, setAds] = useState<ExclusiveServerAd[]>([])
  const [index, setIndex] = useState(0)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [userPaused, setUserPaused] = useState(false)
  const [interactionPaused, setInteractionPaused] = useState(false)
  const [pageHidden, setPageHidden] = useState(document.hidden)
  const [announcement, setAnnouncement] = useState('')
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    const visibility = () => setPageHidden(document.hidden)
    document.addEventListener('visibilitychange', visibility)
    return () => document.removeEventListener('visibilitychange', visibility)
  }, [])
  useEffect(() => {
    if (pageHidden) return
    let active = true
    let controller: AbortController | null = null
    const load = () => {
      controller?.abort()
      controller = new AbortController()
      service.list(gameSlug, controller.signal).then((items) => {
        if (!active) return
        setAds(items); setIndex(items.length ? Math.floor(Date.now() / rotationMilliseconds) % items.length : 0); setStatus('ready')
      }, () => { if (active) { setAds([]); setStatus('error') } })
    }
    load()
    const timer = window.setInterval(load, eligibilityRefreshMilliseconds)
    return () => { active = false; controller?.abort(); window.clearInterval(timer) }
  }, [gameSlug, pageHidden, service])
  useEffect(() => {
    if (ads.length < 2 || userPaused || interactionPaused || pageHidden || reducedMotion) return
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % ads.length), rotationMilliseconds)
    return () => window.clearInterval(timer)
  }, [ads.length, userPaused, interactionPaused, pageHidden, reducedMotion])
  useEffect(() => {
    if (!ads.length) return
    const nearestExpiry = Math.min(...ads.map((item) => Date.parse(item.expiresAt)))
    const delay = Math.min(Math.max(nearestExpiry - Date.now(), 0), 2_147_000_000)
    const timer = window.setTimeout(() => {
      const now = Date.now()
      setAds((current) => current.filter((item) => Date.parse(item.expiresAt) > now))
    }, delay)
    return () => window.clearTimeout(timer)
  }, [ads])

  const show = (offset: number) => {const next=(index+offset+ads.length)%ads.length;setIndex(next);setAnnouncement(`Sponsored server ${next+1} of ${ads.length}: ${ads[next].serverName}`)}
  const safeIndex = ads.length ? index % ads.length : 0
  const ad = ads[safeIndex]
  return <section ref={sectionRef} className="exclusive-servers" aria-labelledby={`exclusive-heading-${gameSlug}`} onPointerEnter={() => setInteractionPaused(true)} onPointerLeave={() => setInteractionPaused(false)} onFocus={() => setInteractionPaused(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setInteractionPaused(false) }}>
    <p className="eyebrow">Advertisement</p><h2 id={`exclusive-heading-${gameSlug}`}>Exclusive {gameName} servers</h2>
    {status === 'loading' && <p role="status">Loading sponsored servers…</p>}
    {status === 'error' && <p role="status">Sponsored servers are unavailable right now.</p>}
    {status === 'ready' && !ad && <p role="status">There are no active sponsored servers for this game.</p>}
    {ad && <div className="exclusive-banner">
      <a href={ad.website} target="_blank" rel="noopener noreferrer sponsored external" aria-label={`${ad.serverName}, Sponsored — opens in a new tab`}>
        <picture><source media="(prefers-reduced-motion: reduce)" srcSet={ad.staticBannerUrl} /><img src={reducedMotion ? ad.staticBannerUrl : ad.bannerUrl} alt={ad.altText} width="936" height="120" /></picture>
      </a>
      {ads.length > 1 && <p>Sponsored server {safeIndex + 1} of {ads.length}: {ad.serverName}</p>}
      <span className="visually-hidden" role="status" aria-atomic="true">{announcement}</span>
      {ads.length > 1 && <div className="exclusive-controls"><button type="button" onClick={() => show(-1)} aria-label="Show previous sponsored server">Previous</button>{!reducedMotion && <button type="button" onClick={() => setUserPaused((current) => !current)} aria-pressed={userPaused}>{userPaused ? 'Resume rotation' : 'Pause rotation'}</button>}<button type="button" onClick={() => show(1)} aria-label="Show next sponsored server">Next</button></div>}
    </div>}
  </section>
}
