import { applicationDefault, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

const [email] = process.argv.slice(2)
const projectId = process.env.GCLOUD_PROJECT

if (!email || !projectId) {
  console.error('An email address and Firebase project are required.')
  process.exit(1)
}

initializeApp({ credential: applicationDefault(), projectId })

const auth = getAuth()
const user = await auth.getUserByEmail(email)

if (user.emailVerified) {
  console.log('ALREADY_VERIFIED')
  process.exit(0)
}

const link = await auth.generateEmailVerificationLink(email, {
  url: 'https://mmorpg-top-100.web.app/admin',
})

console.log(link)
