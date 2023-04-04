import { render, screen } from "@testing-library/react";
import ResourceCover from "../../src/components/ResourceCover";

describe("ResourceItem", () => {
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
    render(<ResourceCover resource={resource} />);
    screen.debug();
  });
});
