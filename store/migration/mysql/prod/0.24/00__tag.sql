-- Create tag table for storing memo tag metadata
CREATE TABLE `tag` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `created_ts` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_ts` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `creator_id` INT NOT NULL,
  `tag_hash` VARCHAR(255) NOT NULL,
  `tag_name` VARCHAR(255) NOT NULL DEFAULT '',
  `emoji` VARCHAR(255) NOT NULL DEFAULT '',
  `pinned_ts` TIMESTAMP NULL,
  UNIQUE(`creator_id`,`tag_hash`)
);
