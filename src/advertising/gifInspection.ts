export async function gifFrameLimitError(file: File, maximumFrames: number) {
  if (file.type !== 'image/gif') return undefined
  const frameCount = countGifFrames(new Uint8Array(await file.arrayBuffer()), maximumFrames)
  return frameCount !== null && frameCount > maximumFrames
    ? `Animated GIFs may contain no more than ${maximumFrames} frames.`
    : undefined
}

export function countGifFrames(bytes: Uint8Array, stopAfter = Number.MAX_SAFE_INTEGER) {
  if (bytes.length < 13 || ascii(bytes, 0, 6) !== 'GIF87a' && ascii(bytes, 0, 6) !== 'GIF89a') return null
  let offset = 13
  const packed = bytes[10]
  if (packed & 0x80) offset += 3 * 2 ** ((packed & 0x07) + 1)
  let frames = 0
  while (offset < bytes.length) {
    const marker = bytes[offset++]
    if (marker === 0x3b) return frames || null
    if (marker === 0x21) {
      if (offset >= bytes.length) return null
      offset += 1
      const next = skipSubBlocks(bytes, offset)
      if (next === null) return null
      offset = next
      continue
    }
    if (marker !== 0x2c || offset + 9 > bytes.length) return null
    frames += 1
    if (frames > stopAfter) return frames
    const imagePacked = bytes[offset + 8]
    offset += 9
    if (imagePacked & 0x80) offset += 3 * 2 ** ((imagePacked & 0x07) + 1)
    if (offset >= bytes.length) return null
    offset += 1
    const next = skipSubBlocks(bytes, offset)
    if (next === null) return null
    offset = next
  }
  return null
}

function skipSubBlocks(bytes: Uint8Array, start: number) {
  let offset = start
  while (offset < bytes.length) {
    const size = bytes[offset++]
    if (size === 0) return offset
    offset += size
    if (offset > bytes.length) return null
  }
  return null
}

function ascii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...bytes.subarray(start, start + length))
}
