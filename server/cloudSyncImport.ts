import crypto from "crypto"

const IMPORT_TABLES = [
  "products",
  "variants",
  "colors",
  "sales",
  "sale_items",
  "stock_in_history",
  "payment_history",
  "returns",
  "return_items",
  "customer_accounts",
  "settings",
]

function pgBigIntFromHash(s: string) {
  const h = crypto.createHash("sha256").update(s).digest()
  const hex = h.slice(0, 8).toString("hex")
  return BigInt(`0x${hex}`) & BigInt("0x7fffffffffffffff")
}

// Strategy: 'skip' | 'overwrite' | 'merge'
export async function importFromPostgres(connectionString: string, strategy: string = 'merge', dryRun = true) {
  const { Client } = await import("pg")
  const client = new Client({ connectionString, statement_timeout: 60000 })
  await client.connect()

  const lockKey = pgBigIntFromHash(connectionString)
  const lockRes = await client.query("SELECT pg_try_advisory_lock($1) as locked", [lockKey])
  if (!lockRes.rows[0].locked) {
    await client.end()
    throw new Error("Unable to acquire advisory lock on remote DB")
  }

  const { sqliteDb } = await import("./db")
  if (!sqliteDb) {
    await client.query("SELECT pg_advisory_unlock($1)", [lockKey])
    await client.end()
    throw new Error("Local sqlite DB not available")
  }

  try {
    // For safety: run in a local transaction
    sqliteDb.prepare("BEGIN TRANSACTION").run()

    const summary: Record<string, { remoteRows: number; inserted: number; updated: number; skipped: number }> = {}

    for (const table of IMPORT_TABLES) {
      // Check if table exists in remote Postgres
      try {
        const chk = await client.query(`SELECT 1 FROM \"${table}\" LIMIT 1`)
      } catch (err) {
        // Table likely doesn't exist remotely; skip
        summary[table] = { remoteRows: 0, inserted: 0, updated: 0, skipped: 0 }
        continue
      }

      const remoteRowsRes = await client.query(`SELECT * FROM \"${table}\"`)
      const rows = remoteRowsRes.rows || []
      summary[table] = { remoteRows: rows.length, inserted: 0, updated: 0, skipped: 0 }

      if (dryRun) continue

      // For each remote row, upsert into sqlite according to strategy
      for (const r of rows) {
        const id = r.id
        if (!id) continue

        const localRow = sqliteDb.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id)
        if (!localRow) {
          // Insert
          const cols = Object.keys(r)
          const vals = cols.map((c) => r[c])
          const placeholders = cols.map(() => "?").join(",")
          const sql = `INSERT INTO ${table} (${cols.map((c) => `\"${c}\"`).join(",")}) VALUES (${placeholders})`
          try {
            sqliteDb.prepare(sql).run(...vals)
            summary[table].inserted++
          } catch (err) {
            console.error(`[CloudSyncImport] Insert error ${table}:`, err)
          }
          continue
        }

        // Local exists
        if (strategy === 'skip') {
          summary[table].skipped++
          continue
        }

        if (strategy === 'overwrite') {
          const cols = Object.keys(r)
          const setClause = cols.map((c) => `\"${c}\" = ?`).join(",")
          const vals = cols.map((c) => r[c])
          try {
            sqliteDb.prepare(`UPDATE ${table} SET ${setClause} WHERE id = ?`).run(...vals, id)
            summary[table].updated++
          } catch (err) {
            console.error(`[CloudSyncImport] Overwrite error ${table}:`, err)
          }
          continue
        }

        if (strategy === 'merge') {
          // Only overwrite local NULL/empty values with remote non-null
          const cols = Object.keys(r)
          const updates: string[] = []
          const vals: any[] = []
          for (const c of cols) {
            const remoteVal = r[c]
            const localVal = localRow[c]
            if ((localVal === null || localVal === undefined || localVal === '') && remoteVal !== null && remoteVal !== undefined && remoteVal !== '') {
              updates.push(`\"${c}\" = ?`)
              vals.push(remoteVal)
            }
          }
          if (updates.length === 0) {
            summary[table].skipped++
            continue
          }
          try {
            sqliteDb.prepare(`UPDATE ${table} SET ${updates.join(",")} WHERE id = ?`).run(...vals, id)
            summary[table].updated++
          } catch (err) {
            console.error(`[CloudSyncImport] Merge error ${table}:`, err)
          }
        }
      }
    }

    sqliteDb.prepare("COMMIT").run()
    await client.query("SELECT pg_advisory_unlock($1)", [lockKey])
    await client.end()
    return { ok: true, dryRun, strategy, summary }
  } catch (err: any) {
    sqliteDb.prepare("ROLLBACK").run()
    await client.query("SELECT pg_advisory_unlock($1)", [lockKey])
    await client.end()
    throw err
  }
}
