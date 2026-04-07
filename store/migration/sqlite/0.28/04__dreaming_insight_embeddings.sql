-- dreaming_insight_embeddings stores vector embeddings for dreaming_insights,
-- enabling semantic (vector) recall of insights alongside chunk-based recall.
CREATE TABLE dreaming_insight_embeddings (
  insight_id TEXT NOT NULL PRIMARY KEY,
  embedding  BLOB NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (insight_id) REFERENCES dreaming_insights(id) ON DELETE CASCADE
);
