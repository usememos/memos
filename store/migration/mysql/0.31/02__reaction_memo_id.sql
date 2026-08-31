-- Replaces the memo resource name stored in reaction.content_id with the
-- memo's stable internal ID. Rows that cannot be resolved are intentionally
-- deleted before memo_id is made non-nullable. Altering the table in place
-- preserves its AUTO_INCREMENT high-water mark.
ALTER TABLE `reaction`
  ADD COLUMN `memo_id` INT DEFAULT NULL AFTER `creator_id`;

UPDATE `reaction`
JOIN `memo` ON `reaction`.`content_id` = CONCAT('memos/', `memo`.`uid`)
SET `reaction`.`memo_id` = `memo`.`id`;

DELETE FROM `reaction` WHERE `memo_id` IS NULL;

ALTER TABLE `reaction`
  DROP INDEX `creator_id`,
  DROP COLUMN `content_id`,
  MODIFY COLUMN `memo_id` INT NOT NULL,
  ADD UNIQUE (`creator_id`, `memo_id`, `reaction_type`);
