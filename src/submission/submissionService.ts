import type { ServerSubmission, SubmissionService } from './types'
import { addPendingSubmission } from './submissionStore'

const pendingWebsites = new Set<string>()

function normalizeWebsite(website: string) {
  const url = new URL(website)
  url.hash = ''
  return url.toString().toLowerCase()
}

export const submissionService: SubmissionService = {
  async submitServer(submission: ServerSubmission) {
    const website = normalizeWebsite(submission.website)

    if (pendingWebsites.has(website)) {
      return { ok: false, message: 'This server is already pending review.' }
    }

    pendingWebsites.add(website)
    const pendingSubmission = addPendingSubmission(submission)

    return {
      ok: true,
      reference: pendingSubmission.id,
    }
  },
}
