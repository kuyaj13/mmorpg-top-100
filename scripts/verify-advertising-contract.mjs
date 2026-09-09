import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const migration = readFileSync(fileURLToPath(new URL('../drizzle/0020_exclusive_impression_buckets.sql', import.meta.url)), 'utf8')
const failures = []
const requireMatch = (pattern, message) => { if (!pattern.test(migration)) failures.push(message) }

requireMatch(/CREATE TABLE app\.exclusive_impression_buckets/i, 'Impressions must use bounded aggregate buckets.')
requireMatch(/PRIMARY KEY \(placement_id,bucket_started_at\)/i, 'Only one aggregate row may exist per placement and time bucket.')
requireMatch(/EXISTS\(SELECT 1 FROM api\.public_exclusive_ads ad WHERE ad\.id=\$1\)/i, 'Only currently eligible placements may record impressions.')
requireMatch(/REVOKE ALL ON app\.exclusive_impression_buckets FROM PUBLIC,hyperdrive_reader/i, 'Raw impression aggregates must not be directly readable by the application role.')
requireMatch(/impression_count bigint/i, 'The protected administrator placement view must expose an aggregate impression total.')

if (failures.length) {
  for (const failure of failures) console.error(`Advertising contract mismatch: ${failure}`)
  process.exit(1)
}
console.info('Advertising impression contract verification passed.')
