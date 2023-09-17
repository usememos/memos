import { createChannel, createClientFactory, FetchTransport } from "nice-grpc-web";
import { UserServiceDefinition } from "./types/proto-grpcweb/api/v2/user_service";

const address = import.meta.env.MODE === "development" ? "http://localhost:8081" : window.location.origin;

const channel = createChannel(
  address,
  FetchTransport({
    credentials: "include",
  })
);

const clientFactory = createClientFactory();

export const userServiceClient = clientFactory.create(UserServiceDefinition, channel);
