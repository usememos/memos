-- drop all tables first
DROP TABLE IF EXISTS `migration_history`;
DROP TABLE IF EXISTS `system_setting`;
DROP TABLE IF EXISTS `user`;
DROP TABLE IF EXISTS `user_setting`;
DROP TABLE IF EXISTS `memo`;
DROP TABLE IF EXISTS `memo_organizer`;
DROP TABLE IF EXISTS `memo_relation`;
DROP TABLE IF EXISTS `resource`;
DROP TABLE IF EXISTS `tag`;
DROP TABLE IF EXISTS `activity`;
DROP TABLE IF EXISTS `storage`;
DROP TABLE IF EXISTS `idp`;

-- migration_history
CREATE TABLE `migration_history` (
  `version` varchar(255) NOT NULL,
  `created_ts` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`version`)
);

-- system_setting
CREATE TABLE `system_setting` (
  `name` varchar(255) NOT NULL,
  `value` text NOT NULL,
  `description` text NOT NULL,
  PRIMARY KEY (`name`)
);

-- user
CREATE TABLE `user` (
  `id` int NOT NULL AUTO_INCREMENT,
  `created_ts` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_ts` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
CREATE TABLE `user_setting` (
  `user_id` int NOT NULL,
  `key` varchar(255) NOT NULL,
  `value` text NOT NULL,
  UNIQUE KEY `user_id` (`user_id`,`key`)
);

-- memo
CREATE TABLE `memo` (
  `id` int NOT NULL AUTO_INCREMENT,
  `creator_id` int NOT NULL,
  `created_ts` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_ts` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
CREATE TABLE `memo_organizer` (
  `memo_id` int NOT NULL,
  `user_id` int NOT NULL,
  `pinned` int NOT NULL DEFAULT '0',
  UNIQUE KEY `memo_id` (`memo_id`,`user_id`),
  CONSTRAINT `memo_organizer_chk_1` CHECK ((`pinned` in (0,1)))
);

-- memo_relation
CREATE TABLE `memo_relation` (
  `memo_id` int NOT NULL,
  `related_memo_id` int NOT NULL,
  `type` varchar(256) NOT NULL,
  UNIQUE KEY `memo_id` (`memo_id`,`related_memo_id`,`type`)
);

-- resource
CREATE TABLE `resource` (
  `id` int NOT NULL AUTO_INCREMENT,
  `creator_id` int NOT NULL,
  `created_ts` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_ts` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
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

-- tag
CREATE TABLE `tag` (
  `name` varchar(255) NOT NULL,
  `creator_id` int NOT NULL,
  UNIQUE KEY `name` (`name`,`creator_id`)
);

-- activity
CREATE TABLE `activity` (
  `id` int NOT NULL AUTO_INCREMENT,
  `creator_id` int NOT NULL,
  `created_ts` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `type` varchar(255) NOT NULL DEFAULT '',
  `level` varchar(255) NOT NULL DEFAULT 'INFO',
  `payload` text NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `activity_chk_1` CHECK ((`level` in (_utf8mb4'INFO',_utf8mb4'WARN',_utf8mb4'ERROR')))
);

-- storage
CREATE TABLE `storage` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(256) NOT NULL,
  `type` varchar(256) NOT NULL,
  `config` text NOT NULL,
  PRIMARY KEY (`id`)
);

-- idp
CREATE TABLE `idp` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` text NOT NULL,
  `type` text NOT NULL,
  `identifier_filter` varchar(256) NOT NULL DEFAULT '',
  `config` text NOT NULL,
  PRIMARY KEY (`id`)
);
