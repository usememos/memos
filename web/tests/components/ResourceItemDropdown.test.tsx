import ResourceItemDropdown from "../../src/components/ResourceItemDropdown";
import renderer from "react-test-renderer";
import { Provider } from "react-redux";
import store from "../../src/store";

describe("ResourceItemDropdown", () => {
  it("ResourceItemDropdown snapshot", () => {
    const resource: Resource = {
      id: 1,
      publicId: "test",
      filename: "filename",
      externalLink: "https://www.google.com",
      size: "test",
      type: "IMAGE",
      createdTs: 0,
      updatedTs: 0,
      linkedMemoAmount: 0,
    };
    const tree = renderer
      .create(
        <Provider store={store}>
          <ResourceItemDropdown resource={resource} />
        </Provider>
      )
      .toJSON();
    expect(tree).toMatchSnapshot();
  });
});
