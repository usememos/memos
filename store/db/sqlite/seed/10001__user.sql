INSERT INTO
  user (
    `id`,
    `username`,
    `role`,
    `email`,
    `nickname`,
    `password_hash`,
    `description`
  )
VALUES
  (
    101,
    'memos-demo',
    'HOST',
    'demo@usememos.com',
    'Derobot',
    -- raw password: secret
    '$2a$14$ajq8Q7fbtFRQvXpdCq7Jcuy.Rx1h/L4J60Otx.gyNLbAYctGMJ9tK',
    '👋 Welcome to memos.'
  );

INSERT INTO
  user (
    `id`,
    `username`,
    `role`,
    `email`,
    `nickname`,
    `password_hash`,
    `description`
  )
VALUES
  (
    102,
    'jack',
    'USER',
    'jack@usememos.com',
    'Jack',
    -- raw password: secret
    '$2a$14$ajq8Q7fbtFRQvXpdCq7Jcuy.Rx1h/L4J60Otx.gyNLbAYctGMJ9tK',
    'The REAL Jack.'
  );

INSERT INTO
  user (
    `id`,
    `row_status`,
    `username`,
    `role`,
    `email`,
    `nickname`,
    `password_hash`,
    `description`
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
    '$2a$14$ajq8Q7fbtFRQvXpdCq7Jcuy.Rx1h/L4J60Otx.gyNLbAYctGMJ9tK',
    'Sorry, I am busy right now.'
  );