-- dreaming_insights_fts is a virtual FTS5 table for full-text search over dream insights.
-- Follows the same pattern as the memo FTS table used elsewhere in memos.
CREATE VIRTUAL TABLE dreaming_insights_fts USING fts5(
  summary,
  kind,
  content='dreaming_insights',
  content_rowid='rowid'
);

-- Triggers to keep dreaming_insights_fts in sync with dreaming_insights.
CREATE TRIGGER dreaming_insights_ai AFTER INSERT ON dreaming_insights BEGIN
  INSERT INTO dreaming_insights_fts(rowid, summary, kind) VALUES (new.rowid, new.summary, new.kind);
END;

CREATE TRIGGER dreaming_insights_ad AFTER DELETE ON dreaming_insights BEGIN
  INSERT INTO dreaming_insights_fts(dreaming_insights_fts, rowid, summary, kind) VALUES('delete', old.rowid, old.summary, old.kind);
END;

CREATE TRIGGER dreaming_insights_au AFTER UPDATE ON dreaming_insights BEGIN
  INSERT INTO dreaming_insights_fts(dreaming_insights_fts, rowid, summary, kind) VALUES('delete', old.rowid, old.summary, old.kind);
  INSERT INTO dreaming_insights_fts(rowid, summary, kind) VALUES (new.rowid, new.summary, new.kind);
END;
