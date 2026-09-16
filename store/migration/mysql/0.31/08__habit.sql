CREATE TABLE `habit` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `uid` VARCHAR(256) NOT NULL UNIQUE,
  `creator_id` INT NOT NULL,
  `created_ts` BIGINT NOT NULL DEFAULT (UNIX_TIMESTAMP()),
  `updated_ts` BIGINT NOT NULL DEFAULT (UNIX_TIMESTAMP()),
  `title` TEXT NOT NULL,
  `identity` TEXT NOT NULL,
  `cue` TEXT NOT NULL,
  `environment` TEXT NOT NULL,
  `minimum_value` INT NOT NULL CHECK (`minimum_value` > 0),
  `target_value` INT NOT NULL CHECK (`target_value` >= `minimum_value`),
  `start_date` VARCHAR(10) NOT NULL
);
CREATE INDEX `idx_habit_creator_id` ON `habit` (`creator_id`, `id`);
CREATE TABLE `habit_log` (
  `habit_id` INT NOT NULL,
  `log_date` VARCHAR(10) NOT NULL,
  `value` INT NOT NULL CHECK (`value` >= 0),
  `created_ts` BIGINT NOT NULL DEFAULT (UNIX_TIMESTAMP()),
  `updated_ts` BIGINT NOT NULL DEFAULT (UNIX_TIMESTAMP()),
  PRIMARY KEY (`habit_id`, `log_date`),
  FOREIGN KEY (`habit_id`) REFERENCES `habit`(`id`) ON DELETE CASCADE
);
