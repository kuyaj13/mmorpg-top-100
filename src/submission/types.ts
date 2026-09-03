import type { Server } from '../catalog/types'

export type ServerSubmission = {
  name: string
  website: string
  gameVersion: string
  region: string
  mode: Server['mode']
  description: string
}

export type SubmissionResult =
  | { ok: true; reference: string }
  | { ok: false; message: string }

export type SubmissionService = {
  submitServer: (submission: ServerSubmission) => Promise<SubmissionResult>
}

export type ProtectedServerSubmission = ServerSubmission & {
  gameSlug: string
  turnstileToken: string
}

export type ProtectedSubmissionService = {
  submit: (submission: ProtectedServerSubmission) => Promise<SubmissionResult>
}
