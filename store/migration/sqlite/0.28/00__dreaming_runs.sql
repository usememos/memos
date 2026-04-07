-- dreaming_runs tracks the lifecycle of each dreaming pipeline execution.
-- It replaces in-memory locks and enables stale-run recovery after process restarts.
CREATE TABLE dreaming_runs (
  id              TEXT NOT NULL PRIMARY KEY,
  run_type        TEXT NOT NULL CHECK (run_type IN ('micro', 'major', 'manual')),
  status          TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'cancelled')) DEFAULT 'running',
  started_at      INTEGER NOT NULL,
  finished_at     INTEGER,
  lock_holder     TEXT NOT NULL DEFAULT '',
  error_message   TEXT NOT NULL DEFAULT '',
  stats_json      TEXT NOT NULL DEFAULT '{}',
  phase           TEXT NOT NULL DEFAULT ''
);
