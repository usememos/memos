-- system_setting
CREATE TABLE system_setting (
  name TEXT NOT NULL,
  value TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  UNIQUE(name)
);