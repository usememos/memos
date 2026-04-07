-- dreaming_runs tracks the lifecycle of each dreaming pipeline execution.
-- It replaces in-memory locks and enables stale-run recovery after process restarts.
CREATE TABLE `dreaming_runs` (
  `id`              VARCHAR(36) NOT NULL PRIMARY KEY,
  `run_type`        VARCHAR(16) NOT NULL,
  `status`          VARCHAR(16) NOT NULL DEFAULT 'running',
  `started_at`      BIGINT NOT NULL,
  `finished_at`     BIGINT,
  `lock_holder`     VARCHAR(256) NOT NULL DEFAULT '',
  `error_message`   TEXT NOT NULL,
  `stats_json`      TEXT NOT NULL,
  `phase`           VARCHAR(32) NOT NULL DEFAULT ''
);
