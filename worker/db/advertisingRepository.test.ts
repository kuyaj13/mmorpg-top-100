import {describe,expect,it,vi} from 'vitest'
import {createAdvertisingRepository} from './advertisingRepository'
import type {RankingQueryClient} from './rankingRepository'

describe('advertising repository',()=>{
  it('reconciles the selected game before returning eligible public ads',async()=>{
    const query=vi.fn().mockResolvedValueOnce({rows:[]}).mockResolvedValueOnce({rows:[]})
    const client:RankingQueryClient={connect:vi.fn(),query,end:vi.fn()}
    await expect(createAdvertisingRepository(()=>client).listPublic('flyff')).resolves.toEqual([])
    expect(query).toHaveBeenNthCalledWith(1,'SELECT api.reconcile_exclusive_game($1::varchar)',['flyff'])
    expect(query).toHaveBeenNthCalledWith(2,expect.stringContaining('api.public_exclusive_ads'),['flyff'])
    expect(client.end).toHaveBeenCalledOnce()
  })
})
