import { createClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import { ActivityService } from "./types/proto/api/v1/activity_service_pb";
import { AttachmentService } from "./types/proto/api/v1/attachment_service_pb";
import { AuthService } from "./types/proto/api/v1/auth_service_pb";
import { IdentityProviderService } from "./types/proto/api/v1/idp_service_pb";
import { InstanceService } from "./types/proto/api/v1/instance_service_pb";
import { MemoService } from "./types/proto/api/v1/memo_service_pb";
import { ShortcutService } from "./types/proto/api/v1/shortcut_service_pb";
import { UserService } from "./types/proto/api/v1/user_service_pb";

const transport = createConnectTransport({
  baseUrl: window.location.origin,
  // Include cookies in requests for session auth
  fetch: (input, init) => fetch(input, { ...init, credentials: "include" }),
});

export const instanceServiceClient = createClient(InstanceService, transport);

export const authServiceClient = createClient(AuthService, transport);

export const userServiceClient = createClient(UserService, transport);

export const memoServiceClient = createClient(MemoService, transport);

export const attachmentServiceClient = createClient(AttachmentService, transport);

export const shortcutServiceClient = createClient(ShortcutService, transport);

export const activityServiceClient = createClient(ActivityService, transport);

export const identityProviderServiceClient = createClient(IdentityProviderService, transport);
