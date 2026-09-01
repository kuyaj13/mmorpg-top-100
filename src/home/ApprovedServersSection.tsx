import { useEffect, useState } from 'react'
import { approvedServersService as defaultService } from './approvedServersService'
import type { ApprovedServer, ApprovedServersService } from './approvedServersService'

export default function ApprovedServersSection({ service = defaultService }: { service?: ApprovedServersService }) {
  const [servers, setServers] = useState<ApprovedServer[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    service.list(controller.signal).then(
      (items) => { if (active) { setServers(items); setStatus('ready') } },
      () => { if (active) setStatus('error') },
    )
    return () => { active = false; controller.abort() }
  }, [service])

  return <section id="rankings" className="rankings-section" aria-labelledby="approved-servers-heading">
    <div className="section-heading"><div><p className="eyebrow">Live directory</p><h2 id="approved-servers-heading">Approved private servers</h2><p>Browse verified listings by game. Rankings remain independent within each game.</p></div></div>
    {status === 'loading' && <p role="status">Loading approved servers...</p>}
    {status === 'error' && <p role="alert">Approved servers are unavailable right now. Please try again later.</p>}
    {status === 'ready' && servers.length === 0 && <p role="status">There are no approved servers yet.</p>}
    {status === 'ready' && servers.length > 0 && <ul className="approved-server-list">
      {servers.map((server) => <li key={server.id}>
        <div><h3>{server.name}</h3><p>{server.game.name}</p></div>
        <strong>{server.votes.toLocaleString()} votes</strong>
        <a href={`/games/${server.game.slug}`}>View ranking<span className="visually-hidden"> for {server.name}</span></a>
      </li>)}
    </ul>}
  </section>
}
