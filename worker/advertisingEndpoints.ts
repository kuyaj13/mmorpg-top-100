import type { VerifiedFirebaseUser } from './auth'
import { validateBanner } from './bannerValidation'
import type { AdvertisingRepository } from './db/advertisingRepository'
type Deps={allowedOrigins:readonly string[];verifyOwner(r:Request):Promise<VerifiedFirebaseUser|null>;deriveOwnerKey(uid:string):Promise<Uint8Array>;rateLimit(key:string):Promise<{success:boolean}>;repository:AdvertisingRepository}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const safe={'cache-control':'no-store','x-content-type-options':'nosniff'}
const err=(message:string,status:number)=>Response.json({ok:false,message},{status,headers:safe})
export function createAdvertisingEndpoints(d:Deps){return{
 async upload(request:Request,serverId:string){
  if(request.method!=='PUT')return err('Method not allowed.',405)
  const ip=request.headers.get('cf-connecting-ip')??'unknown-client';if(!(await d.rateLimit(`${ip}:banner-upload`)).success)return new Response(JSON.stringify({ok:false,message:'Too many requests. Please try again later.'}),{status:429,headers:{...safe,'content-type':'application/json','retry-after':'60'}})
  const origin=request.headers.get('origin');if(!origin||!d.allowedOrigins.includes(origin))return err('Your upload could not be verified.',403)
  const owner=await d.verifyOwner(request);if(!owner)return err('Your upload could not be verified.',401)
  const length=Number(request.headers.get('content-length')??'0');if(!uuid.test(serverId)||!Number.isFinite(length)||length<1||length>524288)return err('Please choose a valid banner image.',400)
  const alt=request.headers.get('x-banner-alt-text')?.trim();if(!alt||alt.length>180)return err('Please provide meaningful alternative text.',400)
  const banner=await validateBanner(new Uint8Array(await request.arrayBuffer()));if(!banner)return err('Please choose a valid 468 by 60 banner image.',400)
  const outcome=await d.repository.putBanner(serverId,await d.deriveOwnerKey(owner.uid),banner,alt)
  return outcome==='stored'?Response.json({ok:true,message:'Your banner was submitted for review.'},{status:201,headers:safe}):err('This server is not available for banner uploads.',404)
 },
 async listPublic(request:Request,gameSlug:string){if(request.method!=='GET')return err('Method not allowed.',405);return Response.json({ok:true,ads:await d.repository.listPublic(gameSlug)},{headers:{...safe,'cache-control':'public, max-age=60'}})},
 async banner(request:Request,bannerId:string){if(request.method!=='GET'||!uuid.test(bannerId))return err('Banner not found.',404);const b=await d.repository.getPublicBanner(bannerId);return b?new Response(b.bytes,{headers:{'content-type':b.mediaType,'x-content-type-options':'nosniff','cache-control':'public, max-age=300','content-security-policy':"default-src 'none'; sandbox"}}):err('Banner not found.',404)},
}}
