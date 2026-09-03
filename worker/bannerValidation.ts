import { applyPalette, GIFEncoder, quantize } from 'gifenc'
import { decompressFrames, parseGIF } from 'gifuct-js'
import jpeg from 'jpeg-js'
import UPNG from 'upng-js'

export const bannerLimits={maxBytes:524_288,maxStaticBytes:262_144,width:468,height:60,maxFrames:30,maxDurationMs:15_000,maxFrameDelayMs:1_000,minFrameDelayMs:100,maxPixelWork:842_400}as const
export type SanitizedBanner={bytes:Uint8Array;staticFallbackBytes:Uint8Array;originalSha256:Uint8Array;sanitizedSha256:Uint8Array;mediaType:'image/gif'|'image/png'|'image/jpeg';width:468;height:60;frameCount:number;animationDurationMs:number}

const exactBuffer=(bytes:Uint8Array)=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer
const hash=(bytes:Uint8Array)=>crypto.subtle.digest('SHA-256',bytes).then(value=>new Uint8Array(value))
const png=(rgba:Uint8Array)=>new Uint8Array(UPNG.encode([exactBuffer(rgba)],bannerLimits.width,bannerLimits.height,0))
const validOutput=(bytes:Uint8Array,staticBytes:Uint8Array)=>bytes.length>0&&bytes.length<=bannerLimits.maxBytes&&staticBytes.length>0&&staticBytes.length<=bannerLimits.maxStaticBytes

function hasStrictPngEnvelope(bytes:Uint8Array){
 const signature=[137,80,78,71,13,10,26,10];if(bytes.length<20||!signature.every((v,i)=>bytes[i]===v))return false
 let offset=8,foundEnd=false,validHeader=false
 while(offset+12<=bytes.length){const length=((bytes[offset]<<24)|(bytes[offset+1]<<16)|(bytes[offset+2]<<8)|bytes[offset+3])>>>0;const end=offset+12+length;if(end>bytes.length)return false;const type=String.fromCharCode(...bytes.subarray(offset+4,offset+8));if(type==='acTL'||type==='fcTL'||type==='fdAT')return false;if(type==='IEND'){foundEnd=length===0&&end===bytes.length;break}offset=end}
 const ihdr=8;if(bytes[11]===13&&String.fromCharCode(...bytes.subarray(ihdr+4,ihdr+8))==='IHDR'&&bytes.length>=33){const width=((bytes[16]<<24)|(bytes[17]<<16)|(bytes[18]<<8)|bytes[19])>>>0,height=((bytes[20]<<24)|(bytes[21]<<16)|(bytes[22]<<8)|bytes[23])>>>0;validHeader=width===bannerLimits.width&&height===bannerLimits.height}
 return foundEnd&&validHeader
}

function compositeGif(bytes:Uint8Array){
 const parsed=parseGIF(exactBuffer(bytes));if(parsed.lsd.width!==bannerLimits.width||parsed.lsd.height!==bannerLimits.height)return null
 const encodedFrames=parsed.frames.filter(frame=>'image'in frame);if(encodedFrames.length<1||encodedFrames.length>bannerLimits.maxFrames||encodedFrames.reduce((sum,frame)=>sum+frame.image.descriptor.width*frame.image.descriptor.height,0)>bannerLimits.maxPixelWork)return null
 const frames=decompressFrames(parsed,true);if(frames.length<1||frames.length>bannerLimits.maxFrames||frames.length*bannerLimits.width*bannerLimits.height>bannerLimits.maxPixelWork)return null
 const canvas=new Uint8Array(bannerLimits.width*bannerLimits.height*4),composited:Uint8Array[]=[];let duration=0,previous:typeof frames[number]|undefined,restore:Uint8Array|undefined
 for(const frame of frames){
  if(previous?.disposalType===2){for(let y=0;y<previous.dims.height;y++)for(let x=0;x<previous.dims.width;x++){const p=((previous.dims.top+y)*bannerLimits.width+previous.dims.left+x)*4;canvas.fill(0,p,p+4)}}else if(previous?.disposalType===3&&restore)canvas.set(restore)
  const {left,top,width,height}=frame.dims;if(width<1||height<1||left<0||top<0||left+width>bannerLimits.width||top+height>bannerLimits.height||frame.patch.length!==width*height*4)return null
  const delay=frame.delay||bannerLimits.minFrameDelayMs;if(delay<bannerLimits.minFrameDelayMs||delay>bannerLimits.maxFrameDelayMs)return null;duration+=delay;if(duration>bannerLimits.maxDurationMs)return null
  restore=frame.disposalType===3?canvas.slice():undefined
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){const source=(y*width+x)*4,target=((top+y)*bannerLimits.width+left+x)*4;if(frame.patch[source+3]!==0)canvas.set(frame.patch.subarray(source,source+4),target)}
  composited.push(canvas.slice());previous=frame
 }
 return{frames:composited,delays:frames.map(frame=>frame.delay||bannerLimits.minFrameDelayMs),duration}
}

async function finish(bytes:Uint8Array,staticFallbackBytes:Uint8Array,mediaType:SanitizedBanner['mediaType'],frameCount:number,animationDurationMs:number,original:Uint8Array):Promise<SanitizedBanner|null>{
 if(!validOutput(bytes,staticFallbackBytes))return null
 return{bytes,staticFallbackBytes,originalSha256:await hash(original),sanitizedSha256:await hash(bytes),mediaType,width:468,height:60,frameCount,animationDurationMs}
}

export async function validateBanner(input:Uint8Array):Promise<SanitizedBanner|null>{
 if(input.length<4||input.length>bannerLimits.maxBytes)return null
 try{
  if(input[0]===0x47&&input[1]===0x49&&input[2]===0x46){const decoded=compositeGif(input);if(!decoded)return null;const encoder=GIFEncoder();decoded.frames.forEach((rgba,index)=>{const palette=quantize(rgba,256);encoder.writeFrame(applyPalette(rgba,palette),468,60,{palette,delay:decoded.delays[index],repeat:0,dispose:1})});encoder.finish();return finish(encoder.bytes(),png(decoded.frames[0]),'image/gif',decoded.frames.length,decoded.duration,input)}
  if(hasStrictPngEnvelope(input)){const decoded=UPNG.decode(exactBuffer(input));if(decoded.width!==468||decoded.height!==60||decoded.frames.length!==0)return null;const rgba=new Uint8Array(UPNG.toRGBA8(decoded)[0]);const clean=png(rgba);return finish(clean,clean,'image/png',1,0,input)}
  if(input[0]===0xff&&input[1]===0xd8&&input.at(-2)===0xff&&input.at(-1)===0xd9){const decoded=jpeg.decode(input,{useTArray:true,formatAsRGBA:true,tolerantDecoding:false,maxResolutionInMP:1,maxMemoryUsageInMB:8});if(decoded.width!==468||decoded.height!==60)return null;const rgba=new Uint8Array(decoded.data);return finish(new Uint8Array(jpeg.encode({data:rgba,width:468,height:60},85).data),png(rgba),'image/jpeg',1,0,input)}
 }catch{return null}
 return null
}
