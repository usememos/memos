import { createConnectRouter, type ConnectRouter } from "@connectrpc/connect";
import {
  universalServerRequestFromFetch,
  universalServerResponseToFetch,
} from "@connectrpc/connect/protocol";

export type RegisterFn = (router: ConnectRouter) => void;

// Adapts a connect-es router to the Workers fetch API. Returns undefined when
// no RPC route matches so the caller can fall through to other handlers.
export function createConnectFetchHandler(register: RegisterFn) {
  const router = createConnectRouter();
  register(router);
  const paths = new Map(router.handlers.map((h) => [h.requestPath, h]));

  return async (request: Request): Promise<Response | undefined> => {
    const url = new URL(request.url);
    const handler = paths.get(url.pathname);
    if (!handler) {
      return undefined;
    }
    const universalResponse = await handler(universalServerRequestFromFetch(request, {}));
    return universalServerResponseToFetch(universalResponse);
  };
}
