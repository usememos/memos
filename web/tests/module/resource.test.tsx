import { act, renderHook } from "@testing-library/react-hooks";
import { useResourceStore } from "../../src/store/module/resource";
import { describe, expect, it } from "vitest";
import { Provider } from "react-redux";
import { rest } from "msw";
import { setupServer } from "msw/node";
import { getResourceDataSet } from "./data";

import { configureStore } from "@reduxjs/toolkit";
import resourceReducer from "../../src/store/reducer/resource";
const server = setupServer();
// rest.get("/api/resource", (req: any, res: any, ctx: any) => {
//   return res(
//     ctx.status(200),
//     ctx.json({
//       data: [
//         {
//           id: 3,
//           creatorId: 101,
//           createdTs: 1680604140,
//           updatedTs: 1680604140,
//           filename: "11111wc_20230330_d20230402.mp4",
//           internalPath: "/usr/local/memos/11111wc_20230330_d20230402.mp4",
//           externalLink: "",
//           type: "video/mp4",
//           size: 3639822,
//           linkedMemoAmount: 1,
//         },
//         {
//           id: 2,
//           creatorId: 101,
//           createdTs: 1680604075,
//           updatedTs: 1680604075,
//           filename: "ChatGPT-18-23-49.jpg",
//           internalPath: "/usr/local/memos/ChatGPT-18-23-49.jpg",
//           externalLink: "",
//           type: "image/jpeg",
//           size: 546179,
//           linkedMemoAmount: 1,
//         },
//       ],
//     })
//   );
// })

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("Testing module useResourceStore hook", async () => {
  for (const getResourceData of getResourceDataSet.dataset) {
    it("resource store", async () => {
      const store = configureStore({
        reducer: {
          resource: resourceReducer,
        },
      });

      console.log(store.getState());
      const wrapper = ({ children }: any) => <Provider store={store}>{children}</Provider>;

      // to clean the state of the store
      const { result } = renderHook(() => useResourceStore(), { wrapper });

      // there is a but ,the state is not updated
      // expect(result.current.getState()).toStrictEqual({
      //   resources: [],
      // });

      await server.use(
        rest.get("/api/resource", (req: any, res: any, ctx: any) => {
          return res(ctx.status(200), ctx.json(getResourceData.data));
        })
      );

      act(async () => {
        expect(await result.current.fetchResourceList()).toStrictEqual(getResourceData.expect);
      });
    });
  }
});
