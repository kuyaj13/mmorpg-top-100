import { Client } from 'pg'
import type { RankingQueryClient } from './rankingRepository'
import type { SanitizedBanner } from '../bannerValidation'
export type PublicAd={id:string;serverId:string;serverName:string;bannerId:string;mediaType:string;altText:string;destinationUrl:string;startsAt:string;expiresAt:string}
export type AdvertisingRepository={putBanner(serverId:string,ownerKey:Uint8Array,banner:SanitizedBanner,altText:string):Promise<'stored'|'unavailable'>;listPublic(gameSlug:string):Promise<PublicAd[]>;getPublicBanner(id:string,staticFallback:boolean):Promise<{bytes:Uint8Array;mediaType:string}|null>}
export function createAdvertisingRepository(createClient:()=>RankingQueryClient):AdvertisingRepository{
 const run=async<T>(fn:(c:RankingQueryClient)=>Promise<T>)=>{const c=createClient();try{await c.connect();return await fn(c)}finally{await c.end()}}
 return{
  putBanner:(id,owner,b,a)=>run(async c=>{const r=await c.query<{put_server_banner:string}>('SELECT api.put_server_banner($1::uuid,$2::bytea,$3::bytea,$4::bytea,$5::bytea,$6::bytea,$7::varchar,$8,$9,$10,$11,$12::varchar) AS put_server_banner',[id,owner,b.bytes,b.staticFallbackBytes,b.originalSha256,b.sanitizedSha256,b.mediaType,b.width,b.height,b.frameCount,b.animationDurationMs,a]);const v=r.rows[0]?.put_server_banner;if(v!=='stored'&&v!=='unavailable')throw new Error('Invalid banner outcome');return v}),
  listPublic:(slug)=>run(async c=>{const r=await c.query<Record<string,string>>('SELECT id::text,server_id::text,server_name,banner_id::text,media_type,alt_text,destination_url,starts_at::text,expires_at::text FROM api.public_exclusive_ads WHERE game_slug=$1 ORDER BY starts_at,id',[slug]);return r.rows.map(x=>({id:x.id,serverId:x.server_id,serverName:x.server_name,bannerId:x.banner_id,mediaType:x.media_type,altText:x.alt_text,destinationUrl:x.destination_url,startsAt:x.starts_at,expiresAt:x.expires_at}))}),
  getPublicBanner:(id,staticFallback)=>run(async c=>{const r=await c.query<{content:Uint8Array;media_type:string}>('SELECT content,media_type FROM api.get_public_banner($1::uuid,$2::boolean)',[id,staticFallback]);const x=r.rows[0];return x?{bytes:x.content,mediaType:x.media_type}:null}),
 }
}
export const createHyperdriveAdvertisingRepository=(url:string)=>createAdvertisingRepository(()=>new Client({connectionString:url}))
