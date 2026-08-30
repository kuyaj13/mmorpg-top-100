import { GoogleAuth } from 'google-auth-library'

const [domain] = process.argv.slice(2)
const projectId = process.env.GCLOUD_PROJECT

if (!domain || !projectId) {
  console.error('A domain and Firebase project are required.')
  process.exit(1)
}

const auth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/firebase.hosting'],
})
const client = await auth.getClient()
const parent = `projects/${projectId}/sites/${projectId}`
const url = `https://firebasehosting.googleapis.com/v1beta1/${parent}/customDomains?customDomainId=${encodeURIComponent(domain)}`

try {
  const response = await client.request({
    url,
    method: 'POST',
    data: {},
  })
  console.log(JSON.stringify(response.data, null, 2))
} catch (error) {
  if (error?.response?.status === 409) {
    const existing = await client.request({ url: `${url.split('?')[0]}/${encodeURIComponent(domain)}` })
    console.log(JSON.stringify(existing.data, null, 2))
  } else {
    throw error
  }
}
