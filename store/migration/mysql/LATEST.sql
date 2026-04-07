-- system_setting
CREATE TABLE `system_setting` (
  `name` VARCHAR(256) NOT NULL PRIMARY KEY,
  `value` LONGTEXT NOT NULL,
  `description` TEXT NOT NULL
);

-- user
CREATE TABLE `user` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `created_ts` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_ts` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `row_status` VARCHAR(256) NOT NULL DEFAULT 'NORMAL',
  `username` VARCHAR(256) NOT NULL UNIQUE,
  `role` VARCHAR(256) NOT NULL DEFAULT 'USER',
  `email` VARCHAR(256) NOT NULL DEFAULT '',
  `nickname` VARCHAR(256) NOT NULL DEFAULT '',
  `password_hash` VARCHAR(256) NOT NULL,
  `avatar_url` LONGTEXT NOT NULL,
  `description` VARCHAR(256) NOT NULL DEFAULT ''
);

-- user_setting
CREATE TABLE `user_setting` (
  `user_id` INT NOT NULL,
  `key` VARCHAR(256) NOT NULL,
  `value` LONGTEXT NOT NULL,
  UNIQUE(`user_id`,`key`)
);

-- memo
CREATE TABLE `memo` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `uid` VARCHAR(256) NOT NULL UNIQUE,
  `creator_id` INT NOT NULL,
  `created_ts` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_ts` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `row_status` VARCHAR(256) NOT NULL DEFAULT 'NORMAL',
  `content` TEXT NOT NULL,
  `visibility` VARCHAR(256) NOT NULL DEFAULT 'PRIVATE',
  `pinned` BOOLEAN NOT NULL DEFAULT FALSE,
  `payload` JSON NOT NULL
);

-- memo_relation
CREATE TABLE `memo_relation` (
  `memo_id` INT NOT NULL,
  `related_memo_id` INT NOT NULL,
  `type` VARCHAR(256) NOT NULL,
  UNIQUE(`memo_id`,`related_memo_id`,`type`)
);

-- attachment
CREATE TABLE `attachment` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `uid` VARCHAR(256) NOT NULL UNIQUE,
  `creator_id` INT NOT NULL,
  `created_ts` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_ts` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `filename` TEXT NOT NULL,
  `blob` MEDIUMBLOB,
  `type` VARCHAR(256) NOT NULL DEFAULT '',
  `size` INT NOT NULL DEFAULT '0',
  `memo_id` INT DEFAULT NULL,
  `storage_type` VARCHAR(256) NOT NULL DEFAULT '',
  `reference` TEXT NOT NULL DEFAULT (''),
  `payload` TEXT NOT NULL
);

-- idp
CREATE TABLE `idp` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `uid` VARCHAR(256) NOT NULL UNIQUE,
  `name` TEXT NOT NULL,
  `type` TEXT NOT NULL,
  `identifier_filter` VARCHAR(256) NOT NULL DEFAULT '',
  `config` TEXT NOT NULL
);

-- inbox
CREATE TABLE `inbox` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `created_ts` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `sender_id` INT NOT NULL,
  `receiver_id` INT NOT NULL,
  `status` TEXT NOT NULL,
  `message` TEXT NOT NULL
);

-- reaction
CREATE TABLE `reaction` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `created_ts` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `creator_id` INT NOT NULL,
  `content_id` VARCHAR(256) NOT NULL,
  `reaction_type` VARCHAR(256) NOT NULL,
  UNIQUE(`creator_id`,`content_id`,`reaction_type`)  
);

-- memo_share
CREATE TABLE `memo_share` (
  `id`         INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `uid`        VARCHAR(255) NOT NULL UNIQUE,
  `memo_id`    INT          NOT NULL,
  `creator_id` INT          NOT NULL,
  `created_ts` BIGINT       NOT NULL DEFAULT (UNIX_TIMESTAMP()),
  `expires_ts` BIGINT       DEFAULT NULL,
  FOREIGN KEY (`memo_id`) REFERENCES `memo`(`id`) ON DELETE CASCADE
);

CREATE INDEX `idx_memo_share_memo_id` ON `memo_share`(`memo_id`);

-- dreaming_runs
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

-- dreaming_replay_queue
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

-- dreaming_insights
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

-- dreaming_insight_evidence
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

-- dreaming_insight_embeddings
CREATE TABLE `dreaming_insight_embeddings` (
  `insight_id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `embedding`  MEDIUMBLOB NOT NULL,
  `created_at` BIGINT NOT NULL,
  FOREIGN KEY (`insight_id`) REFERENCES `dreaming_insights`(`id`) ON DELETE CASCADE
);
