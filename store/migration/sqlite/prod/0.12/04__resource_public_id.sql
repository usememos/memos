ALTER TABLE
  resource
ADD
  COLUMN public_id TEXT NOT NULL DEFAULT '';

CREATE UNIQUE INDEX resource_id_public_id_unique_index ON resource (id, public_id);

UPDATE
  resource
SET
  public_id = printf (
    '%s-%s-%s-%s-%s',
    lower(hex(randomblob(4))),
    lower(hex(randomblob(2))),
    lower(hex(randomblob(2))),
    lower(hex(randomblob(2))),
    lower(hex(randomblob(6)))
  );