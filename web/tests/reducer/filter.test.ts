import reducer, { setFilter } from "@/store/reducer/filter";

interface Duration {
  from: number;
  to: number;
}

interface State {
  tag?: string;
  duration?: Duration;
  type?: MemoSpecType;
  text?: string;
  shortcutId?: ShortcutId;
  visibility?: Visibility;
}

describe("setFilter", () => {
  it("setFilter should add filter to state", () => {
    const setFilterOutput = reducer({} as State, setFilter({ tag: "学习" }));

    const finalState = {
      tag: "学习",
    } as State;

    expect(setFilterOutput).toEqual(finalState);
  });
});
