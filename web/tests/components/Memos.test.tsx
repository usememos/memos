import { render, screen } from "@testing-library/react";
import Memo from "@/components/Memo";
import { BrowserRouter } from "react-router-dom";
import { Provider } from "react-redux";
import store from "@/store";
import { setUser } from "@/store/reducer/user";
import { userData } from "../fixtures";

describe("Memo", () => {
  it("Memo should render the info of memo", () => {
    store.dispatch(setUser(userData));
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
});
