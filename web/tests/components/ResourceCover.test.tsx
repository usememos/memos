import ResourceCover from "../../src/components/ResourceCover";
import renderer from "react-test-renderer";

describe("ResourceItem snapshot", () => {
  it("render ResourceCover", () => {
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
    const tree = renderer.create(<ResourceCover resource={resource} />).toJSON();
    expect(tree).toMatchSnapshot();
  });
});
