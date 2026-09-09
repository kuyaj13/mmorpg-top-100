import { applyPalette, GIFEncoder, quantize } from 'gifenc'
import { countGifFrames, gifFrameLimitError } from './gifInspection'

function gif(frames: number) {
  const pixels = new Uint8Array(2 * 2 * 4)
  for (let index = 3; index < pixels.length; index += 4) pixels[index] = 255
  const palette = quantize(pixels, 256)
  const indexed = applyPalette(pixels, palette)
  const encoder = GIFEncoder()
  for (let frame = 0; frame < frames; frame += 1) encoder.writeFrame(indexed, 2, 2, { palette, delay: 100 })
  encoder.finish()
  return new Uint8Array(encoder.bytes())
}

describe('GIF frame inspection', () => {
  it('counts valid frames and stops as soon as the limit is exceeded', async () => {
    expect(countGifFrames(gif(45), 45)).toBe(45)
    expect(countGifFrames(gif(46), 45)).toBe(46)
    await expect(gifFrameLimitError(new File([gif(46)], 'banner.gif', { type: 'image/gif' }), 45))
      .resolves.toBe('Animated GIFs may contain no more than 45 frames.')
  })

  it('leaves malformed and non-GIF files for trusted validation', async () => {
    expect(countGifFrames(new Uint8Array([1, 2, 3]), 45)).toBeNull()
    await expect(gifFrameLimitError(new File(['png'], 'banner.png', { type: 'image/png' }), 45)).resolves.toBeUndefined()
  })
})
