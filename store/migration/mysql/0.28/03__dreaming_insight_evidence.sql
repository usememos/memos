-- dreaming_insight_evidence links insights to the source chunks that informed them.
-- This enables query-time "supporting evidence" returns and future reinforcement logic.
CREATE TABLE `dreaming_insight_evidence` (
  `id`            VARCHAR(36) NOT NULL PRIMARY KEY,
  `insight_id`    VARCHAR(36) NOT NULL,
  `chunk_id`      VARCHAR(256) NOT NULL,
  `session_key`   VARCHAR(256) NOT NULL DEFAULT '',
  `relevance`     DOUBLE NOT NULL DEFAULT 0,
  `evidence_role` VARCHAR(16) NOT NULL DEFAULT 'supporting',
  `created_at`    BIGINT NOT NULL,
  FOREIGN KEY (`insight_id`) REFERENCES `dreaming_insights`(`id`) ON DELETE CASCADE
);

CREATE INDEX `idx_dreaming_iev_insight_id` ON `dreaming_insight_evidence`(`insight_id`);
CREATE INDEX `idx_dreaming_iev_chunk_id` ON `dreaming_insight_evidence`(`chunk_id`);
