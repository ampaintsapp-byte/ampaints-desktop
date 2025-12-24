#!/usr/bin/env node
import { importFromPostgres } from './cloudSyncImport'

async function run() {
  const conn = process.argv[2] || process.env.CLOUD_SYNC_TEST_CONN
  const strategy = process.argv[3] || 'merge'
  const dryRun = process.argv.includes('--dry') || true
  if (!conn) {
    console.error('Usage: node cloudSyncImportCli.js <connectionString> [strategy] [--dry=false]')
    process.exit(2)
  }

  try {
    const res = await importFromPostgres(conn, strategy, dryRun)
    console.log('Import result:', JSON.stringify(res, null, 2))
  } catch (err: any) {
    console.error('Error:', err?.message || err)
    process.exit(1)
  }
}

run()
