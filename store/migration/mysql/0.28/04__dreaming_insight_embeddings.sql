-- dreaming_insight_embeddings stores vector embeddings for dreaming_insights,
-- enabling semantic (vector) recall of insights alongside chunk-based recall.
CREATE TABLE `dreaming_insight_embeddings` (
  `insight_id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `embedding`  MEDIUMBLOB NOT NULL,
  `created_at` BIGINT NOT NULL,
  FOREIGN KEY (`insight_id`) REFERENCES `dreaming_insights`(`id`) ON DELETE CASCADE
);
