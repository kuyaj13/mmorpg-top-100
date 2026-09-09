import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BannerUploadForm } from './BannerUploadForm'
import { applyPalette, GIFEncoder, quantize } from 'gifenc'

const server = { id: 'server-1', name: 'Flyff One', gameName: 'Flyff', gameSlug: 'flyff' }

describe('BannerUploadForm', () => {
  beforeEach(() => {
    globalThis.createImageBitmap = vi.fn().mockResolvedValue({ width: 468, height: 60, close: vi.fn() })
    window.turnstile = { render: vi.fn((_element, options) => { (options.callback as (token: string) => void)('challenge-token'); return 'banner-widget' }), remove: vi.fn(), reset: vi.fn() }
  })
  afterEach(() => { delete window.turnstile })

  it('uploads an approved image for an owned server and announces review', async () => {
    const user = userEvent.setup()
    const service = { upload: vi.fn().mockResolvedValue({ ok: true as const, message: 'Your banner was uploaded for moderation review.' }) }
    render(<BannerUploadForm servers={[server]} service={service} turnstileSiteKey="test-key" />)
    await user.selectOptions(screen.getByLabelText('Approved server'), server.id)
    const file = new File(['gif89a'], 'banner.gif', { type: 'image/gif' })
    await user.upload(screen.getByLabelText('Banner image'), file)
    await user.type(screen.getByLabelText('Banner description'), 'Flyff One fantasy landscape banner')
    await user.click(screen.getByRole('button', { name: 'Upload for review' }))
    expect(service.upload).toHaveBeenCalledWith({ serverId: server.id, altText: 'Flyff One fantasy landscape banner', file,turnstileToken:'challenge-token',kind:'free' })
    expect(await screen.findByRole('status')).toHaveTextContent('uploaded for moderation review')
    expect(window.turnstile?.reset).toHaveBeenCalledWith('banner-widget')
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

  it('shows the 45-frame GIF limit beside the banner field', async () => {
    const user = userEvent.setup()
    const service = { upload: vi.fn() }
    const pixels = new Uint8Array(468 * 60 * 4)
    for (let index = 3; index < pixels.length; index += 4) pixels[index] = 255
    const palette = quantize(pixels, 256)
    const indexed = applyPalette(pixels, palette)
    const encoder = GIFEncoder()
    for (let frame = 0; frame < 46; frame += 1) encoder.writeFrame(indexed, 468, 60, { palette, delay: 100 })
    encoder.finish()
    const file = new File([new Uint8Array(encoder.bytes())], 'too-many-frames.gif', { type: 'image/gif' })
    render(<BannerUploadForm servers={[server]} service={service} turnstileSiteKey="test-key" />)

    expect(screen.getByLabelText('Banner image')).toHaveAccessibleDescription(/up to 45 frames/i)
    await user.selectOptions(screen.getByLabelText('Approved server'), server.id)
    await user.upload(screen.getByLabelText('Banner image'), file)
    await user.type(screen.getByLabelText('Banner description'), 'Flyff animated fantasy banner')
    await user.click(screen.getByRole('button', { name: 'Upload for review' }))

    expect(await screen.findByText('Animated GIFs may contain no more than 45 frames.')).toHaveAttribute('id', 'banner-file-error')
    expect(screen.getByLabelText('Banner image')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Banner image')).toHaveFocus()
    expect(service.upload).not.toHaveBeenCalled()
  })
})
