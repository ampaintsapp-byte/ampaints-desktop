-- Migration: create cloud_sync_jobs and cloud_sync_connections tables

CREATE TABLE IF NOT EXISTS cloud_sync_jobs (
  id TEXT PRIMARY KEY,
  job_type TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, running, success, failed
  dry_run INTEGER DEFAULT 1,
  initiated_by TEXT,
  details TEXT,
  attempts INTEGER DEFAULT 0,
  last_error TEXT,
  created_at DATETIME DEFAULT (datetime('now')),
  updated_at DATETIME DEFAULT (datetime('now'))
);

-- Store connection metadata; connection_string_encrypted is nullable until we implement secure encryption
CREATE TABLE IF NOT EXISTS cloud_sync_connections (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  label TEXT,
  connection_string_encrypted TEXT,
  created_at DATETIME DEFAULT (datetime('now')),
  updated_at DATETIME DEFAULT (datetime('now'))
);

-- Add indexes for faster lookup
CREATE INDEX IF NOT EXISTS idx_cloud_sync_jobs_status ON cloud_sync_jobs(status);
CREATE INDEX IF NOT EXISTS idx_cloud_sync_connections_provider ON cloud_sync_connections(provider);
