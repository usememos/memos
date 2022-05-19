type ShortcutId = number;

interface Shortcut {
  id: string;

  rowStatus: RowStatus;
  createdTs: TimeStamp;
  updatedTs: TimeStamp;

  title: string;
  payload: string;
}
