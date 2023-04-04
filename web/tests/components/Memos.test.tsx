import { render, screen } from "@testing-library/react";
import Memo from "../../src/components/Memo";
import { BrowserRouter } from "react-router-dom";
import { Provider } from "react-redux";
import store from "../../src/store";
import renderer from "react-test-renderer";

describe("Memo", () => {
  it("render Memo", () => {
    const memo: Memo = {
      id: 123,
      creatorId: 1234,
      createdTs: 0,
      updatedTs: 0,
      rowStatus: "NORMAL" as RowStatus,
      content: "Hello!",
      visibility: "PUBLIC" as Visibility,
      pinned: false,
      creatorName: "test",
      resourceList: [],
    };
    render(
      <Provider store={store}>
        <BrowserRouter>
          <Memo memo={memo} />
        </BrowserRouter>
      </Provider>
    );
    screen.getByText(/Hello!/i);
  });
  it("memo snapshot", () => {
    const memo: Memo = {
      id: 123,
      creatorId: 1234,
      createdTs: 0,
      updatedTs: 0,
      rowStatus: "NORMAL" as RowStatus,
      content: "Hello!",
      visibility: "PUBLIC" as Visibility,
      pinned: false,
      creatorName: "test",
      resourceList: [],
    };
    const tree = renderer
      .create(
        <Provider store={store}>
          <BrowserRouter>
            <Memo memo={memo} />
          </BrowserRouter>
        </Provider>
      )
      .toJSON();
    expect(tree).toMatchSnapshot();
  });
});
