import { useCallback, useRef, useState } from 'react'
import { PlayerAuthPanel } from './PlayerAuthPanel'
import { TurnstileWidget, type TurnstileWidgetHandle } from './TurnstileWidget'
import { votingService as productionVotingService } from './votingService'
import type { PlayerAuthService, PlayerAuthStatus } from './playerAuthService'
import type { VotingService } from './types'

export function VotePanel({ serverId, serverName, onVoteRecorded, service = productionVotingService, authService, turnstileSiteKey }: {
  serverId: string; serverName: string; onVoteRecorded: (votes: number) => void; service?: VotingService; authService?: PlayerAuthService; turnstileSiteKey?: string
}) {
  const [token, setToken] = useState('')
  const [pending, setPending] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [authStatus, setAuthStatus] = useState<PlayerAuthStatus>('signed-out')
  const resultRef = useRef<HTMLParagraphElement>(null)
  const widgetRef = useRef<TurnstileWidgetHandle>(null)
  const receiveToken = useCallback((value: string) => setToken(value), [])
  const receiveAuthStatus = useCallback((status: PlayerAuthStatus) => setAuthStatus(status), [])
  async function vote() {
    if (!token || pending) return
    setPending(true); setFeedback('')
    const result = await service.vote(serverId, token)
    setPending(false); widgetRef.current?.reset()
    if (result.ok) { onVoteRecorded(result.votes); setFeedback(`Your vote was recorded. ${serverName} now has ${result.votes.toLocaleString()} votes.`) }
    else setFeedback(result.message)
    requestAnimationFrame(() => resultRef.current?.focus())
  }
  return <section className="vote-panel" aria-labelledby={`vote-heading-${serverId}`}>
    <h3 id={`vote-heading-${serverId}`}>Vote for {serverName}</h3><p>Verified players may vote once per server each UTC day.</p>
    <PlayerAuthPanel service={authService} onStatusChange={receiveAuthStatus} />
    {authStatus === 'ready' && <><TurnstileWidget onToken={receiveToken} resetRef={widgetRef} siteKey={turnstileSiteKey} /><button className="vote-button" type="button" onClick={() => void vote()} disabled={!token || pending}>{pending ? 'Recording vote...' : `Vote for ${serverName}`}</button></>}
    {feedback && <p ref={resultRef} tabIndex={-1} role="status">{feedback}</p>}
  </section>
}
