Cloud Sync (Neon / Supabase) - Overview and Secure Setup

This feature provides an explicit, opt-in Cloud Sync that exports data from the local SQLite database to a remote Postgres-compatible database (Neon, Supabase).

Key properties

- Opt-in and auditable: Admin users must explicitly save a connection and enqueue jobs. No secret or silent exports.
- Secure storage: Connection strings are encrypted using AES-256-GCM and stored in SQLite in `cloud_sync_connections.connection_string_encrypted`. Set `CLOUD_SYNC_ENCRYPTION_KEY` (32 bytes) in server env.
- Dry-run by default: Export jobs are dry-run so you can preview row counts before making changes.
- Idempotent upserts: Export performs INSERT ... ON CONFLICT (id) DO UPDATE for exported rows.
- Advisory locks: Remote Postgres advisory locking prevents concurrent syncs to the same remote DB.
- Audit: `cloud_sync_jobs` table tracks job history, status, attempts, and error messages.

How to use (admin)

1. Set `CLOUD_SYNC_ENCRYPTION_KEY` in the server environment (32 character secret is recommended). Example (PowerShell):

```powershell
$env:CLOUD_SYNC_ENCRYPTION_KEY = "your-32-char-secret-here"
```

2. In Settings → Cloud Sync paste your Postgres connection string (Neon or Supabase) and click Test Connection.
3. Click Save Connection to store it securely on the server.
4. From the saved connections, click Run Export (dry-run) to enqueue a dry-run export job. Check Job History for results.
5. When satisfied, we can run a full export (not implemented in UI by default for safety) — request this explicitly.

Security notes

- Rotate any exposed connection strings immediately — do not post them publicly.
- The server stores encrypted connection strings. The plaintext connection string is only used transiently for testing and export.
- Import (remote -> local) is implemented (dry-run + merge strategies: skip, overwrite, merge).

Next steps we can implement upon approval

- Full export (non-dry-run) with pre-flight preview and confirmation.
- Background worker scheduler and retry/backoff (improve job rescheduling and exponential backoff).
- Per-job detail logs and downloadable audit reports.
- Per-job detail logs and downloadable audit reports.

If you want me to proceed, tell me whether to implement full export or the background worker next.