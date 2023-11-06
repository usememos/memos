/* eslint-disable */
import _m0 from "protobufjs/minimal";
import { FieldMask } from "../../google/protobuf/field_mask";
import { Timestamp } from "../../google/protobuf/timestamp";

export const protobufPackage = "memos.api.v2";

export interface Inbox {
  /**
   * The name of the inbox.
   * Format: inboxes/{id}
   */
  name: string;
  /** Format: users/{username} */
  sender: string;
  /** Format: users/{username} */
  receiver: string;
  status: Inbox_Status;
  createTime?: Date | undefined;
  type: Inbox_Type;
  activityId?: number | undefined;
}

export enum Inbox_Status {
  STATUS_UNSPECIFIED = 0,
  UNREAD = 1,
  ARCHIVED = 2,
  UNRECOGNIZED = -1,
}

export enum Inbox_Type {
  TYPE_UNSPECIFIED = 0,
  TYPE_MEMO_COMMENT = 1,
  UNRECOGNIZED = -1,
}

export interface ListInboxesRequest {
  /** Format: users/{username} */
  user: string;
}

export interface ListInboxesResponse {
  inboxes: Inbox[];
}

export interface UpdateInboxRequest {
  inbox?: Inbox | undefined;
  updateMask?: string[] | undefined;
}

export interface UpdateInboxResponse {
  inbox?: Inbox | undefined;
}

export interface DeleteInboxRequest {
  /**
   * The name of the inbox to delete.
   * Format: inboxes/{inbox}
   */
  name: string;
}

export interface DeleteInboxResponse {
}

function createBaseInbox(): Inbox {
  return { name: "", sender: "", receiver: "", status: 0, createTime: undefined, type: 0, activityId: undefined };
}

export const Inbox = {
  encode(message: Inbox, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.name !== "") {
      writer.uint32(10).string(message.name);
    }
    if (message.sender !== "") {
      writer.uint32(18).string(message.sender);
    }
    if (message.receiver !== "") {
      writer.uint32(26).string(message.receiver);
    }
    if (message.status !== 0) {
      writer.uint32(32).int32(message.status);
    }
    if (message.createTime !== undefined) {
      Timestamp.encode(toTimestamp(message.createTime), writer.uint32(42).fork()).ldelim();
    }
    if (message.type !== 0) {
      writer.uint32(48).int32(message.type);
    }
    if (message.activityId !== undefined) {
      writer.uint32(56).int32(message.activityId);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Inbox {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseInbox();
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
          if (tag !== 18) {
            break;
          }

          message.sender = reader.string();
          continue;
        case 3:
          if (tag !== 26) {
            break;
          }

          message.receiver = reader.string();
          continue;
        case 4:
          if (tag !== 32) {
            break;
          }

          message.status = reader.int32() as any;
          continue;
        case 5:
          if (tag !== 42) {
            break;
          }

          message.createTime = fromTimestamp(Timestamp.decode(reader, reader.uint32()));
          continue;
        case 6:
          if (tag !== 48) {
            break;
          }

          message.type = reader.int32() as any;
          continue;
        case 7:
          if (tag !== 56) {
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

  create(base?: DeepPartial<Inbox>): Inbox {
    return Inbox.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<Inbox>): Inbox {
    const message = createBaseInbox();
    message.name = object.name ?? "";
    message.sender = object.sender ?? "";
    message.receiver = object.receiver ?? "";
    message.status = object.status ?? 0;
    message.createTime = object.createTime ?? undefined;
    message.type = object.type ?? 0;
    message.activityId = object.activityId ?? undefined;
    return message;
  },
};

function createBaseListInboxesRequest(): ListInboxesRequest {
  return { user: "" };
}

export const ListInboxesRequest = {
  encode(message: ListInboxesRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.user !== "") {
      writer.uint32(10).string(message.user);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ListInboxesRequest {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseListInboxesRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.user = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<ListInboxesRequest>): ListInboxesRequest {
    return ListInboxesRequest.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<ListInboxesRequest>): ListInboxesRequest {
    const message = createBaseListInboxesRequest();
    message.user = object.user ?? "";
    return message;
  },
};

function createBaseListInboxesResponse(): ListInboxesResponse {
  return { inboxes: [] };
}

export const ListInboxesResponse = {
  encode(message: ListInboxesResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.inboxes) {
      Inbox.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ListInboxesResponse {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseListInboxesResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.inboxes.push(Inbox.decode(reader, reader.uint32()));
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<ListInboxesResponse>): ListInboxesResponse {
    return ListInboxesResponse.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<ListInboxesResponse>): ListInboxesResponse {
    const message = createBaseListInboxesResponse();
    message.inboxes = object.inboxes?.map((e) => Inbox.fromPartial(e)) || [];
    return message;
  },
};

function createBaseUpdateInboxRequest(): UpdateInboxRequest {
  return { inbox: undefined, updateMask: undefined };
}

export const UpdateInboxRequest = {
  encode(message: UpdateInboxRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.inbox !== undefined) {
      Inbox.encode(message.inbox, writer.uint32(10).fork()).ldelim();
    }
    if (message.updateMask !== undefined) {
      FieldMask.encode(FieldMask.wrap(message.updateMask), writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): UpdateInboxRequest {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseUpdateInboxRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.inbox = Inbox.decode(reader, reader.uint32());
          continue;
        case 2:
          if (tag !== 18) {
            break;
          }

          message.updateMask = FieldMask.unwrap(FieldMask.decode(reader, reader.uint32()));
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<UpdateInboxRequest>): UpdateInboxRequest {
    return UpdateInboxRequest.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<UpdateInboxRequest>): UpdateInboxRequest {
    const message = createBaseUpdateInboxRequest();
    message.inbox = (object.inbox !== undefined && object.inbox !== null) ? Inbox.fromPartial(object.inbox) : undefined;
    message.updateMask = object.updateMask ?? undefined;
    return message;
  },
};

function createBaseUpdateInboxResponse(): UpdateInboxResponse {
  return { inbox: undefined };
}

export const UpdateInboxResponse = {
  encode(message: UpdateInboxResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.inbox !== undefined) {
      Inbox.encode(message.inbox, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): UpdateInboxResponse {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseUpdateInboxResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.inbox = Inbox.decode(reader, reader.uint32());
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<UpdateInboxResponse>): UpdateInboxResponse {
    return UpdateInboxResponse.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<UpdateInboxResponse>): UpdateInboxResponse {
    const message = createBaseUpdateInboxResponse();
    message.inbox = (object.inbox !== undefined && object.inbox !== null) ? Inbox.fromPartial(object.inbox) : undefined;
    return message;
  },
};

function createBaseDeleteInboxRequest(): DeleteInboxRequest {
  return { name: "" };
}

export const DeleteInboxRequest = {
  encode(message: DeleteInboxRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.name !== "") {
      writer.uint32(10).string(message.name);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): DeleteInboxRequest {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseDeleteInboxRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.name = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<DeleteInboxRequest>): DeleteInboxRequest {
    return DeleteInboxRequest.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<DeleteInboxRequest>): DeleteInboxRequest {
    const message = createBaseDeleteInboxRequest();
    message.name = object.name ?? "";
    return message;
  },
};

function createBaseDeleteInboxResponse(): DeleteInboxResponse {
  return {};
}

export const DeleteInboxResponse = {
  encode(_: DeleteInboxResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): DeleteInboxResponse {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseDeleteInboxResponse();
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

  create(base?: DeepPartial<DeleteInboxResponse>): DeleteInboxResponse {
    return DeleteInboxResponse.fromPartial(base ?? {});
  },

  fromPartial(_: DeepPartial<DeleteInboxResponse>): DeleteInboxResponse {
    const message = createBaseDeleteInboxResponse();
    return message;
  },
};

export type InboxServiceDefinition = typeof InboxServiceDefinition;
export const InboxServiceDefinition = {
  name: "InboxService",
  fullName: "memos.api.v2.InboxService",
  methods: {
    listInboxes: {
      name: "ListInboxes",
      requestType: ListInboxesRequest,
      requestStream: false,
      responseType: ListInboxesResponse,
      responseStream: false,
      options: {
        _unknownFields: {
          578365826: [
            new Uint8Array([17, 18, 15, 47, 97, 112, 105, 47, 118, 50, 47, 105, 110, 98, 111, 120, 101, 115]),
          ],
        },
      },
    },
    updateInbox: {
      name: "UpdateInbox",
      requestType: UpdateInboxRequest,
      requestStream: false,
      responseType: UpdateInboxResponse,
      responseStream: false,
      options: {
        _unknownFields: {
          8410: [new Uint8Array([17, 105, 110, 98, 111, 120, 44, 117, 112, 100, 97, 116, 101, 95, 109, 97, 115, 107])],
          578365826: [
            new Uint8Array([
              20,
              58,
              5,
              105,
              110,
              98,
              111,
              120,
              50,
              11,
              47,
              118,
              50,
              47,
              105,
              110,
              98,
              111,
              120,
              101,
              115,
            ]),
          ],
        },
      },
    },
    deleteInbox: {
      name: "DeleteInbox",
      requestType: DeleteInboxRequest,
      requestStream: false,
      responseType: DeleteInboxResponse,
      responseStream: false,
      options: {
        _unknownFields: {
          8410: [new Uint8Array([4, 110, 97, 109, 101])],
          578365826: [
            new Uint8Array([
              22,
              42,
              20,
              47,
              118,
              50,
              47,
              123,
              110,
              97,
              109,
              101,
              61,
              105,
              110,
              98,
              111,
              120,
              101,
              115,
              47,
              42,
              125,
            ]),
          ],
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
