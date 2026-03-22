ALTER TABLE `memo` ADD COLUMN `tags_temp` JSON;
UPDATE `memo` SET `tags_temp` = '[]';
ALTER TABLE `memo` CHANGE COLUMN `tags_temp` `tags` JSON NOT NULL;
