import type { ModerationItem } from '../admin/types'
import type { ServerSubmission } from './types'

const submissions: ModerationItem[] = []

export function addPendingSubmission(submission: ServerSubmission) {
  const item: ModerationItem = {
    ...submission,
    id: `preview-${submissions.length + 1}`,
    submittedAt: new Date().toISOString(),
    status: 'pending',
  }
  submissions.push(item)
  return { ...item }
}

export function listPendingSubmissions() {
  return submissions.filter((item) => item.status === 'pending').map((item) => ({ ...item }))
}

export function moderateSubmission(id: string, decision: 'approve' | 'reject') {
  const item = submissions.find((submission) => submission.id === id && submission.status === 'pending')
  if (!item) return false
  item.status = decision === 'approve' ? 'approved' : 'rejected'
  return true
}
