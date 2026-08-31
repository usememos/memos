CREATE TABLE `space` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `uid` VARCHAR(256) NOT NULL UNIQUE,
  `title` TEXT NOT NULL,
  `description` TEXT NOT NULL
);

CREATE TABLE `space_member` (
  `space_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `role` VARCHAR(256) NOT NULL CHECK (`role` IN ('ADMIN', 'USER')),
  PRIMARY KEY (`space_id`, `user_id`)
);

ALTER TABLE `memo` ADD COLUMN `space_id` INT DEFAULT NULL;

CREATE INDEX `idx_space_member_user_id` ON `space_member`(`user_id`, `space_id`);
CREATE INDEX `idx_memo_space_id` ON `memo`(`space_id`, `row_status`, `created_ts`, `id`);
CREATE INDEX `idx_memo_relation_related_type_memo`
  ON `memo_relation`(`related_memo_id`, `type`, `memo_id`);
