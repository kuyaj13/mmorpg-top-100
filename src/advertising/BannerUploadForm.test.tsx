import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BannerUploadForm } from './BannerUploadForm'

const server = { id: 'server-1', name: 'Flyff One', gameName: 'Flyff', gameSlug: 'flyff' }

describe('BannerUploadForm', () => {
  beforeEach(() => { globalThis.createImageBitmap = vi.fn().mockResolvedValue({ width: 468, height: 60, close: vi.fn() }) })

  it('uploads an approved image for an owned server and announces review', async () => {
    const user = userEvent.setup()
    const service = { upload: vi.fn().mockResolvedValue({ ok: true as const, message: 'Your banner was uploaded for moderation review.' }) }
    render(<BannerUploadForm servers={[server]} service={service} />)
    await user.selectOptions(screen.getByLabelText('Approved server'), server.id)
    const file = new File(['gif89a'], 'banner.gif', { type: 'image/gif' })
    await user.upload(screen.getByLabelText('Banner image'), file)
    await user.type(screen.getByLabelText('Banner description'), 'Flyff One fantasy landscape banner')
    await user.click(screen.getByRole('button', { name: 'Upload for review' }))
    expect(service.upload).toHaveBeenCalledWith({ serverId: server.id, altText: 'Flyff One fantasy landscape banner', file })
    expect(await screen.findByRole('status')).toHaveTextContent('uploaded for moderation review')
  })

  it('does not expose an upload control without an approved server', () => {
    render(<BannerUploadForm servers={[]} service={{ upload: vi.fn() }} />)
    expect(screen.getByRole('status')).toHaveTextContent('approved server')
    expect(screen.queryByLabelText('Banner image')).not.toBeInTheDocument()
  })

  it('limits the file picker to the sanitizer-supported formats', () => {
    render(<BannerUploadForm servers={[server]} service={{ upload: vi.fn() }} />)
    expect(screen.getByLabelText('Banner image')).toHaveAttribute('accept', 'image/gif,image/png,image/jpeg,.gif,.png,.jpg,.jpeg')
  })
})
