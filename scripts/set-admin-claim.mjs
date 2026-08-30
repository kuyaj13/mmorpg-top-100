import { applicationDefault, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

const [email] = process.argv.slice(2)

if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
  console.error('Usage: npm run admin:grant -- user@example.com')
  process.exit(1)
}

const projectId = process.env.GCLOUD_PROJECT
if (!projectId) {
  console.error('GCLOUD_PROJECT must identify the Firebase project.')
  process.exit(1)
}

initializeApp({ credential: applicationDefault(), projectId })

const auth = getAuth()
const user = await auth.getUserByEmail(email)
await auth.setCustomUserClaims(user.uid, { ...user.customClaims, admin: true })

const verifiedUser = await auth.getUser(user.uid)
if (verifiedUser.customClaims?.admin !== true) {
  throw new Error('The administrator role could not be verified.')
}

console.log(`Administrator role granted to ${verifiedUser.email}.`)
