import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PlayerAuthPanel } from './PlayerAuthPanel'

const service = { currentStatus: () => Promise.resolve('signed-out' as const), signIn: vi.fn().mockResolvedValue('ready'), register: vi.fn().mockResolvedValue('verify-email'), sendVerification: vi.fn(), refreshVerification: vi.fn(), signOut: vi.fn() }

it('provides keyboard-accessible player sign-in and account creation', async () => {
  const user = userEvent.setup(); const onStatusChange = vi.fn()
  render(<PlayerAuthPanel service={service} onStatusChange={onStatusChange} />)
  await user.type(await screen.findByLabelText('Email address'), 'player@example.com')
  await user.type(screen.getByLabelText('Password'), 'password123')
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
  expect(service.signIn).toHaveBeenCalledWith('player@example.com', 'password123')
  expect(onStatusChange).toHaveBeenCalledWith('ready')
})
