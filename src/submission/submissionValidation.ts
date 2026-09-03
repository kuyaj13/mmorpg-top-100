import { games } from '../games/games'
import type { ProtectedServerSubmission } from './types'

type FieldName = keyof ProtectedServerSubmission
export type SubmissionErrors = Partial<Record<FieldName, string>>

export function validateSubmission(value: ProtectedServerSubmission): SubmissionErrors {
  const errors: SubmissionErrors = {}
  if (value.name.length < 2 || value.name.length > 80) errors.name = 'Enter a server name between 2 and 80 characters.'
  try { if (new URL(value.website).protocol !== 'https:') errors.website = 'Enter a secure server website beginning with https://.' } catch { errors.website = 'Please enter a valid server URL.' }
  if (!games.some((game) => game.slug === value.gameSlug)) errors.gameSlug = 'Select a supported game.'
  if (!value.gameVersion || value.gameVersion.length > 60) errors.gameVersion = 'Enter the game version.'
  if (!value.region || value.region.length > 60) errors.region = 'Enter the server region.'
  if (!['PvE', 'PvP', 'RPG'].includes(value.mode)) errors.mode = 'Select a server mode.'
  if (value.description.length < 20 || value.description.length > 1000) errors.description = 'Enter a description between 20 and 1,000 characters.'
  if (!value.turnstileToken) errors.turnstileToken = 'Complete the security check.'
  return errors
}
