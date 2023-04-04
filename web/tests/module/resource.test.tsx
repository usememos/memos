import { act, renderHook } from "@testing-library/react-hooks";
import { useResourceStore } from "../../src/store/module/resource";
import { describe, expect, it } from "vitest";
import { Provider } from "react-redux";
import store from "../../src/store";
import { rest } from "msw";
import { setupServer } from "msw/node";

const server = setupServer(
  rest.post("/api/resource", (req: any, res: any, ctx: any) => {
    return res(
      ctx.status(200),
      ctx.json({
        data: {
          filename: "test",
          externalLink: "www.test.com",
          type: "image",
          createdTs: 1680604075,
          updatedTs: 1680604075,
        },
      })
    );
  }),
  rest.get("/api/resource", (req: any, res: any, ctx: any) => {
    return res(
      ctx.status(200),
      ctx.json({
        data: [
          {
            id: 3,
            creatorId: 101,
            createdTs: 1680604140,
            updatedTs: 1680604140,
            filename: "11111wc_20230330_d20230402.mp4",
            internalPath: "/usr/local/memos/11111wc_20230330_d20230402.mp4",
            externalLink: "",
            type: "video/mp4",
            size: 3639822,
            linkedMemoAmount: 1,
          },
          {
            id: 2,
            creatorId: 101,
            createdTs: 1680604075,
            updatedTs: 1680604075,
            filename: "ChatGPT-18-23-49.jpg",
            internalPath: "/usr/local/memos/ChatGPT-18-23-49.jpg",
            externalLink: "",
            type: "image/jpeg",
            size: 546179,
            linkedMemoAmount: 1,
          },
        ],
      })
    );
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("Testing module resource hook", () => {
  it("resource store", async () => {
    const wrapper = ({ children }: any) => <Provider store={store}>{children}</Provider>;

    const { result } = renderHook(() => useResourceStore(), { wrapper });
    expect(result.current.getState()).toStrictEqual({
      resources: [],
    });

    let httpresult: any;

    await act(async () => {
      httpresult = await result.current.fetchResourceList();
      expect(httpresult).toStrictEqual([
        {
          id: 3,
          creatorId: 101,
          createdTs: 1680604140000,
          updatedTs: 1680604140000,
          filename: "11111wc_20230330_d20230402.mp4",
          internalPath: "/usr/local/memos/11111wc_20230330_d20230402.mp4",
          externalLink: "",
          type: "video/mp4",
          size: 3639822,
          linkedMemoAmount: 1,
        },
        {
          id: 2,
          creatorId: 101,
          createdTs: 1680604075000,
          updatedTs: 1680604075000,
          filename: "ChatGPT-18-23-49.jpg",
          internalPath: "/usr/local/memos/ChatGPT-18-23-49.jpg",
          externalLink: "",
          type: "image/jpeg",
          size: 546179,
          linkedMemoAmount: 1,
        },
      ]);
    });

    const resourceCreate = {
      filename: "test",
      externalLink: "www.test.com",
      type: "image",
    } as ResourceCreate;

    await act(async () => {
      await result.current.createResource(resourceCreate);
    });
    expect(result.current.getState().resources.length).toBe(3);
  });
});
