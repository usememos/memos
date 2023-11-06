/* eslint-disable */
import _m0 from "protobufjs/minimal";

export const protobufPackage = "memos.store";

export interface InboxMessage {
  type: InboxMessage_Type;
  activityId?: number | undefined;
}

export enum InboxMessage_Type {
  TYPE_UNSPECIFIED = 0,
  TYPE_MEMO_COMMENT = 1,
  TYPE_VERSION_UPDATE = 2,
  UNRECOGNIZED = -1,
}

function createBaseInboxMessage(): InboxMessage {
  return { type: 0, activityId: undefined };
}

export const InboxMessage = {
  encode(message: InboxMessage, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.type !== 0) {
      writer.uint32(8).int32(message.type);
    }
    if (message.activityId !== undefined) {
      writer.uint32(16).int32(message.activityId);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): InboxMessage {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseInboxMessage();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 8) {
            break;
          }

          message.type = reader.int32() as any;
          continue;
        case 2:
          if (tag !== 16) {
            break;
          }

          message.activityId = reader.int32();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<InboxMessage>): InboxMessage {
    return InboxMessage.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<InboxMessage>): InboxMessage {
    const message = createBaseInboxMessage();
    message.type = object.type ?? 0;
    message.activityId = object.activityId ?? undefined;
    return message;
  },
};

type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined;

export type DeepPartial<T> = T extends Builtin ? T
  : T extends Array<infer U> ? Array<DeepPartial<U>> : T extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>>
  : T extends {} ? { [K in keyof T]?: DeepPartial<T[K]> }
  : Partial<T>;
