INSERT INTO
  user (
    `id`,
    `username`,
    `role`,
    `email`,
    `nickname`,
    `password_hash`
  )
VALUES
  (
    101,
    'demohero',
    'HOST',
    'demo@usememos.com',
    'Demo Hero',
    -- raw password: secret
    '$2a$14$ajq8Q7fbtFRQvXpdCq7Jcuy.Rx1h/L4J60Otx.gyNLbAYctGMJ9tK'
  );

INSERT INTO
  user (
    `id`,
    `username`,
    `role`,
    `email`,
    `nickname`,
    `password_hash`
  )
VALUES
  (
    102,
    'jack',
    'USER',
    'jack@usememos.com',
    'Jack',
    -- raw password: secret
    '$2a$14$ajq8Q7fbtFRQvXpdCq7Jcuy.Rx1h/L4J60Otx.gyNLbAYctGMJ9tK'
  );

INSERT INTO
  user (
    `id`,
    `row_status`,
    `username`,
    `role`,
    `email`,
    `nickname`,
    `password_hash`
  )
VALUES
  (
    103,
    'ARCHIVED',
    'bob',
    'USER',
    'bob@usememos.com',
    'Bob',
    -- raw password: secret
    '$2a$14$ajq8Q7fbtFRQvXpdCq7Jcuy.Rx1h/L4J60Otx.gyNLbAYctGMJ9tK'
  );