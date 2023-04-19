import { render, screen } from "@testing-library/react";
import Memo from "@/components/Memo";
import { BrowserRouter } from "react-router-dom";
import { Provider } from "react-redux";
import store from "@/store";
import { setUser } from "@/store/reducer/user";

describe("Memo", () => {
  it("Memo should render the info of memo", () => {
    const user: User = {
      id: 1,
      createdTs: 0 as TimeStamp,
      updatedTs: 0 as TimeStamp,
      rowStatus: "NORMAL" as RowStatus,
      username: "test",
      role: "HOST" as UserRole,
      email: "test@gmail.com",
      nickname: "test user",
      openId: "",
      avatarUrl: "",
      userSettingList: [],
      setting: {
        locale: "en",
        appearance: "system",
        memoVisibility: "PUBLIC" as Visibility,
      } as Setting,
      localSetting: {
        enableDoubleClickEditing: true,
        dailyReviewTimeOffset: 1,
        enableAutoCollapse: true,
      } as LocalSetting,
    };
    store.dispatch(setUser(user));
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
