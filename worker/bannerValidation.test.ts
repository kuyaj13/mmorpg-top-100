import { describe,expect,it } from 'vitest'
import { validateBanner } from './bannerValidation'
function gif(width=468,height=60){const b=new Uint8Array(32);b.set(new TextEncoder().encode('GIF89a'));b[6]=width&255;b[7]=width>>8;b[8]=height&255;b[9]=height>>8;b[13]=0x2c;b[31]=0x3b;return b}
describe('banner validation',()=>{
 it('accepts a structurally complete capped 468 by 60 GIF and hashes it',async()=>{const result=await validateBanner(gif());expect(result).toMatchObject({mediaType:'image/gif',width:468,height:60,frameCount:1});expect(result?.sha256).toHaveLength(32)})
 it('rejects wrong dimensions, unknown signatures, and oversized input',async()=>{await expect(validateBanner(gif(300,60))).resolves.toBeNull();await expect(validateBanner(new Uint8Array([1,2,3]))).resolves.toBeNull();await expect(validateBanner(new Uint8Array(524289))).resolves.toBeNull()})
})
