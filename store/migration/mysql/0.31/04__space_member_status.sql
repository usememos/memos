ALTER TABLE `space_member`
  ADD COLUMN `status` VARCHAR(256) NULL AFTER `user_id`;

UPDATE `space_member`
SET `status` = 'ACTIVE';

ALTER TABLE `space_member`
  MODIFY COLUMN `status` VARCHAR(256) NOT NULL;
