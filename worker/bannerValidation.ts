export const bannerLimits = { maxBytes: 524_288, width: 468, height: 60, maxFrames: 30, maxDurationMs: 15_000 } as const
export type ValidatedBanner = { bytes: Uint8Array; sha256: Uint8Array; mediaType: 'image/gif'|'image/png'|'image/jpeg'|'image/webp'; width: number; height: number; frameCount: number; animationDurationMs: number }
const u16le=(b:Uint8Array,o:number)=>b[o]|b[o+1]<<8
const u16be=(b:Uint8Array,o:number)=>b[o]<<8|b[o+1]
const u32be=(b:Uint8Array,o:number)=>(b[o]*0x1000000+(b[o+1]<<16)+(b[o+2]<<8)+b[o+3])>>>0
function ascii(b:Uint8Array,o:number,n:number){return String.fromCharCode(...b.slice(o,o+n))}

function inspect(bytes: Uint8Array): Omit<ValidatedBanner,'bytes'|'sha256'> | null {
  if (bytes.length>=24 && [137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v) && ascii(bytes,12,4)==='IHDR' && ascii(bytes,bytes.length-8,4)==='IEND')
    return {mediaType:'image/png',width:u32be(bytes,16),height:u32be(bytes,20),frameCount:1,animationDurationMs:0}
  if (bytes.length>=14 && (ascii(bytes,0,6)==='GIF87a'||ascii(bytes,0,6)==='GIF89a') && bytes.at(-1)===0x3b) {
    let frames=0,duration=0
    for(let i=13;i<bytes.length-1;i++){if(bytes[i]===0x21&&bytes[i+1]===0xf9&&bytes[i+2]===4){duration+=u16le(bytes,i+4)*10;i+=7}else if(bytes[i]===0x2c)frames++}
    return frames?{mediaType:'image/gif',width:u16le(bytes,6),height:u16le(bytes,8),frameCount:frames,animationDurationMs:duration}:null
  }
  if(bytes.length>=16&&ascii(bytes,0,4)==='RIFF'&&ascii(bytes,8,4)==='WEBP'){
    const kind=ascii(bytes,12,4);let width=0,height=0
    if(kind==='VP8X'&&bytes.length>=30){width=1+bytes[24]+(bytes[25]<<8)+(bytes[26]<<16);height=1+bytes[27]+(bytes[28]<<8)+(bytes[29]<<16)}
    else if(kind==='VP8L'&&bytes.length>=25&&bytes[20]===0x2f){const bits=(bytes[21]|bytes[22]<<8|bytes[23]<<16|bytes[24]<<24)>>>0;width=(bits&0x3fff)+1;height=((bits>>>14)&0x3fff)+1}
    return width&&height?{mediaType:'image/webp',width,height,frameCount:1,animationDurationMs:0}:null
  }
  if(bytes.length>=4&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes.at(-2)===0xff&&bytes.at(-1)===0xd9){
    let offset=2
    while(offset+9<bytes.length){if(bytes[offset++]!==0xff)continue;const marker=bytes[offset++];if(marker===0xd9||marker===0xda)break;const size=u16be(bytes,offset);if(size<2||offset+size>bytes.length)return null;if((marker>=0xc0&&marker<=0xc3)||(marker>=0xc5&&marker<=0xc7)||(marker>=0xc9&&marker<=0xcb)||(marker>=0xcd&&marker<=0xcf))return{mediaType:'image/jpeg',width:u16be(bytes,offset+5),height:u16be(bytes,offset+3),frameCount:1,animationDurationMs:0};offset+=size}
  }
  return null
}
export async function validateBanner(bytes: Uint8Array): Promise<ValidatedBanner|null>{
  if(!bytes.length||bytes.length>bannerLimits.maxBytes)return null
  const metadata=inspect(bytes)
  if(!metadata||metadata.width!==bannerLimits.width||metadata.height!==bannerLimits.height||metadata.frameCount>bannerLimits.maxFrames||metadata.animationDurationMs>bannerLimits.maxDurationMs)return null
  return{bytes,sha256:new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),...metadata}
}
