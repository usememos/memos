-- system_setting
CREATE TABLE system_setting (
  name TEXT NOT NULL PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT NOT NULL
);

-- user
CREATE TABLE "user" (
  id SERIAL PRIMARY KEY,
  created_ts BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
  updated_ts BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
  row_status TEXT NOT NULL DEFAULT 'NORMAL',
  username TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'USER',
  email TEXT NOT NULL DEFAULT '',
  nickname TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  avatar_url TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT ''
);

-- user_setting
CREATE TABLE user_setting (
  user_id INTEGER NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  UNIQUE(user_id, key)
);

-- memo
CREATE TABLE memo (
  id SERIAL PRIMARY KEY,
  uid TEXT NOT NULL UNIQUE,
  creator_id INTEGER NOT NULL,
  created_ts BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
  updated_ts BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
  row_status TEXT NOT NULL DEFAULT 'NORMAL',
  content TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'PRIVATE',
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  payload JSONB NOT NULL DEFAULT '{}'
);

-- memo_relation
CREATE TABLE memo_relation (
  memo_id INTEGER NOT NULL,
  related_memo_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  UNIQUE(memo_id, related_memo_id, type)
);

-- attachment
CREATE TABLE attachment (
  id SERIAL PRIMARY KEY,
  uid TEXT NOT NULL UNIQUE,
  creator_id INTEGER NOT NULL,
  created_ts BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
  updated_ts BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
  filename TEXT NOT NULL,
  blob BYTEA,
  type TEXT NOT NULL DEFAULT '',
  size INTEGER NOT NULL DEFAULT 0,
  memo_id INTEGER DEFAULT NULL,
  storage_type TEXT NOT NULL DEFAULT '',
  reference TEXT NOT NULL DEFAULT '',
  payload TEXT NOT NULL DEFAULT '{}'
);

-- idp
CREATE TABLE idp (
  id SERIAL PRIMARY KEY,
  uid TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  identifier_filter TEXT NOT NULL DEFAULT '',
  config JSONB NOT NULL DEFAULT '{}'
);

-- inbox
CREATE TABLE inbox (
  id SERIAL PRIMARY KEY,
  created_ts BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
  sender_id INTEGER NOT NULL,
  receiver_id INTEGER NOT NULL,
  status TEXT NOT NULL,
  message TEXT NOT NULL
);

-- reaction
CREATE TABLE reaction (
  id SERIAL PRIMARY KEY,
  created_ts BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
  creator_id INTEGER NOT NULL,
  content_id TEXT NOT NULL,
  reaction_type TEXT NOT NULL,
  UNIQUE(creator_id, content_id, reaction_type)
);

-- memo_share
CREATE TABLE memo_share (
  id         SERIAL  PRIMARY KEY,
  uid        TEXT    NOT NULL UNIQUE,
  memo_id    INTEGER NOT NULL,
  creator_id INTEGER NOT NULL,
  created_ts BIGINT  NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
  expires_ts BIGINT  DEFAULT NULL,
  FOREIGN KEY (memo_id) REFERENCES memo(id) ON DELETE CASCADE
);

CREATE INDEX idx_memo_share_memo_id ON memo_share(memo_id);

-- dreaming_runs
CREATE TABLE dreaming_runs (
  id              TEXT NOT NULL PRIMARY KEY,
  run_type        TEXT NOT NULL CHECK (run_type IN ('micro', 'major', 'manual')),
  status          TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'cancelled')) DEFAULT 'running',
  started_at      BIGINT NOT NULL,
  finished_at     BIGINT,
  lock_holder     TEXT NOT NULL DEFAULT '',
  error_message   TEXT NOT NULL DEFAULT '',
  stats_json      TEXT NOT NULL DEFAULT '{}',
  phase           TEXT NOT NULL DEFAULT ''
);

-- dreaming_replay_queue
CREATE TABLE dreaming_replay_queue (
  id                       TEXT NOT NULL PRIMARY KEY,
  chunk_id                 TEXT NOT NULL,
  session_key              TEXT NOT NULL,
  activation_score         DOUBLE PRECISION NOT NULL DEFAULT 0,
  novelty_score            DOUBLE PRECISION NOT NULL DEFAULT 0,
  rehearsal_count          INTEGER NOT NULL DEFAULT 0,
  first_queued_at          BIGINT NOT NULL,
  last_replayed_at         BIGINT,
  queue_reason             TEXT NOT NULL DEFAULT '',
  status                   TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'done', 'evicted')) DEFAULT 'queued',
  spindle_tag              TEXT NOT NULL CHECK (spindle_tag IN ('none', 'weak', 'strong')) DEFAULT 'none',
  dreaming_candidate_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  candidate_kind_hint      TEXT
);

CREATE INDEX idx_dreaming_rq_chunk_id ON dreaming_replay_queue(chunk_id);
CREATE INDEX idx_dreaming_rq_session_key ON dreaming_replay_queue(session_key);
CREATE INDEX idx_dreaming_rq_status ON dreaming_replay_queue(status);
CREATE INDEX idx_dreaming_rq_activation ON dreaming_replay_queue(activation_score DESC);

-- dreaming_insights
CREATE TABLE dreaming_insights (
  id                 TEXT NOT NULL PRIMARY KEY,
  summary            TEXT NOT NULL,
  kind               TEXT NOT NULL DEFAULT '',
  phase              TEXT NOT NULL CHECK (phase IN ('light', 'deep', 'rem', 'forgetting')) DEFAULT 'light',
  memory_class       TEXT NOT NULL CHECK (memory_class IN ('consolidated', 'associative')) DEFAULT 'consolidated',
  status             TEXT NOT NULL CHECK (status IN ('active', 'archived', 'merged')) DEFAULT 'active',
  confidence         DOUBLE PRECISION NOT NULL DEFAULT 0,
  salience_score     DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  retrieval_priority DOUBLE PRECISION NOT NULL DEFAULT 0,
  decay_factor       DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  support_count      INTEGER NOT NULL DEFAULT 0,
  created_at         BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
  updated_at         BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
  last_reinforced_at BIGINT,
  merged_into        TEXT,
  creator_id         INTEGER NOT NULL DEFAULT 1,
  UNIQUE(summary, kind, phase)
);

CREATE INDEX idx_dreaming_ins_memory_class ON dreaming_insights(memory_class);
CREATE INDEX idx_dreaming_ins_status ON dreaming_insights(status);
CREATE INDEX idx_dreaming_ins_retrieval_priority ON dreaming_insights(retrieval_priority DESC);
CREATE INDEX idx_dreaming_ins_created_at ON dreaming_insights(created_at);
CREATE INDEX idx_dreaming_ins_kind ON dreaming_insights(kind);

-- dreaming_insight_evidence
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

-- dreaming_insight_embeddings
CREATE TABLE dreaming_insight_embeddings (
  insight_id TEXT NOT NULL PRIMARY KEY,
  embedding  BYTEA NOT NULL,
  created_at BIGINT NOT NULL,
  FOREIGN KEY (insight_id) REFERENCES dreaming_insights(id) ON DELETE CASCADE
);
