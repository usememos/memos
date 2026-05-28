-- Add uid column to idp table
ALTER TABLE `idp` ADD COLUMN `uid` VARCHAR(256) NOT NULL DEFAULT '';

-- Populate uid for existing rows using hex of id as a fallback
UPDATE `idp` SET `uid` = LOWER(LPAD(HEX(`id`), 8, '0')) WHERE `uid` = '';

-- Create unique index on uid
ALTER TABLE `idp` ADD UNIQUE INDEX `idx_idp_uid` (`uid`);
