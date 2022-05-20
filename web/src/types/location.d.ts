interface Duration {
  from: number;
  to: number;
}

interface Query {
  tag: string;
  duration: Duration | null;
  type: MemoSpecType | "";
  text: string;
  shortcutId?: ShortcutId;
}

type AppRouter = "/" | "/signin";

interface AppLocation {
  pathname: AppRouter;
  hash: string;
  query: Query;
}
