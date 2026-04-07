-- dreaming_replay_queue is the hippocampal replay buffer.
-- It records chunks that are worth reprocessing through the dreaming pipeline,
-- rather than having the pipeline scan all chunks on every run.
CREATE TABLE `dreaming_replay_queue` (
  `id`                       VARCHAR(36) NOT NULL PRIMARY KEY,
  `chunk_id`                 VARCHAR(256) NOT NULL,
  `session_key`              VARCHAR(256) NOT NULL,
  `activation_score`         DOUBLE NOT NULL DEFAULT 0,
  `novelty_score`            DOUBLE NOT NULL DEFAULT 0,
  `rehearsal_count`          INT NOT NULL DEFAULT 0,
  `first_queued_at`          BIGINT NOT NULL,
  `last_replayed_at`         BIGINT,
  `queue_reason`             VARCHAR(256) NOT NULL DEFAULT '',
  `status`                   VARCHAR(16) NOT NULL DEFAULT 'queued',
  `spindle_tag`              VARCHAR(16) NOT NULL DEFAULT 'none',
  `dreaming_candidate_score` DOUBLE NOT NULL DEFAULT 0,
  `candidate_kind_hint`      VARCHAR(256)
);

CREATE INDEX `idx_dreaming_rq_chunk_id` ON `dreaming_replay_queue`(`chunk_id`);
CREATE INDEX `idx_dreaming_rq_session_key` ON `dreaming_replay_queue`(`session_key`);
CREATE INDEX `idx_dreaming_rq_status` ON `dreaming_replay_queue`(`status`);
CREATE INDEX `idx_dreaming_rq_activation` ON `dreaming_replay_queue`(`activation_score` DESC);
