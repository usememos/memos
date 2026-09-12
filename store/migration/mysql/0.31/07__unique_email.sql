-- Make user.email an optional, canonical, instance-unique attribute.
-- The column is switched to a binary collation before the data repair so
-- that grouping compares bytes rather than whatever the server default
-- collation considers equal.
ALTER TABLE `user`
  MODIFY `email` VARCHAR(256) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL;

-- Canonical form: trimmed and lowercased.
UPDATE `user` SET `email` = LOWER(TRIM(`email`));

-- Empty values, values without an '@', and values carrying display-name
-- syntax or interior whitespace mean no address.
UPDATE `user` SET `email` = NULL
WHERE `email` = '' OR `email` NOT LIKE '%@%' OR `email` LIKE '%<%' OR `email` LIKE '%>%' OR `email` LIKE '% %';

-- For each address held by more than one account, the oldest account keeps it.
-- MySQL cannot read the table being updated in a subquery, so the survivors
-- are materialized through a derived table.
UPDATE `user`
SET `email` = NULL
WHERE `email` IS NOT NULL
  AND `id` NOT IN (
    SELECT `id` FROM (
      SELECT MIN(`id`) AS `id` FROM `user` WHERE `email` IS NOT NULL GROUP BY `email`
    ) AS `keep`
  );

-- MySQL has no CREATE INDEX IF NOT EXISTS; guard through a prepared statement
-- so that re-running this file against a database that already carries the
-- index (a fresh install whose schema version was rewound) is a no-op.
SET @idx_user_email_exists = (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'user' AND index_name = 'idx_user_email'
);
SET @idx_user_email_stmt = IF(
  @idx_user_email_exists = 0,
  'CREATE UNIQUE INDEX `idx_user_email` ON `user` (`email`)',
  'SELECT 1'
);
PREPARE idx_user_email_prepared FROM @idx_user_email_stmt;
EXECUTE idx_user_email_prepared;
DEALLOCATE PREPARE idx_user_email_prepared;
