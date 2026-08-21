-- Replaces the memo resource name stored in reaction.content_id with the
-- memo's stable internal ID. The inner join intentionally drops orphaned
-- reactions whose resource name no longer resolves to an existing memo.
CREATE TABLE `reaction_new` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `created_ts` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `creator_id` INT NOT NULL,
  `memo_id` INT NOT NULL,
  `reaction_type` VARCHAR(256) NOT NULL,
  UNIQUE(`creator_id`, `memo_id`, `reaction_type`)
);

INSERT INTO `reaction_new` (`id`, `created_ts`, `creator_id`, `memo_id`, `reaction_type`)
SELECT
  `reaction`.`id`,
  `reaction`.`created_ts`,
  `reaction`.`creator_id`,
  `memo`.`id`,
  `reaction`.`reaction_type`
FROM `reaction`
JOIN `memo` ON `reaction`.`content_id` = CONCAT('memos/', `memo`.`uid`);

DROP TABLE `reaction`;
RENAME TABLE `reaction_new` TO `reaction`;
