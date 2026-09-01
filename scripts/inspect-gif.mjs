import { readFile } from 'node:fs/promises'

const filePath = process.argv[2]
if (!filePath) throw new Error('Provide a GIF file path.')
const bytes = await readFile(filePath)
const signature = bytes.subarray(0, 6).toString('ascii')
if (signature !== 'GIF87a' && signature !== 'GIF89a') throw new Error('The file is not a valid GIF.')
if (bytes.length < 13) throw new Error('The GIF header is incomplete.')

const width = bytes.readUInt16LE(6)
const height = bytes.readUInt16LE(8)
const packed = bytes[10]
let offset = 13
if (packed & 0x80) offset += 3 * (2 ** ((packed & 0x07) + 1))

let frames = 0
let durationCentiseconds = 0
while (offset < bytes.length) {
  const marker = bytes[offset++]
  if (marker === 0x3b) break
  if (marker === 0x21) {
    const label = bytes[offset++]
    const blockSize = bytes[offset++]
    if (label === 0xf9 && blockSize === 4) durationCentiseconds += bytes.readUInt16LE(offset + 1)
    offset += blockSize
    while (offset < bytes.length) {
      const continuationSize = bytes[offset++]
      if (continuationSize === 0) break
      offset += continuationSize
    }
    continue
  }
  if (marker !== 0x2c || offset + 9 > bytes.length) throw new Error('The GIF structure is malformed.')
  frames += 1
  const imagePacked = bytes[offset + 8]
  offset += 9
  if (imagePacked & 0x80) offset += 3 * (2 ** ((imagePacked & 0x07) + 1))
  offset += 1
  while (offset < bytes.length) {
    const blockSize = bytes[offset++]
    if (blockSize === 0) break
    offset += blockSize
  }
}

if (width === 0 || height === 0 || frames === 0 || offset > bytes.length) throw new Error('The GIF could not be decoded safely.')
const result = { signature, width, height, pixels: width * height, bytes: bytes.length, frames, durationSeconds: durationCentiseconds / 100 }
if (result.bytes > 1_000_000 || result.width > 728 || result.height > 90 || result.pixels > 65_520 || result.frames > 120 || result.durationSeconds > 30) {
  throw new Error('The GIF exceeds the preview limits.')
}
console.log(JSON.stringify(result))
