ALTER TABLE memos_prod.system_setting 
MODIFY COLUMN `value` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL;

ALTER TABLE memos_prod.reaction 
MODIFY COLUMN `reaction_type` varchar(256) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL;