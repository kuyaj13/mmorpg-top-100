import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import type { ListingInput, ManagedServer, OwnerBannerWorkspaceService } from './bannerTypes'

type Field = keyof ListingInput
type Errors = Partial<Record<Field, string>>

type Props = {
  servers: ManagedServer[]
  service: OwnerBannerWorkspaceService
  onChanged: () => void
}

export function ListingManager({ servers, service, onChanged }: Props) {
  const [editing, setEditing] = useState<ManagedServer | null>(null)
  const [removing, setRemoving] = useState<ManagedServer | null>(null)
  const [pending, setPending] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const removalTriggerRef = useRef<HTMLButtonElement | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  function closeRemoval() {
    setRemoving(null)
    requestAnimationFrame(() => removalTriggerRef.current?.focus())
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing) return

    const data = new FormData(event.currentTarget)
    const input: ListingInput = {
      name: String(data.get('name') ?? '').trim(),
      website: String(data.get('website') ?? '').trim(),
      gameVersion: String(data.get('gameVersion') ?? '').trim(),
      region: String(data.get('region') ?? '').trim(),
      mode: String(data.get('mode') ?? '') as ListingInput['mode'],
      description: String(data.get('description') ?? '').trim(),
    }
    const nextErrors: Errors = {}

    if (input.name.length < 2 || input.name.length > 80) nextErrors.name = 'Enter a server name between 2 and 80 characters.'
    try {
      const website = new URL(input.website)
      if (website.protocol !== 'https:' || website.username || website.password || website.hash) throw new Error()
    } catch {
      nextErrors.website = 'Enter a secure server website beginning with https://.'
    }
    if (!input.gameVersion || input.gameVersion.length > 60) nextErrors.gameVersion = 'Enter the game version.'
    if (!input.region || input.region.length > 60) nextErrors.region = 'Enter the server region.'
    if (!['PvE', 'PvP', 'RPG'].includes(input.mode)) nextErrors.mode = 'Select a server mode.'
    if (input.description.length < 20 || input.description.length > 1000) nextErrors.description = 'Enter a description between 20 and 1,000 characters.'

    setErrors(nextErrors)
    setFeedback('')
    const firstInvalidField = Object.keys(nextErrors)[0] as Field | undefined
    if (firstInvalidField) {
      formRef.current?.querySelector<HTMLElement>(`[name="${firstInvalidField}"]`)?.focus()
      return
    }

    setPending(true)
    const result = await service.updateServer(editing.id, input)
    setPending(false)
    setFeedback(result.message)
    if (result.ok) {
      setEditing(null)
      onChanged()
    }
  }

  async function remove() {
    if (!removing) return
    setPending(true)
    const result = await service.removeServer(removing.id)
    setPending(false)
    setFeedback(result.message)
    if (result.ok) {
      setRemoving(null)
      onChanged()
    }
  }

  function field(name: Field, label: string, control: ReactNode) {
    return (
      <label htmlFor={`listing-${name}`}>
        {label}
        {control}
        {errors[name] && <span id={`listing-${name}-error`} className="field-error">{errors[name]}</span>}
      </label>
    )
  }

  return (
    <section className="listing-manager" aria-labelledby="listing-manager-heading">
      <h2 id="listing-manager-heading">Manage server listings</h2>
      <p>Changes require administrator review. Your current listing stays live while a change is pending.</p>
      {servers.length === 0 ? <p>You do not have an active server listing.</p> : (
        <ul>{servers.map((server) => (
          <li key={server.id}>
            <div><strong>{server.name}</strong> &mdash; {server.gameName}{' '}{server.hasPendingChange && <span className="claim-status pending">Changes pending review</span>}</div>
            <div className="advertiser-auth-actions">
              <button type="button" disabled={pending || server.hasPendingChange} onClick={() => { setErrors({}); setFeedback(''); setEditing(server) }}>Edit listing</button>
              <button type="button" disabled={pending} onClick={(event) => { removalTriggerRef.current = event.currentTarget; setFeedback(''); setRemoving(server) }}>Remove listing</button>
            </div>
          </li>
        ))}</ul>
      )}

      {editing && (
        <form ref={formRef} onSubmit={save} noValidate>
          <h3>Edit {editing.name}</h3>
          {field('name', 'Server name', <input id="listing-name" name="name" defaultValue={editing.name} maxLength={80} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'listing-name-error' : undefined} />)}
          {field('website', 'Website', <input id="listing-website" name="website" type="url" defaultValue={editing.website} aria-invalid={Boolean(errors.website)} aria-describedby={errors.website ? 'listing-website-error' : undefined} />)}
          {field('gameVersion', 'Game version', <input id="listing-gameVersion" name="gameVersion" defaultValue={editing.gameVersion} maxLength={60} aria-invalid={Boolean(errors.gameVersion)} aria-describedby={errors.gameVersion ? 'listing-gameVersion-error' : undefined} />)}
          {field('region', 'Region', <input id="listing-region" name="region" defaultValue={editing.region} maxLength={60} aria-invalid={Boolean(errors.region)} aria-describedby={errors.region ? 'listing-region-error' : undefined} />)}
          {field('mode', 'Mode', <select id="listing-mode" name="mode" defaultValue={editing.mode} aria-invalid={Boolean(errors.mode)} aria-describedby={errors.mode ? 'listing-mode-error' : undefined}><option value="PvE">PvE</option><option value="PvP">PvP</option><option value="RPG">RPG</option></select>)}
          {field('description', 'Description', <textarea id="listing-description" name="description" defaultValue={editing.description} maxLength={1000} aria-invalid={Boolean(errors.description)} aria-describedby={errors.description ? 'listing-description-error' : undefined} />)}
          <div className="advertiser-auth-actions">
            <button type="button" onClick={() => setEditing(null)}>Cancel</button>
            <button disabled={pending}>{pending ? 'Submitting...' : 'Submit changes for review'}</button>
          </div>
        </form>
      )}

      {removing && (
        <div role="alertdialog" aria-modal="true" aria-labelledby="remove-listing-heading" aria-describedby="remove-listing-description" onKeyDown={(event) => {
          if (event.key === 'Escape') { event.preventDefault(); closeRemoval() }
        }}>
          <h3 id="remove-listing-heading">Remove {removing.name}?</h3>
          <p id="remove-listing-description">This immediately removes it from rankings and advertising. Votes and history are retained.</p>
          <div className="advertiser-auth-actions">
            <button type="button" onClick={closeRemoval}>Cancel</button>
            <button type="button" autoFocus disabled={pending} onClick={() => void remove()}>{pending ? 'Removing...' : 'Confirm removal'}</button>
          </div>
        </div>
      )}
      {feedback && <p role="status">{feedback}</p>}
    </section>
  )
}
