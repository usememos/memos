interface Duration {
  from: number;
  to: number;
}

interface Query {
  tag: string;
  duration: Duration | null;
  type: MemoSpecType | "";
  text: string;
  shortcutId: string;
}

type AppRouter = "/" | "/signin" | "/recycle" | "/setting";

interface AppLocation {
  pathname: AppRouter;
  hash: string;
  query: Query;
}
