import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const projectId = 'ancient-haze-79240276'
const productionBranchIds = new Set(['production', 'br-mute-tooth-b3ebhn11'])
const branchIndex = process.argv.indexOf('--branch')
const branch = branchIndex >= 0 ? process.argv[branchIndex + 1] : ''

if (!branch || branch.startsWith('--')) {
  console.error('Provide an explicit isolated branch with --branch <name-or-id>.')
  process.exit(2)
}
if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(branch)) {
  console.error('The isolated branch name or ID is not valid.')
  process.exit(2)
}
if (productionBranchIds.has(branch.toLowerCase())) {
  console.error('Financial verification cannot run on the production branch.')
  process.exit(2)
}

const sqlPath = fileURLToPath(new URL('./verify-financial-release-boundary.sql', import.meta.url))
const sql = readFileSync(sqlPath, 'utf8').trim()
if (!/^(?:\\set[^\r\n]*\r?\n)*BEGIN;/i.test(sql) || !/ROLLBACK;[\s\S]*Financial release boundary verification passed/i.test(sql)) {
  console.error('The financial verification script is missing its rollback safety boundary.')
  process.exit(2)
}

const executable = process.platform === 'win32' ? 'neon.cmd' : 'neon'
const result = spawnSync(executable, [
  'psql', branch,
  '--project-id', projectId,
  '--role-name', 'neondb_owner',
  '--', '-X', '-v', 'ON_ERROR_STOP=1', '-f', sqlPath,
], { stdio: 'inherit', shell: process.platform === 'win32' })

if (result.error) {
  console.error('Financial verification could not start.')
  process.exit(1)
}
process.exit(result.status ?? 1)
