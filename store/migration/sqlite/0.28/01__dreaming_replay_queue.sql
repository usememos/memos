-- dreaming_replay_queue is the hippocampal replay buffer.
-- It records chunks that are worth reprocessing through the dreaming pipeline,
-- rather than having the pipeline scan all chunks on every run.
CREATE TABLE dreaming_replay_queue (
  id                       TEXT NOT NULL PRIMARY KEY,
  chunk_id                 TEXT NOT NULL,
  session_key              TEXT NOT NULL,
  activation_score         REAL NOT NULL DEFAULT 0,
  novelty_score            REAL NOT NULL DEFAULT 0,
  rehearsal_count          INTEGER NOT NULL DEFAULT 0,
  first_queued_at          INTEGER NOT NULL,
  last_replayed_at         INTEGER,
  queue_reason             TEXT NOT NULL DEFAULT '',
  status                   TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'done', 'evicted')) DEFAULT 'queued',
  spindle_tag              TEXT NOT NULL CHECK (spindle_tag IN ('none', 'weak', 'strong')) DEFAULT 'none',
  dreaming_candidate_score REAL NOT NULL DEFAULT 0,
  candidate_kind_hint      TEXT
);

CREATE INDEX idx_dreaming_rq_chunk_id ON dreaming_replay_queue(chunk_id);
CREATE INDEX idx_dreaming_rq_session_key ON dreaming_replay_queue(session_key);
CREATE INDEX idx_dreaming_rq_status ON dreaming_replay_queue(status);
CREATE INDEX idx_dreaming_rq_activation ON dreaming_replay_queue(activation_score DESC);
