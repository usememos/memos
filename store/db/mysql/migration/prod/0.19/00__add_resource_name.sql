ALTER TABLE `memo` ADD COLUMN `resource_name` VARCHAR(256) NOT NULL AFTER `id`;

UPDATE `memo` SET `resource_name` = uuid();

CREATE UNIQUE INDEX idx_memo_resource_name ON `memo` (`resource_name`);

ALTER TABLE `resource` ADD COLUMN `resource_name` VARCHAR(256) NOT NULL AFTER `id`;

UPDATE `resource` SET `resource_name` = uuid();

CREATE UNIQUE INDEX idx_resource_resource_name ON `resource` (`resource_name`);
