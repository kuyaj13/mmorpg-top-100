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
const managed={id:'server-1',name:'Flyff One',gameName:'Flyff',gameSlug:'flyff',website:'https://flyff.example/',gameVersion:'1.0',region:'Global',mode:'PvE' as const,description:'A friendly Flyff server for everyone.',hasPendingChange:false}
const actions={updateServer:vi.fn().mockResolvedValue({ok:true,message:'Saved'}),removeServer:vi.fn().mockResolvedValue({ok:true,message:'Removed'})}

it('shows only approved servers returned by the protected owner workspace', async () => {
  render(<OwnerBannerPage authService={authService} workspaceService={{...actions,listServers:()=>Promise.resolve([managed]) }}/>)
  expect(await screen.findByRole('heading',{name:'Upload a server banner'})).toBeInTheDocument()
  expect(screen.getByRole('option',{name:'Flyff One — Flyff'})).toBeInTheDocument()
  expect(screen.getByText(/up to 45 frames and run for up to 15 seconds/i)).toBeInTheDocument()
  expect(screen.queryByText(/PayPal transaction reference/i)).not.toBeInTheDocument()
})

it('shows a plain failure state without exposing implementation details', async () => {
  const user = userEvent.setup()
  const listServers = vi.fn().mockRejectedValueOnce(new Error('database failure')).mockResolvedValue([])
  render(<OwnerBannerPage authService={authService} workspaceService={{...actions,listServers }}/>)
  expect(await screen.findByRole('alert')).toHaveTextContent('approved servers are unavailable')
  expect(screen.queryByText(/database failure/i)).not.toBeInTheDocument()
  await user.click(screen.getByRole('button',{name:'Retry'}))
  expect(await screen.findByText('You need an approved server before uploading a banner.')).toBeInTheDocument()
  expect(listServers).toHaveBeenCalledTimes(2)
})

it('tells an unverified server owner to check the spam folder', async () => {
  render(<OwnerBannerPage authService={{ ...authService, currentStatus: () => Promise.resolve('verify-email') }} workspaceService={{...actions,listServers:vi.fn() }}/>)
  expect(await screen.findByText(/check your spam folder if the message is not in your inbox/i)).toBeInTheDocument()
})
