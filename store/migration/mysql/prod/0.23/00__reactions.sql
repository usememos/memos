UPDATE `reaction` SET `reaction_type` = '👍' WHERE `reaction_type` = 'THUMBS_UP';
UPDATE `reaction` SET `reaction_type` = '👎' WHERE `reaction_type` = 'THUMBS_DOWN';
UPDATE `reaction` SET `reaction_type` = '💛' WHERE `reaction_type` = 'HEART';
UPDATE `reaction` SET `reaction_type` = '🔥' WHERE `reaction_type` = 'FIRE';
UPDATE `reaction` SET `reaction_type` = '👏' WHERE `reaction_type` = 'CLAPPING_HANDS';
UPDATE `reaction` SET `reaction_type` = '😂' WHERE `reaction_type` = 'LAUGH';
UPDATE `reaction` SET `reaction_type` = '👌' WHERE `reaction_type` = 'OK_HAND';
UPDATE `reaction` SET `reaction_type` = '🚀' WHERE `reaction_type` = 'ROCKET';
UPDATE `reaction` SET `reaction_type` = '👀' WHERE `reaction_type` = 'EYES';
UPDATE `reaction` SET `reaction_type` = '🤔' WHERE `reaction_type` = 'THINKING_FACE';
UPDATE `reaction` SET `reaction_type` = '🤡' WHERE `reaction_type` = 'CLOWN_FACE';
UPDATE `reaction` SET `reaction_type` = '❓' WHERE `reaction_type` = 'QUESTION_MARK';

INSERT INTO `system_setting` (`name`, `value`, `description`)
VALUES (
  'MEMO_RELATED',
  '{"contentLengthLimit":8192,"reactions":["👍","👎","💛","🔥","👏","😂","👌","🚀","👀","🤔","🤡","❓"]}',
  ''
)
ON DUPLICATE KEY UPDATE
value =
  JSON_SET(
    value,
    '$.reactions',
    JSON_ARRAY('👍', '👎', '💛', '🔥', '👏', '😂', '👌', '🚀', '👀', '🤔', '🤡', '❓')
  );

ALTER TABLE
    memo
ADD
    COLUMN nest INT NOT NULL DEFAULT 0;

CREATE TABLE nest (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `uid` VARCHAR(256) NOT NULL,
  `creator_id` INT NOT NULL,
  `created_ts` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_ts` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `row_status` VARCHAR(256) NOT NULL DEFAULT 'NORMAL'
);

INSERT INTO
    nest (uid, creator_id)
SELECT
    'Personal', id
FROM
    user;