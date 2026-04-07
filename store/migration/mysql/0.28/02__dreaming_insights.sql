-- dreaming_insights is the consolidated output of the dreaming pipeline.
-- Insights are independent from chunks: they represent distilled, promoted knowledge.
-- The memory_class field distinguishes Deep (consolidated) vs REM (associative) origin.
CREATE TABLE `dreaming_insights` (
  `id`                 VARCHAR(36) NOT NULL PRIMARY KEY,
  `summary`            TEXT NOT NULL,
  `kind`               VARCHAR(256) NOT NULL DEFAULT '',
  `phase`              VARCHAR(16) NOT NULL DEFAULT 'light',
  `memory_class`       VARCHAR(16) NOT NULL DEFAULT 'consolidated',
  `status`             VARCHAR(16) NOT NULL DEFAULT 'active',
  `confidence`         DOUBLE NOT NULL DEFAULT 0,
  `salience_score`     DOUBLE NOT NULL DEFAULT 1.0,
  `retrieval_priority` DOUBLE NOT NULL DEFAULT 0,
  `decay_factor`       DOUBLE NOT NULL DEFAULT 1.0,
  `support_count`      INT NOT NULL DEFAULT 0,
  `created_at`         BIGINT NOT NULL DEFAULT (UNIX_TIMESTAMP()),
  `updated_at`         BIGINT NOT NULL DEFAULT (UNIX_TIMESTAMP()),
  `last_reinforced_at` BIGINT,
  `merged_into`        VARCHAR(36),
  `creator_id`         INT NOT NULL DEFAULT 1,
  UNIQUE(`summary`(255), `kind`, `phase`)
);

CREATE INDEX `idx_dreaming_ins_memory_class` ON `dreaming_insights`(`memory_class`);
CREATE INDEX `idx_dreaming_ins_status` ON `dreaming_insights`(`status`);
CREATE INDEX `idx_dreaming_ins_retrieval_priority` ON `dreaming_insights`(`retrieval_priority` DESC);
CREATE INDEX `idx_dreaming_ins_created_at` ON `dreaming_insights`(`created_at`);
CREATE INDEX `idx_dreaming_ins_kind` ON `dreaming_insights`(`kind`);
