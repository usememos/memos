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
DROP TABLE IF EXISTS `inbox`;

-- migration_history
CREATE TABLE `migration_history` (
  `version` VARCHAR(255) NOT NULL PRIMARY KEY,
  `created_ts` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- system_setting
CREATE TABLE `system_setting` (
  `name` VARCHAR(255) NOT NULL PRIMARY KEY,
  `value` TEXT NOT NULL,
  `description` TEXT NOT NULL
);

-- user
CREATE TABLE `user` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `created_ts` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_ts` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `row_status` VARCHAR(255) NOT NULL DEFAULT 'NORMAL',
  `username` VARCHAR(255) NOT NULL UNIQUE,
  `role` VARCHAR(255) NOT NULL DEFAULT 'USER',
  `email` VARCHAR(255) NOT NULL DEFAULT '',
  `nickname` VARCHAR(255) NOT NULL DEFAULT '',
  `password_hash` VARCHAR(255) NOT NULL,
  `avatar_url` TEXT NOT NULL
);

-- user_setting
CREATE TABLE `user_setting` (
  `user_id` INT NOT NULL,
  `key` VARCHAR(255) NOT NULL,
  `value` TEXT NOT NULL,
  UNIQUE(`user_id`,`key`)
);

-- memo
CREATE TABLE `memo` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `creator_id` INT NOT NULL,
  `created_ts` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_ts` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `row_status` VARCHAR(255) NOT NULL DEFAULT 'NORMAL',
  `content` TEXT NOT NULL,
  `visibility` VARCHAR(255) NOT NULL DEFAULT 'PRIVATE'
);

-- memo_organizer
CREATE TABLE `memo_organizer` (
  `memo_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `pinned` INT NOT NULL DEFAULT '0',
  UNIQUE(`memo_id`,`user_id`)
);

-- memo_relation
CREATE TABLE `memo_relation` (
  `memo_id` INT NOT NULL,
  `related_memo_id` INT NOT NULL,
  `type` VARCHAR(256) NOT NULL,
  UNIQUE(`memo_id`,`related_memo_id`,`type`)
);

-- resource
CREATE TABLE `resource` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `creator_id` INT NOT NULL,
  `created_ts` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_ts` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `filename` TEXT NOT NULL,
  `blob` MEDIUMBLOB,
  `external_link` TEXT NOT NULL,
  `type` VARCHAR(255) NOT NULL DEFAULT '',
  `size` INT NOT NULL DEFAULT '0',
  `internal_path` VARCHAR(255) NOT NULL DEFAULT '',
  `memo_id` INT DEFAULT NULL
);

-- tag
CREATE TABLE `tag` (
  `name` VARCHAR(255) NOT NULL,
  `creator_id` INT NOT NULL,
  UNIQUE(`name`,`creator_id`)
);

-- activity
CREATE TABLE `activity` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `creator_id` INT NOT NULL,
  `created_ts` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `type` VARCHAR(255) NOT NULL DEFAULT '',
  `level` VARCHAR(255) NOT NULL DEFAULT 'INFO',
  `payload` TEXT NOT NULL
);

-- storage
CREATE TABLE `storage` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(256) NOT NULL,
  `type` VARCHAR(256) NOT NULL,
  `config` TEXT NOT NULL
);

-- idp
CREATE TABLE `idp` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
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
