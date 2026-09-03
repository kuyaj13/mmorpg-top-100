import { describe,expect,it } from 'vitest'
import { applyPalette,GIFEncoder,quantize } from 'gifenc'
import jpeg from 'jpeg-js'
import UPNG from 'upng-js'
import { bannerLimits,validateBanner } from './bannerValidation'
const rgba=(width=468,height=60)=>{const pixels=new Uint8Array(width*height*4);for(let i=0;i<pixels.length;i+=4)pixels.set([25,100,220,255],i);return pixels}
const buffer=(bytes:Uint8Array)=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer
const gif=(width=468,height=60,delay=100)=>{const pixels=rgba(width,height),palette=quantize(pixels,256),encoder=GIFEncoder();encoder.writeFrame(applyPalette(pixels,palette),width,height,{palette,delay});encoder.finish();return encoder.bytes()}
const png=(width=468,height=60)=>new Uint8Array(UPNG.encode([buffer(rgba(width,height))],width,height,0))
describe('banner validation',()=>{
 it('fully decodes and re-encodes GIF with a static PNG fallback and separate hashes',async()=>{const result=await validateBanner(gif());expect(result).toMatchObject({mediaType:'image/gif',width:468,height:60,frameCount:1,animationDurationMs:100});expect(result?.originalSha256).toHaveLength(32);expect(result?.sanitizedSha256).toHaveLength(32);expect([...result!.staticFallbackBytes.slice(0,8)]).toEqual([137,80,78,71,13,10,26,10])})
 it('sanitizes static PNG and JPEG inputs',async()=>{const cleanPng=await validateBanner(png());const jpg=new Uint8Array(jpeg.encode({data:rgba(),width:468,height:60},85).data);const cleanJpeg=await validateBanner(jpg);expect(cleanPng?.mediaType).toBe('image/png');expect(cleanJpeg?.mediaType).toBe('image/jpeg')})
 it('rejects malformed, wrong-size, oversized, and PNG-polyglot inputs',async()=>{const trailing=new Uint8Array([...png(),1]);await expect(validateBanner(gif(300,60))).resolves.toBeNull();await expect(validateBanner(new Uint8Array([1,2,3]))).resolves.toBeNull();await expect(validateBanner(new Uint8Array(bannerLimits.maxBytes+1))).resolves.toBeNull();await expect(validateBanner(trailing)).resolves.toBeNull()})
})
