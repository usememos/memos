import { createChannel, createClientFactory, FetchTransport } from "nice-grpc-web";
import { MemoServiceDefinition } from "./types/proto/api/v2/memo_service";
import { ResourceServiceDefinition } from "./types/proto/api/v2/resource_service";
import { SystemServiceDefinition } from "./types/proto/api/v2/system_service";
import { TagServiceDefinition } from "./types/proto/api/v2/tag_service";
import { UserServiceDefinition } from "./types/proto/api/v2/user_service";

const address = import.meta.env.MODE === "development" ? "http://localhost:8081" : window.location.origin;

const channel = createChannel(
  address,
  FetchTransport({
    credentials: "include",
  })
);

const clientFactory = createClientFactory();

export const userServiceClient = clientFactory.create(UserServiceDefinition, channel);

export const memoServiceClient = clientFactory.create(MemoServiceDefinition, channel);

export const resourceServiceClient = clientFactory.create(ResourceServiceDefinition, channel);

export const systemServiceClient = clientFactory.create(SystemServiceDefinition, channel);

export const tagServiceClient = clientFactory.create(TagServiceDefinition, channel);
