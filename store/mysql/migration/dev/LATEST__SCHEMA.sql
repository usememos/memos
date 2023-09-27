-- activity
CREATE TABLE IF NOT EXISTS `activity` (
  `id` int NOT NULL AUTO_INCREMENT,
  `creator_id` int NOT NULL,
  `created_ts` bigint NOT NULL DEFAULT '0',
  `type` varchar(255) NOT NULL DEFAULT '',
  `level` varchar(255) NOT NULL DEFAULT 'INFO',
  `payload` text NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `activity_chk_1` CHECK ((`level` in (_utf8mb4'INFO',_utf8mb4'WARN',_utf8mb4'ERROR')))
);

-- idp
CREATE TABLE IF NOT EXISTS `idp` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` text NOT NULL,
  `type` text NOT NULL,
  `identifier_filter` varchar(256) NOT NULL DEFAULT '',
  `config` text NOT NULL,
  PRIMARY KEY (`id`)
);

-- memo
CREATE TABLE IF NOT EXISTS `memo` (
  `id` int NOT NULL AUTO_INCREMENT,
  `creator_id` int NOT NULL,
  `created_ts` bigint NOT NULL DEFAULT '0',
  `updated_ts` bigint NOT NULL DEFAULT '0',
  `row_status` varchar(255) NOT NULL DEFAULT 'NORMAL',
  `content` text NOT NULL,
  `visibility` varchar(255) NOT NULL DEFAULT 'PRIVATE',
  PRIMARY KEY (`id`),
  KEY `creator_id` (`creator_id`),
  KEY `visibility` (`visibility`),
  CONSTRAINT `memo_chk_1` CHECK ((`row_status` in (_utf8mb4'NORMAL',_utf8mb4'ARCHIVED'))),
  CONSTRAINT `memo_chk_2` CHECK ((`visibility` in (_utf8mb4'PUBLIC',_utf8mb4'PROTECTED',_utf8mb4'PRIVATE')))
);

-- memo_organizer
CREATE TABLE IF NOT EXISTS `memo_organizer` (
  `memo_id` int NOT NULL,
  `user_id` int NOT NULL,
  `pinned` int NOT NULL DEFAULT '0',
  UNIQUE KEY `memo_id` (`memo_id`,`user_id`),
  CONSTRAINT `memo_organizer_chk_1` CHECK ((`pinned` in (0,1)))
);

-- memo_relation
CREATE TABLE IF NOT EXISTS `memo_relation` (
  `memo_id` int NOT NULL,
  `related_memo_id` int NOT NULL,
  `type` varchar(256) NOT NULL,
  UNIQUE KEY `memo_id` (`memo_id`,`related_memo_id`,`type`)
);

-- migration_history
CREATE TABLE IF NOT EXISTS `migration_history` (
  `version` varchar(255) NOT NULL,
  `created_ts` bigint NOT NULL DEFAULT '0',
  PRIMARY KEY (`version`)
);

-- resource
CREATE TABLE IF NOT EXISTS `resource` (
  `id` int NOT NULL AUTO_INCREMENT,
  `creator_id` int NOT NULL,
  `created_ts` bigint NOT NULL DEFAULT '0',
  `updated_ts` bigint NOT NULL DEFAULT '0',
  `filename` text NOT NULL,
  `blob` blob,
  `external_link` text NOT NULL,
  `type` varchar(255) NOT NULL DEFAULT '',
  `size` int NOT NULL DEFAULT '0',
  `internal_path` varchar(255) NOT NULL DEFAULT '',
  `memo_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `creator_id` (`creator_id`),
  KEY `memo_id` (`memo_id`)
);

-- storage
CREATE TABLE IF NOT EXISTS `storage` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(256) NOT NULL,
  `type` varchar(256) NOT NULL,
  `config` text NOT NULL,
  PRIMARY KEY (`id`)
);

-- system_setting
CREATE TABLE IF NOT EXISTS `system_setting` (
  `name` varchar(255) NOT NULL,
  `value` text NOT NULL,
  `description` text NOT NULL,
  PRIMARY KEY (`name`)
);

-- tag
CREATE TABLE IF NOT EXISTS `tag` (
  `name` varchar(255) NOT NULL,
  `creator_id` int NOT NULL,
  UNIQUE KEY `name` (`name`,`creator_id`)
);

-- user
CREATE TABLE IF NOT EXISTS `user` (
  `id` int NOT NULL AUTO_INCREMENT,
  `created_ts` bigint NOT NULL DEFAULT '0',
  `updated_ts` bigint NOT NULL DEFAULT '0',
  `row_status` varchar(255) NOT NULL DEFAULT 'NORMAL',
  `username` varchar(255) NOT NULL,
  `role` varchar(255) NOT NULL DEFAULT 'USER',
  `email` varchar(255) NOT NULL DEFAULT '',
  `nickname` varchar(255) NOT NULL DEFAULT '',
  `password_hash` varchar(255) NOT NULL,
  `avatar_url` text NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  CONSTRAINT `user_chk_1` CHECK ((`row_status` in (_utf8mb4'NORMAL',_utf8mb4'ARCHIVED'))),
  CONSTRAINT `user_chk_2` CHECK ((`role` in (_utf8mb4'HOST',_utf8mb4'ADMIN',_utf8mb4'USER')))
);

-- user_setting
CREATE TABLE IF NOT EXISTS `user_setting` (
  `user_id` int NOT NULL,
  `key` varchar(255) NOT NULL,
  `value` text NOT NULL,
  UNIQUE KEY `user_id` (`user_id`,`key`)
);


