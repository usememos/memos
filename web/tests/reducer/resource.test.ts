import reducer, { setResources } from "@/store/reducer/resource";

interface State {
  resources: Resource[];
}

describe("setResources", () => {
  it("setResources should add resource to state", () => {
    const resources = [] as Resource[];
    const setResourcesOutput = reducer(
      { resources } as State,
      setResources([
        {
          id: 1,
          publicId: "test",
          filename: "filename",
          externalLink: "https://www.google.com",
          size: "test",
          type: "IMAGE",
          createdTs: 0,
          updatedTs: 0,
          linkedMemoAmount: 0,
        },
      ] as Resource[])
    );

    const finalState = {
      resources: [
        {
          id: 1,
          publicId: "test",
          filename: "filename",
          externalLink: "https://www.google.com",
          size: "test",
          type: "IMAGE",
          createdTs: 0,
          updatedTs: 0,
          linkedMemoAmount: 0,
        },
      ] as Resource[],
    } as State;

    expect(setResourcesOutput).toEqual(finalState);
  });
});
