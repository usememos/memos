ALTER TABLE `memo` ADD COLUMN `payload_temp` JSON;
UPDATE `memo` SET `payload_temp` = '{}';
ALTER TABLE `memo` CHANGE COLUMN `payload_temp` `payload` JSON NOT NULL;
