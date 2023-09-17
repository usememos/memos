/* eslint-disable */
import _m0 from "protobufjs/minimal";

export const protobufPackage = "memos.api.v2";

export interface Tag {
  name: string;
  creatorId: number;
}

export interface ListTagsRequest {
  creatorId: number;
}

export interface ListTagsResponse {
  tags: Tag[];
}

function createBaseTag(): Tag {
  return { name: "", creatorId: 0 };
}

export const Tag = {
  encode(message: Tag, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.name !== "") {
      writer.uint32(10).string(message.name);
    }
    if (message.creatorId !== 0) {
      writer.uint32(16).int32(message.creatorId);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Tag {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseTag();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.name = reader.string();
          continue;
        case 2:
          if (tag !== 16) {
            break;
          }

          message.creatorId = reader.int32();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<Tag>): Tag {
    return Tag.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<Tag>): Tag {
    const message = createBaseTag();
    message.name = object.name ?? "";
    message.creatorId = object.creatorId ?? 0;
    return message;
  },
};

function createBaseListTagsRequest(): ListTagsRequest {
  return { creatorId: 0 };
}

export const ListTagsRequest = {
  encode(message: ListTagsRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.creatorId !== 0) {
      writer.uint32(8).int32(message.creatorId);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ListTagsRequest {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseListTagsRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 8) {
            break;
          }

          message.creatorId = reader.int32();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<ListTagsRequest>): ListTagsRequest {
    return ListTagsRequest.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<ListTagsRequest>): ListTagsRequest {
    const message = createBaseListTagsRequest();
    message.creatorId = object.creatorId ?? 0;
    return message;
  },
};

function createBaseListTagsResponse(): ListTagsResponse {
  return { tags: [] };
}

export const ListTagsResponse = {
  encode(message: ListTagsResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.tags) {
      Tag.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ListTagsResponse {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseListTagsResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.tags.push(Tag.decode(reader, reader.uint32()));
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<ListTagsResponse>): ListTagsResponse {
    return ListTagsResponse.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<ListTagsResponse>): ListTagsResponse {
    const message = createBaseListTagsResponse();
    message.tags = object.tags?.map((e) => Tag.fromPartial(e)) || [];
    return message;
  },
};

export type TagServiceDefinition = typeof TagServiceDefinition;
export const TagServiceDefinition = {
  name: "TagService",
  fullName: "memos.api.v2.TagService",
  methods: {
    listTags: {
      name: "ListTags",
      requestType: ListTagsRequest,
      requestStream: false,
      responseType: ListTagsResponse,
      responseStream: false,
      options: {
        _unknownFields: {
          578365826: [new Uint8Array([14, 18, 12, 47, 97, 112, 105, 47, 118, 50, 47, 116, 97, 103, 115])],
        },
      },
    },
  },
} as const;

type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined;

export type DeepPartial<T> = T extends Builtin ? T
  : T extends Array<infer U> ? Array<DeepPartial<U>> : T extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>>
  : T extends {} ? { [K in keyof T]?: DeepPartial<T[K]> }
  : Partial<T>;
