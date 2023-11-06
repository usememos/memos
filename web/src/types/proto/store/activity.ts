/* eslint-disable */
import _m0 from "protobufjs/minimal";

export const protobufPackage = "memos.store";

export interface ActivityMemoCommentPayload {
  memoId: number;
  relatedMemoId: number;
}

export interface ActivityVersionUpdatePayload {
  version: string;
}

export interface ActivityPayload {
  memoComment?: ActivityMemoCommentPayload | undefined;
  versionUpdate?: ActivityVersionUpdatePayload | undefined;
}

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

function createBaseActivityVersionUpdatePayload(): ActivityVersionUpdatePayload {
  return { version: "" };
}

export const ActivityVersionUpdatePayload = {
  encode(message: ActivityVersionUpdatePayload, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.version !== "") {
      writer.uint32(10).string(message.version);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ActivityVersionUpdatePayload {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseActivityVersionUpdatePayload();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.version = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<ActivityVersionUpdatePayload>): ActivityVersionUpdatePayload {
    return ActivityVersionUpdatePayload.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<ActivityVersionUpdatePayload>): ActivityVersionUpdatePayload {
    const message = createBaseActivityVersionUpdatePayload();
    message.version = object.version ?? "";
    return message;
  },
};

function createBaseActivityPayload(): ActivityPayload {
  return { memoComment: undefined, versionUpdate: undefined };
}

export const ActivityPayload = {
  encode(message: ActivityPayload, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.memoComment !== undefined) {
      ActivityMemoCommentPayload.encode(message.memoComment, writer.uint32(10).fork()).ldelim();
    }
    if (message.versionUpdate !== undefined) {
      ActivityVersionUpdatePayload.encode(message.versionUpdate, writer.uint32(18).fork()).ldelim();
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
        case 2:
          if (tag !== 18) {
            break;
          }

          message.versionUpdate = ActivityVersionUpdatePayload.decode(reader, reader.uint32());
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
    message.versionUpdate = (object.versionUpdate !== undefined && object.versionUpdate !== null)
      ? ActivityVersionUpdatePayload.fromPartial(object.versionUpdate)
      : undefined;
    return message;
  },
};

type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined;

export type DeepPartial<T> = T extends Builtin ? T
  : T extends Array<infer U> ? Array<DeepPartial<U>> : T extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>>
  : T extends {} ? { [K in keyof T]?: DeepPartial<T[K]> }
  : Partial<T>;
