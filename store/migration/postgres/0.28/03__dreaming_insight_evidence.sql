-- dreaming_insight_evidence links insights to the source chunks that informed them.
-- This enables query-time "supporting evidence" returns and future reinforcement logic.
CREATE TABLE dreaming_insight_evidence (
  id            TEXT NOT NULL PRIMARY KEY,
  insight_id    TEXT NOT NULL,
  chunk_id      TEXT NOT NULL,
  session_key   TEXT NOT NULL DEFAULT '',
  relevance     DOUBLE PRECISION NOT NULL DEFAULT 0,
  evidence_role TEXT NOT NULL CHECK (evidence_role IN ('primary', 'supporting', 'conflicting')) DEFAULT 'supporting',
  created_at    BIGINT NOT NULL,
  FOREIGN KEY (insight_id) REFERENCES dreaming_insights(id) ON DELETE CASCADE
);

CREATE INDEX idx_dreaming_iev_insight_id ON dreaming_insight_evidence(insight_id);
CREATE INDEX idx_dreaming_iev_chunk_id ON dreaming_insight_evidence(chunk_id);
