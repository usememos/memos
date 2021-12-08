interface DialogProps {
  destroy: FunctionType;
}

interface DialogCallback {
  destroy: FunctionType;
}

interface FormattedMemo extends Model.Memo {
  createdAtStr: string;
  deletedAtStr?: string;
}
