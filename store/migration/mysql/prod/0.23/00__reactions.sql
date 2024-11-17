-- Set character set and collation to MySQL recommended default
ALTER DATABASE
DEFAULT CHARACTER SET utf8mb4
DEFAULT COLLATE utf8mb4_0900_ai_ci;

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
