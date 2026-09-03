declare module 'gifenc' {
  type Palette = number[][]
  type FrameOptions = { palette?: Palette; delay?: number; repeat?: number; dispose?: number }
  export function GIFEncoder(): { writeFrame(index: Uint8Array, width: number, height: number, options?: FrameOptions): void; finish(): void; bytes(): Uint8Array }
  export function quantize(rgba: Uint8Array | Uint8ClampedArray, maxColors: number): Palette
  export function applyPalette(rgba: Uint8Array | Uint8ClampedArray, palette: Palette): Uint8Array
}

declare module 'upng-js' {
  type Image = { width: number; height: number; frames: unknown[] }
  const UPNG: { decode(bytes: ArrayBuffer): Image; toRGBA8(image: Image): ArrayBuffer[]; encode(frames: ArrayBuffer[], width: number, height: number, colors: number): ArrayBuffer }
  export default UPNG
}
