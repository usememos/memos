-- dreaming_insights is the consolidated output of the dreaming pipeline.
-- Insights are independent from chunks: they represent distilled, promoted knowledge.
-- The memory_class field distinguishes Deep (consolidated) vs REM (associative) origin.
CREATE TABLE dreaming_insights (
  id                 TEXT NOT NULL PRIMARY KEY,
  summary            TEXT NOT NULL,
  kind               TEXT NOT NULL DEFAULT '',
  phase              TEXT NOT NULL CHECK (phase IN ('light', 'deep', 'rem', 'forgetting')) DEFAULT 'light',
  memory_class       TEXT NOT NULL CHECK (memory_class IN ('consolidated', 'associative')) DEFAULT 'consolidated',
  status             TEXT NOT NULL CHECK (status IN ('active', 'archived', 'merged')) DEFAULT 'active',
  confidence         REAL NOT NULL DEFAULT 0,
  salience_score     REAL NOT NULL DEFAULT 1.0,
  retrieval_priority REAL NOT NULL DEFAULT 0,
  decay_factor       REAL NOT NULL DEFAULT 1.0,
  support_count      INTEGER NOT NULL DEFAULT 0,
  created_at         INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at         INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  last_reinforced_at INTEGER,
  merged_into        TEXT,
  creator_id         INTEGER NOT NULL DEFAULT 1,
 UNIQUE(summary, kind, phase)
);

CREATE INDEX idx_dreaming_ins_memory_class ON dreaming_insights(memory_class);
CREATE INDEX idx_dreaming_ins_status ON dreaming_insights(status);
CREATE INDEX idx_dreaming_ins_retrieval_priority ON dreaming_insights(retrieval_priority DESC);
CREATE INDEX idx_dreaming_ins_created_at ON dreaming_insights(created_at);
CREATE INDEX idx_dreaming_ins_kind ON dreaming_insights(kind);
