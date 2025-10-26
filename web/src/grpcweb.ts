import { createChannel, createClientFactory, FetchTransport } from "nice-grpc-web";
import { ActivityServiceDefinition } from "./types/proto/api/v1/activity_service";
import { AttachmentServiceDefinition } from "./types/proto/api/v1/attachment_service";
import { AuthServiceDefinition } from "./types/proto/api/v1/auth_service";
import { IdentityProviderServiceDefinition } from "./types/proto/api/v1/idp_service";
import { InboxServiceDefinition } from "./types/proto/api/v1/inbox_service";
import { MemoServiceDefinition } from "./types/proto/api/v1/memo_service";
import { ShortcutServiceDefinition } from "./types/proto/api/v1/shortcut_service";
import { UserServiceDefinition } from "./types/proto/api/v1/user_service";
import { WorkspaceServiceDefinition } from "./types/proto/api/v1/workspace_service";

const channel = createChannel(
  window.location.origin,
  FetchTransport({
    credentials: "include",
  }),
);

const clientFactory = createClientFactory();

export const workspaceServiceClient = clientFactory.create(WorkspaceServiceDefinition, channel);

export const authServiceClient = clientFactory.create(AuthServiceDefinition, channel);

export const userServiceClient = clientFactory.create(UserServiceDefinition, channel);

export const memoServiceClient = clientFactory.create(MemoServiceDefinition, channel);

export const attachmentServiceClient = clientFactory.create(AttachmentServiceDefinition, channel);

export const shortcutServiceClient = clientFactory.create(ShortcutServiceDefinition, channel);

export const inboxServiceClient = clientFactory.create(InboxServiceDefinition, channel);

export const activityServiceClient = clientFactory.create(ActivityServiceDefinition, channel);

export const identityProviderServiceClient = clientFactory.create(IdentityProviderServiceDefinition, channel);
