-- Make user.email an optional, canonical, instance-unique attribute.
ALTER TABLE "user"
  ALTER COLUMN email DROP NOT NULL,
  ALTER COLUMN email DROP DEFAULT,
  ALTER COLUMN email TYPE TEXT COLLATE "C";

-- Canonical form: trimmed and lowercased.
UPDATE "user" SET email = LOWER(TRIM(email));

-- Empty values, values without an '@', and values carrying display-name
-- syntax or interior whitespace mean no address.
UPDATE "user" SET email = NULL
WHERE email = '' OR email NOT LIKE '%@%' OR email LIKE '%<%' OR email LIKE '%>%' OR email LIKE '% %';

-- For each address held by more than one account, the oldest account keeps it.
UPDATE "user"
SET email = NULL
WHERE email IS NOT NULL
  AND id NOT IN (SELECT MIN(id) FROM "user" WHERE email IS NOT NULL GROUP BY email);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_email ON "user" (email);
