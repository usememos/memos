/* eslint-disable */
import _m0 from "protobufjs/minimal";
import { Timestamp } from "../../google/protobuf/timestamp";

export const protobufPackage = "memos.api.v2";

export interface Activity {
  id: number;
  creatorId: number;
  type: string;
  level: string;
  createTime?: Date | undefined;
  payload?: ActivityPayload | undefined;
}

export interface ActivityMemoCommentPayload {
  memoId: number;
  relatedMemoId: number;
}

export interface ActivityPayload {
  memoComment?: ActivityMemoCommentPayload | undefined;
}

export interface GetActivityRequest {
  id: number;
}

export interface GetActivityResponse {
  activity?: Activity | undefined;
}

function createBaseActivity(): Activity {
  return { id: 0, creatorId: 0, type: "", level: "", createTime: undefined, payload: undefined };
}

export const Activity = {
  encode(message: Activity, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.id !== 0) {
      writer.uint32(8).int32(message.id);
    }
    if (message.creatorId !== 0) {
      writer.uint32(16).int32(message.creatorId);
    }
    if (message.type !== "") {
      writer.uint32(26).string(message.type);
    }
    if (message.level !== "") {
      writer.uint32(34).string(message.level);
    }
    if (message.createTime !== undefined) {
      Timestamp.encode(toTimestamp(message.createTime), writer.uint32(42).fork()).ldelim();
    }
    if (message.payload !== undefined) {
      ActivityPayload.encode(message.payload, writer.uint32(50).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Activity {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseActivity();
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
          if (tag !== 16) {
            break;
          }

          message.creatorId = reader.int32();
          continue;
        case 3:
          if (tag !== 26) {
            break;
          }

          message.type = reader.string();
          continue;
        case 4:
          if (tag !== 34) {
            break;
          }

          message.level = reader.string();
          continue;
        case 5:
          if (tag !== 42) {
            break;
          }

          message.createTime = fromTimestamp(Timestamp.decode(reader, reader.uint32()));
          continue;
        case 6:
          if (tag !== 50) {
            break;
          }

          message.payload = ActivityPayload.decode(reader, reader.uint32());
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<Activity>): Activity {
    return Activity.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<Activity>): Activity {
    const message = createBaseActivity();
    message.id = object.id ?? 0;
    message.creatorId = object.creatorId ?? 0;
    message.type = object.type ?? "";
    message.level = object.level ?? "";
    message.createTime = object.createTime ?? undefined;
    message.payload = (object.payload !== undefined && object.payload !== null)
      ? ActivityPayload.fromPartial(object.payload)
      : undefined;
    return message;
  },
};

function createBaseActivityMemoCommentPayload(): ActivityMemoCommentPayload {
  return { memoId: 0, relatedMemoId: 0 };
}

export const ActivityMemoCommentPayload = {
  encode(message: ActivityMemoCommentPayload, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.memoId !== 0) {
      writer.uint32(8).int32(message.memoId);
    }
    if (message.relatedMemoId !== 0) {
      writer.uint32(16).int32(message.relatedMemoId);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ActivityMemoCommentPayload {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseActivityMemoCommentPayload();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 8) {
            break;
          }

          message.memoId = reader.int32();
          continue;
        case 2:
          if (tag !== 16) {
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

  create(base?: DeepPartial<ActivityMemoCommentPayload>): ActivityMemoCommentPayload {
    return ActivityMemoCommentPayload.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<ActivityMemoCommentPayload>): ActivityMemoCommentPayload {
    const message = createBaseActivityMemoCommentPayload();
    message.memoId = object.memoId ?? 0;
    message.relatedMemoId = object.relatedMemoId ?? 0;
    return message;
  },
};

function createBaseActivityPayload(): ActivityPayload {
  return { memoComment: undefined };
}

export const ActivityPayload = {
  encode(message: ActivityPayload, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.memoComment !== undefined) {
      ActivityMemoCommentPayload.encode(message.memoComment, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ActivityPayload {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseActivityPayload();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.memoComment = ActivityMemoCommentPayload.decode(reader, reader.uint32());
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<ActivityPayload>): ActivityPayload {
    return ActivityPayload.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<ActivityPayload>): ActivityPayload {
    const message = createBaseActivityPayload();
    message.memoComment = (object.memoComment !== undefined && object.memoComment !== null)
      ? ActivityMemoCommentPayload.fromPartial(object.memoComment)
      : undefined;
    return message;
  },
};

function createBaseGetActivityRequest(): GetActivityRequest {
  return { id: 0 };
}

export const GetActivityRequest = {
  encode(message: GetActivityRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.id !== 0) {
      writer.uint32(8).int32(message.id);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): GetActivityRequest {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseGetActivityRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 8) {
            break;
          }

          message.id = reader.int32();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<GetActivityRequest>): GetActivityRequest {
    return GetActivityRequest.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<GetActivityRequest>): GetActivityRequest {
    const message = createBaseGetActivityRequest();
    message.id = object.id ?? 0;
    return message;
  },
};

function createBaseGetActivityResponse(): GetActivityResponse {
  return { activity: undefined };
}

export const GetActivityResponse = {
  encode(message: GetActivityResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.activity !== undefined) {
      Activity.encode(message.activity, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): GetActivityResponse {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseGetActivityResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.activity = Activity.decode(reader, reader.uint32());
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<GetActivityResponse>): GetActivityResponse {
    return GetActivityResponse.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<GetActivityResponse>): GetActivityResponse {
    const message = createBaseGetActivityResponse();
    message.activity = (object.activity !== undefined && object.activity !== null)
      ? Activity.fromPartial(object.activity)
      : undefined;
    return message;
  },
};

export type ActivityServiceDefinition = typeof ActivityServiceDefinition;
export const ActivityServiceDefinition = {
  name: "ActivityService",
  fullName: "memos.api.v2.ActivityService",
  methods: {
    getActivity: {
      name: "GetActivity",
      requestType: GetActivityRequest,
      requestStream: false,
      responseType: GetActivityResponse,
      responseStream: false,
      options: {
        _unknownFields: {
          578365826: [new Uint8Array([16, 18, 14, 47, 118, 50, 47, 97, 99, 116, 105, 118, 105, 116, 105, 101, 115])],
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
