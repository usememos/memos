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
    const setFilterOutputState1 = reducer({} as State, setFilter({ tag: "study" }));

    expect(setFilterOutputState1).toEqual({
      tag: "study",
    });

    const setFilterOutputState2 = reducer(setFilterOutputState1 as State, setFilter({ text: "content" }));

    expect(setFilterOutputState2).toEqual({
      tag: "study",
      text: "content",
    });

    const setFilterOutputState3 = reducer(setFilterOutputState2 as State, setFilter({ visibility: "PUBLIC" }));

    expect(setFilterOutputState3).toEqual({
      tag: "study",
      text: "content",
      visibility: "PUBLIC",
    });

    const setFilterOutputState4 = reducer(setFilterOutputState3 as State, setFilter({ tag: "learn" }));

    expect(setFilterOutputState4).toEqual({
      tag: "learn",
      text: "content",
      visibility: "PUBLIC",
    });
  });
});
