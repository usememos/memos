import { createClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import { AIService } from "./types/proto/api/v1/ai_service_pb";
import { AttachmentService } from "./types/proto/api/v1/attachment_service_pb";
import { AuthService } from "./types/proto/api/v1/auth_service_pb";
import { InstanceService } from "./types/proto/api/v1/instance_service_pb";
import { MemoService } from "./types/proto/api/v1/memo_service_pb";
import { ShortcutService } from "./types/proto/api/v1/shortcut_service_pb";
import { UserService } from "./types/proto/api/v1/user_service_pb";

// Authentication is handled entirely by Cloudflare Access in front of the
// Worker: the browser carries the CF_Authorization cookie, so requests only
// need credentials: "include". No tokens, no refresh, no interceptors.
const fetchWithCredentials: typeof globalThis.fetch = (input, init) => {
  return globalThis.fetch(input, {
    ...init,
    credentials: "include",
  });
};

const transport = createConnectTransport({
  baseUrl: window.location.origin,
  useBinaryFormat: true,
  fetch: fetchWithCredentials,
});

// Core service clients
export const instanceServiceClient = createClient(InstanceService, transport);
export const authServiceClient = createClient(AuthService, transport);
export const userServiceClient = createClient(UserService, transport);

// Content service clients
export const memoServiceClient = createClient(MemoService, transport);
export const attachmentServiceClient = createClient(AttachmentService, transport);
export const aiServiceClient = createClient(AIService, transport);
export const shortcutServiceClient = createClient(ShortcutService, transport);
