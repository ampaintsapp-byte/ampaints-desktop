import crypto from "crypto"

export async function processNextJob() {
  const { sqliteDb } = await import("./db")
  if (!sqliteDb) throw new Error("sqliteDb not available")

  const job = sqliteDb.prepare("SELECT * FROM cloud_sync_jobs WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1").get()
  if (!job) return null

  // Lock job
  sqliteDb.prepare("UPDATE cloud_sync_jobs SET status = 'running', attempts = attempts + 1, updated_at = datetime('now') WHERE id = ?").run(job.id)

  try {
    console.log(`[CloudSyncWorker] Processing job ${job.id} type=${job.job_type} dry_run=${job.dry_run}`)

    // Use export/import implementations when available
    try {
      if (job.job_type === 'export') {
        const { getConnection } = await import('./cloudSync')
        const conn = await getConnection(job.connectionId)
        if (!conn) throw new Error('Connection not found')
        const { exportToPostgres } = await import('./cloudSyncExport')
        const result = await exportToPostgres(conn.connectionString, job.dry_run === 1)
        sqliteDb.prepare("UPDATE cloud_sync_jobs SET status = 'success', details = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(result.summary), job.id)
        console.log(`[CloudSyncWorker] Job ${job.id} completed (export)`)
        return { id: job.id, status: 'success', result }
      }

      if (job.job_type === 'import') {
        const { getConnection } = await import('./cloudSync')
        const conn = await getConnection(job.connectionId)
        if (!conn) throw new Error('Connection not found')
        const { importFromPostgres } = await import('./cloudSyncImport')
        let strategy = 'merge'
        try {
          const details = job.details ? JSON.parse(job.details) : null
          if (details && details.strategy) strategy = details.strategy
        } catch (err) {
          // ignore parse errors, use default
        }

        const result = await importFromPostgres(conn.connectionString, strategy, job.dry_run === 1)
        sqliteDb.prepare("UPDATE cloud_sync_jobs SET status = 'success', details = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(result.summary), job.id)
        console.log(`[CloudSyncWorker] Job ${job.id} completed (import)`)
        return { id: job.id, status: 'success', result }
      }

      // Unknown job type
      sqliteDb.prepare("UPDATE cloud_sync_jobs SET status = 'failed', last_error = ?, updated_at = datetime('now') WHERE id = ?").run('Unknown job type', job.id)
      return { id: job.id, status: 'failed', error: 'Unknown job type' }
    } catch (err: any) {
      console.error(`[CloudSyncWorker] Job ${job.id} execution error:`, err)
      sqliteDb.prepare("UPDATE cloud_sync_jobs SET status = 'failed', last_error = ?, updated_at = datetime('now') WHERE id = ?").run(err?.message || String(err), job.id)
      return { id: job.id, status: 'failed', error: err?.message }
    }
  } catch (err: any) {
    console.error(`[CloudSyncWorker] Job ${job.id} failed:`, err)
    sqliteDb.prepare("UPDATE cloud_sync_jobs SET status = 'failed', last_error = ?, updated_at = datetime('now') WHERE id = ?").run(err?.message || String(err), job.id)
    return { id: job.id, status: 'failed', error: err?.message }
  }
}
