type ShortcutId = number;

interface Shortcut {
  id: ShortcutId;

  rowStatus: RowStatus;
  createdTs: TimeStamp;
  updatedTs: TimeStamp;

  title: string;
  payload: string;
}
