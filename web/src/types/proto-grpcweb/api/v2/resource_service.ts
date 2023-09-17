/* eslint-disable */
import Long from "long";
import _m0 from "protobufjs/minimal";
import { Timestamp } from "../../google/protobuf/timestamp";

export const protobufPackage = "memos.api.v2";

export interface Resource {
  id: number;
  createdTs?: Date | undefined;
  filename: string;
  externalLink: string;
  type: string;
  size: number;
  relatedMemoId?: number | undefined;
}

export interface ListResourcesRequest {
}

export interface ListResourcesResponse {
  resources: Resource[];
}

function createBaseResource(): Resource {
  return { id: 0, createdTs: undefined, filename: "", externalLink: "", type: "", size: 0, relatedMemoId: undefined };
}

export const Resource = {
  encode(message: Resource, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.id !== 0) {
      writer.uint32(8).int32(message.id);
    }
    if (message.createdTs !== undefined) {
      Timestamp.encode(toTimestamp(message.createdTs), writer.uint32(18).fork()).ldelim();
    }
    if (message.filename !== "") {
      writer.uint32(26).string(message.filename);
    }
    if (message.externalLink !== "") {
      writer.uint32(34).string(message.externalLink);
    }
    if (message.type !== "") {
      writer.uint32(42).string(message.type);
    }
    if (message.size !== 0) {
      writer.uint32(48).int64(message.size);
    }
    if (message.relatedMemoId !== undefined) {
      writer.uint32(56).int32(message.relatedMemoId);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Resource {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseResource();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 8) {
            break;
          }

          message.id = reader.int32();
          continue;
        case 2:
          if (tag !== 18) {
            break;
          }

          message.createdTs = fromTimestamp(Timestamp.decode(reader, reader.uint32()));
          continue;
        case 3:
          if (tag !== 26) {
            break;
          }

          message.filename = reader.string();
          continue;
        case 4:
          if (tag !== 34) {
            break;
          }

          message.externalLink = reader.string();
          continue;
        case 5:
          if (tag !== 42) {
            break;
          }

          message.type = reader.string();
          continue;
        case 6:
          if (tag !== 48) {
            break;
          }

          message.size = longToNumber(reader.int64() as Long);
          continue;
        case 7:
          if (tag !== 56) {
            break;
          }

          message.relatedMemoId = reader.int32();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<Resource>): Resource {
    return Resource.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<Resource>): Resource {
    const message = createBaseResource();
    message.id = object.id ?? 0;
    message.createdTs = object.createdTs ?? undefined;
    message.filename = object.filename ?? "";
    message.externalLink = object.externalLink ?? "";
    message.type = object.type ?? "";
    message.size = object.size ?? 0;
    message.relatedMemoId = object.relatedMemoId ?? undefined;
    return message;
  },
};

function createBaseListResourcesRequest(): ListResourcesRequest {
  return {};
}

export const ListResourcesRequest = {
  encode(_: ListResourcesRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ListResourcesRequest {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseListResourcesRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<ListResourcesRequest>): ListResourcesRequest {
    return ListResourcesRequest.fromPartial(base ?? {});
  },

  fromPartial(_: DeepPartial<ListResourcesRequest>): ListResourcesRequest {
    const message = createBaseListResourcesRequest();
    return message;
  },
};

function createBaseListResourcesResponse(): ListResourcesResponse {
  return { resources: [] };
}

export const ListResourcesResponse = {
  encode(message: ListResourcesResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.resources) {
      Resource.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ListResourcesResponse {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseListResourcesResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.resources.push(Resource.decode(reader, reader.uint32()));
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<ListResourcesResponse>): ListResourcesResponse {
    return ListResourcesResponse.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<ListResourcesResponse>): ListResourcesResponse {
    const message = createBaseListResourcesResponse();
    message.resources = object.resources?.map((e) => Resource.fromPartial(e)) || [];
    return message;
  },
};

export type ResourceServiceDefinition = typeof ResourceServiceDefinition;
export const ResourceServiceDefinition = {
  name: "ResourceService",
  fullName: "memos.api.v2.ResourceService",
  methods: {
    listResources: {
      name: "ListResources",
      requestType: ListResourcesRequest,
      requestStream: false,
      responseType: ListResourcesResponse,
      responseStream: false,
      options: {
        _unknownFields: {
          578365826: [
            new Uint8Array([19, 18, 17, 47, 97, 112, 105, 47, 118, 50, 47, 114, 101, 115, 111, 117, 114, 99, 101, 115]),
          ],
        },
      },
    },
  },
} as const;

declare const self: any | undefined;
declare const window: any | undefined;
declare const global: any | undefined;
const tsProtoGlobalThis: any = (() => {
  if (typeof globalThis !== "undefined") {
    return globalThis;
  }
  if (typeof self !== "undefined") {
    return self;
  }
  if (typeof window !== "undefined") {
    return window;
  }
  if (typeof global !== "undefined") {
    return global;
  }
  throw "Unable to locate global object";
})();

type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined;

export type DeepPartial<T> = T extends Builtin ? T
  : T extends Array<infer U> ? Array<DeepPartial<U>> : T extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>>
  : T extends {} ? { [K in keyof T]?: DeepPartial<T[K]> }
  : Partial<T>;

function toTimestamp(date: Date): Timestamp {
  const seconds = date.getTime() / 1_000;
  const nanos = (date.getTime() % 1_000) * 1_000_000;
  return { seconds, nanos };
}

function fromTimestamp(t: Timestamp): Date {
  let millis = (t.seconds || 0) * 1_000;
  millis += (t.nanos || 0) / 1_000_000;
  return new Date(millis);
}

function longToNumber(long: Long): number {
  if (long.gt(Number.MAX_SAFE_INTEGER)) {
    throw new tsProtoGlobalThis.Error("Value is larger than Number.MAX_SAFE_INTEGER");
  }
  return long.toNumber();
}

if (_m0.util.Long !== Long) {
  _m0.util.Long = Long as any;
  _m0.configure();
}
