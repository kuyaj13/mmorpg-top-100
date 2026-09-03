import { useEffect, useRef, useState } from 'react'
import { exclusiveServersService as productionService } from './bannerServices'
import type { ExclusiveServerAd, ExclusiveServersService } from './bannerTypes'

const rotationMilliseconds = 15_000

export function ExclusiveServers({ gameSlug, gameName, service = productionService }: { gameSlug: string; gameName: string; service?: ExclusiveServersService }) {
  const [ads, setAds] = useState<ExclusiveServerAd[]>([])
  const [index, setIndex] = useState(0)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [paused, setPaused] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    const controller = new AbortController(); let active = true
    service.list(gameSlug, controller.signal).then((items) => {
      if (!active) return
      setAds(items); setIndex(items.length ? Math.floor(Date.now() / rotationMilliseconds) % items.length : 0); setStatus('ready')
    }, () => { if (active) setStatus('error') })
    return () => { active = false; controller.abort() }
  }, [gameSlug, service])
  useEffect(() => {
    const visibility = () => setPaused(document.hidden)
    document.addEventListener('visibilitychange', visibility)
    return () => document.removeEventListener('visibilitychange', visibility)
  }, [])
  useEffect(() => {
    if (ads.length < 2 || paused || reducedMotion) return
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % ads.length), rotationMilliseconds)
    return () => window.clearInterval(timer)
  }, [ads.length, paused, reducedMotion])

  const show = (offset: number) => setIndex((current) => (current + offset + ads.length) % ads.length)
  const ad = ads[index]
  return <section ref={sectionRef} className="exclusive-servers" aria-labelledby={`exclusive-heading-${gameSlug}`} onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false) }}>
    <p className="eyebrow">Advertisement</p><h2 id={`exclusive-heading-${gameSlug}`}>Exclusive {gameName} servers</h2>
    {status === 'loading' && <p role="status">Loading sponsored servers…</p>}
    {status === 'error' && <p role="status">Sponsored servers are unavailable right now.</p>}
    {status === 'ready' && !ad && <p role="status">There are no active sponsored servers for this game.</p>}
    {ad && <div className="exclusive-banner">
      <a href={ad.website} target="_blank" rel="noopener noreferrer sponsored external" aria-label={`${ad.serverName}, Sponsored — opens in a new tab`}>
        <picture><source media="(prefers-reduced-motion: reduce)" srcSet={ad.staticBannerUrl} /><img src={reducedMotion ? ad.staticBannerUrl : ad.bannerUrl} alt={ad.altText} width="468" height="60" /></picture>
      </a>
      <p aria-live="polite" aria-atomic="true">Sponsored server {index + 1} of {ads.length}: {ad.serverName}</p>
      {ads.length > 1 && <div className="exclusive-controls"><button type="button" onClick={() => show(-1)} aria-label="Show previous sponsored server">Previous</button><button type="button" onClick={() => show(1)} aria-label="Show next sponsored server">Next</button></div>}
    </div>}
  </section>
}
