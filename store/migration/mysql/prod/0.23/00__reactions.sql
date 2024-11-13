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
