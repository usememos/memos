INSERT
  OR IGNORE INTO system_setting(name, value)
VALUES
  (
    'local-storage-path',
    '"assets/{timestamp}_{filename}"'
  );