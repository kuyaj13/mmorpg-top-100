import {describe,expect,it,vi} from 'vitest'
import {createAdvertisingRepository} from './advertisingRepository'
import type {RankingQueryClient} from './rankingRepository'

describe('advertising repository',()=>{
  it('loads exclusive upload choices from the verified-claim eligibility function',async()=>{
    const query=vi.fn().mockResolvedValue({rows:[{id:'server-1',name:'Flyff One',game_slug:'flyff',game_name:'Flyff'}]})
    const client:RankingQueryClient={connect:vi.fn(),query,end:vi.fn()}
    await expect(createAdvertisingRepository(()=>client).listExclusiveEligibleServers!(new Uint8Array(32))).resolves.toEqual([{id:'server-1',name:'Flyff One',gameSlug:'flyff',gameName:'Flyff'}])
    expect(query).toHaveBeenCalledWith(expect.stringContaining('api.list_exclusive_banner_eligible_servers'),[expect.any(Uint8Array)])
  })
  it('reconciles the selected game before returning eligible public ads',async()=>{
    const query=vi.fn().mockResolvedValueOnce({rows:[]}).mockResolvedValueOnce({rows:[]})
    const client:RankingQueryClient={connect:vi.fn(),query,end:vi.fn()}
    await expect(createAdvertisingRepository(()=>client).listPublic('flyff')).resolves.toEqual([])
    expect(query).toHaveBeenNthCalledWith(1,'SELECT api.reconcile_exclusive_game($1::varchar)',['flyff'])
    expect(query).toHaveBeenNthCalledWith(2,expect.stringContaining('api.public_exclusive_ads'),['flyff'])
    expect(client.end).toHaveBeenCalledOnce()
  })
  it('normalizes public placement timestamps for browser compatibility',async()=>{
    const row={id:'ad-1',server_id:'server-1',server_name:'Flyff One',banner_id:'banner-1',media_type:'image/png',alt_text:'Flyff One banner',destination_url:'https://flyff.example/',starts_at:'2026-09-09 16:37:07+00',expires_at:'2026-09-16 16:37:07+00'}
    const query=vi.fn().mockResolvedValueOnce({rows:[]}).mockResolvedValueOnce({rows:[row]})
    const client:RankingQueryClient={connect:vi.fn(),query,end:vi.fn()}
    await expect(createAdvertisingRepository(()=>client).listPublic('flyff')).resolves.toMatchObject([{startsAt:'2026-09-09T16:37:07.000Z',expiresAt:'2026-09-16T16:37:07.000Z'}])
  })
})
