INSERT INTO 
  user (
    `id`, 
    `email`,
    `role`,
    `name`, 
    `open_id`,
    `password_hash`
  )
VALUES
  (
    101, 
    'demo@usememos.com',
    'OWNER',
    'Demo Owner',
    'demo_open_id',
    -- raw password: secret
    '$2a$14$ajq8Q7fbtFRQvXpdCq7Jcuy.Rx1h/L4J60Otx.gyNLbAYctGMJ9tK'
  );

INSERT INTO 
  user (
    `id`, 
    `email`,
    `role`,
    `name`, 
    `open_id`,
    `password_hash`
  )
VALUES
  (
    102, 
    'demo2@usememos.com',
    'USER',
    'Demo User',
    'demo_open_id2',
    -- raw password: secret
    '$2a$14$ajq8Q7fbtFRQvXpdCq7Jcuy.Rx1h/L4J60Otx.gyNLbAYctGMJ9tK'
  );
