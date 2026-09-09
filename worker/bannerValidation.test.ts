import { describe,expect,it } from 'vitest'
import { applyPalette,GIFEncoder,quantize } from 'gifenc'
import jpeg from 'jpeg-js'
import UPNG from 'upng-js'
import { bannerLimits,validateBanner } from './bannerValidation'
const rgba=(width=468,height=60)=>{const pixels=new Uint8Array(width*height*4);for(let i=0;i<pixels.length;i+=4)pixels.set([25,100,220,255],i);return pixels}
const buffer=(bytes:Uint8Array)=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer
const gif=(width=468,height=60,delay=100,frames=1)=>{const pixels=rgba(width,height),palette=quantize(pixels,256),indexed=applyPalette(pixels,palette),encoder=GIFEncoder();for(let frame=0;frame<frames;frame+=1)encoder.writeFrame(indexed,width,height,{palette,delay});encoder.finish();return encoder.bytes()}
const png=(width=468,height=60)=>new Uint8Array(UPNG.encode([buffer(rgba(width,height))],width,height,0))
describe('banner validation',()=>{
 it('fully decodes GIF data and generates a static PNG fallback',async()=>{const input=gif(),result=await validateBanner(input);expect(result).toMatchObject({mediaType:'image/gif',width:468,height:60,frameCount:1,animationDurationMs:100});expect(result?.bytes).toEqual(input);expect(result?.originalSha256).toHaveLength(32);expect(result?.sanitizedSha256).toEqual(result?.originalSha256);expect([...result!.staticFallbackBytes.slice(0,8)]).toEqual([137,80,78,71,13,10,26,10])})
 it('accepts 45 free-banner frames and rejects the next frame',async()=>{await expect(validateBanner(gif(468,60,100,45))).resolves.toMatchObject({frameCount:45,animationDurationMs:4500});await expect(validateBanner(gif(468,60,100,46))).resolves.toBeNull()})
 it('sanitizes static PNG and JPEG inputs',async()=>{const cleanPng=await validateBanner(png());const jpg=new Uint8Array(jpeg.encode({data:rgba(),width:468,height:60},85).data);const cleanJpeg=await validateBanner(jpg);expect(cleanPng?.mediaType).toBe('image/png');expect(cleanJpeg?.mediaType).toBe('image/jpeg')})
 it('keeps exclusive banners separate at exactly 936 by 120 pixels',async()=>{const exclusive=await validateBanner(png(936,120),'exclusive');expect(exclusive).toMatchObject({mediaType:'image/png',width:936,height:120});await expect(validateBanner(png(936,120))).resolves.toBeNull();await expect(validateBanner(png(),'exclusive')).resolves.toBeNull()})
 it('rejects malformed, wrong-size, oversized, and PNG-polyglot inputs',async()=>{const trailing=new Uint8Array([...png(),1]);await expect(validateBanner(gif(300,60))).resolves.toBeNull();await expect(validateBanner(new Uint8Array([1,2,3]))).resolves.toBeNull();await expect(validateBanner(new Uint8Array(bannerLimits.maxBytes+1))).resolves.toBeNull();await expect(validateBanner(trailing)).resolves.toBeNull()})
 it('rejects an animation truncated inside a later frame',async()=>{const animated=gif(468,60,100,2);await expect(validateBanner(animated.slice(0,-5))).resolves.toBeNull()})
})
