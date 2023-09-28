INSERT INTO
  user (
    `id`,
    `username`,
    `role`,
    `email`,
    `nickname`,
	`row_status`,
	`avatar_url`,
    `password_hash`
  )
VALUES
  (
    101,
    'memos-demo',
    'HOST',
    'demo@usememos.com',
    'Derobot',
	'NORMAL',
	'',
    -- raw password: secret
    '$2a$14$ajq8Q7fbtFRQvXpdCq7Jcuy.Rx1h/L4J60Otx.gyNLbAYctGMJ9tK'
  ),
  (
    102,
    'jack',
    'USER',
    'jack@usememos.com',
    'Jack',
	'NORMAL',
	'',
    -- raw password: secret
    '$2a$14$ajq8Q7fbtFRQvXpdCq7Jcuy.Rx1h/L4J60Otx.gyNLbAYctGMJ9tK'
  ),
  (
    103,
    'bob',
    'USER',
    'bob@usememos.com',
    'Bob',
    'ARCHIVED',
	'',
    -- raw password: secret
    '$2a$14$ajq8Q7fbtFRQvXpdCq7Jcuy.Rx1h/L4J60Otx.gyNLbAYctGMJ9tK'
  );
