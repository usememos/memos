ALTER TABLE `resource` RENAME TO `attachment`;
DROP INDEX IF EXISTS `idx_resource_creator_id`;
CREATE INDEX `idx_attachment_creator_id` ON `attachment` (`creator_id`);
DROP INDEX IF EXISTS `idx_resource_memo_id`;
CREATE INDEX `idx_attachment_memo_id` ON `attachment` (`memo_id`);
