import { act, renderHook } from "@testing-library/react-hooks";
import { useResourceStore } from "@/store/module/resource";
import { describe, expect, it } from "vitest";
import { Provider } from "react-redux";
import { rest } from "msw";
import { setupServer } from "msw/node";
import { getResourceDataSet } from "./data";

import { configureStore } from "@reduxjs/toolkit";
import resourceReducer from "@/store/reducer/resource";
const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("useResourceStore", async () => {
  for (const getResourceData of getResourceDataSet.dataset) {
    it("resource store", async () => {
      const store = configureStore({
        reducer: {
          resource: resourceReducer,
        },
      });

      const wrapper = ({ children }: any) => <Provider store={store}>{children}</Provider>;

      const { result } = renderHook(() => useResourceStore(), { wrapper });

      await server.use(
        rest.get("/api/resource", (req: any, res: any, ctx: any) => {
          return res(ctx.status(200), ctx.json(getResourceData.data));
        })
      );

      await act(async () => {
        expect(await result.current.fetchResourceList()).toStrictEqual(getResourceData.expect);
      });
    });
  }
});
