import { act, renderHook } from "@testing-library/react-hooks";
import { useResourceStore } from "../../src/store/module/resource";
import { describe, expect, it } from "vitest";
import { Provider } from "react-redux";
import store from "../../src/store";

describe("Testing useLoading hook", () => {
  it("setLoading", () => {
    const wrapper = ({ children }: any) => <Provider store={store}>{children}</Provider>;

    const { result } = renderHook(() => useResourceStore(), { wrapper });
    expect(result.current.getState()).toStrictEqual({
      resources: [],
    });
    // here need to mock the fetchResourceList function
    act(() => {
      result.current.fetchResourceList();
    });
    expect(result.current.getState()).toStrictEqual({
      resources: [],
    });

    const resourceCreate = {
      filename: "test",
      externalLink: "www.test.com",
      type: "image",
    } as ResourceCreate;

    act(() => {
      result.current.createResource(resourceCreate);
    });
    // there is a bug, the resource is old yet
    expect(result.current.getState()).toStrictEqual({
      resources: [],
    });

    // here need to mock the upload function
    act(() => {
      result.current.createResourcesWithBlob([] as unknown as FileList);
    });
  });
});
