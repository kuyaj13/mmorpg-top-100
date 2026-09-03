import { render,screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OwnerBannerPage from './OwnerBannerPage'

const authService = {
  currentStatus: () => Promise.resolve('ready' as const),
  signIn: () => Promise.resolve('ready' as const),
  register: () => Promise.resolve('verify-email' as const),
  sendVerification: () => Promise.resolve(),
  refreshVerification: () => Promise.resolve(true),
  signOut: () => Promise.resolve(),
}

it('shows only approved servers returned by the protected owner workspace', async () => {
  render(<OwnerBannerPage authService={authService} workspaceService={{ listServers: () => Promise.resolve([{ id:'server-1',name:'Flyff One',gameName:'Flyff',gameSlug:'flyff' }]) }}/>)
  expect(await screen.findByRole('heading',{name:'Upload a server banner'})).toBeInTheDocument()
  expect(screen.getByRole('option',{name:'Flyff One — Flyff'})).toBeInTheDocument()
  expect(screen.queryByText(/PayPal transaction reference/i)).not.toBeInTheDocument()
})

it('shows a plain failure state without exposing implementation details', async () => {
  const user = userEvent.setup()
  const listServers = vi.fn().mockRejectedValueOnce(new Error('database failure')).mockResolvedValue([])
  render(<OwnerBannerPage authService={authService} workspaceService={{ listServers }}/>)
  expect(await screen.findByRole('alert')).toHaveTextContent('approved servers are unavailable')
  expect(screen.queryByText(/database failure/i)).not.toBeInTheDocument()
  await user.click(screen.getByRole('button',{name:'Retry'}))
  expect(await screen.findByText('You need an approved server before uploading a banner.')).toBeInTheDocument()
  expect(listServers).toHaveBeenCalledTimes(2)
})
