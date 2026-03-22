ALTER TABLE `memo` ADD COLUMN `resource_name` VARCHAR(256) AFTER `id`;

UPDATE `memo` SET `resource_name` = uuid();

ALTER TABLE `memo` MODIFY COLUMN `resource_name` VARCHAR(256) NOT NULL;

CREATE UNIQUE INDEX idx_memo_resource_name ON `memo` (`resource_name`);

ALTER TABLE `resource` ADD COLUMN `resource_name` VARCHAR(256) AFTER `id`;

UPDATE `resource` SET `resource_name` = uuid();

ALTER TABLE `resource` MODIFY COLUMN `resource_name` VARCHAR(256) NOT NULL;

CREATE UNIQUE INDEX idx_resource_resource_name ON `resource` (`resource_name`);
