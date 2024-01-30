import { createChannel, createClientFactory, FetchTransport } from "nice-grpc-web";
import { ActivityServiceDefinition } from "./types/proto/api/v2/activity_service";
import { AuthServiceDefinition } from "./types/proto/api/v2/auth_service";
import { InboxServiceDefinition } from "./types/proto/api/v2/inbox_service";
import { MemoServiceDefinition } from "./types/proto/api/v2/memo_service";
import { ResourceServiceDefinition } from "./types/proto/api/v2/resource_service";
import { TagServiceDefinition } from "./types/proto/api/v2/tag_service";
import { UserServiceDefinition } from "./types/proto/api/v2/user_service";
import { WebhookServiceDefinition } from "./types/proto/api/v2/webhook_service";
import { WorkspaceServiceDefinition } from "./types/proto/api/v2/workspace_service";

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

export const resourceServiceClient = clientFactory.create(ResourceServiceDefinition, channel);

export const tagServiceClient = clientFactory.create(TagServiceDefinition, channel);

export const inboxServiceClient = clientFactory.create(InboxServiceDefinition, channel);

export const activityServiceClient = clientFactory.create(ActivityServiceDefinition, channel);

export const webhookServiceClient = clientFactory.create(WebhookServiceDefinition, channel);
